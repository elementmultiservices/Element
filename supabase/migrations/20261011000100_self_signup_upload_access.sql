-- Element — open sign-up (email link or Google) with admin-controlled upload access.
--
-- Anyone may create an account, but only accounts with profiles.can_upload may
-- upload documents. An administrator grants it to an existing account, or
-- pre-authorizes an email address that has no account yet (upload_grants): the
-- grant is applied when that address is verified (email link confirmed, or
-- first sign-in with Google), never before, so nobody can claim it with an
-- address they do not control.

-- ---------------------------------------------------------------------------
-- profiles.can_upload. Accounts that already exist were invited by an admin
-- and keep the access they had.
-- ---------------------------------------------------------------------------
alter table public.profiles add column can_upload boolean not null default false;
update public.profiles set can_upload = true;

grant select (can_upload) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Pre-authorized addresses (pending until an account with that address is verified).
-- ---------------------------------------------------------------------------
create table public.upload_grants (
  email      text primary key check (email = lower(email) and char_length(email) between 3 and 254),
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.upload_grants enable row level security;
revoke all on public.upload_grants from anon, authenticated;
grant select, insert, delete on public.upload_grants to authenticated;

create policy upload_grants_select_admin on public.upload_grants
  for select to authenticated
  using ((select public.is_admin()));

create policy upload_grants_insert_admin on public.upload_grants
  for insert to authenticated
  with check ((select public.is_admin()) and granted_by = (select auth.uid()));

create policy upload_grants_delete_admin on public.upload_grants
  for delete to authenticated
  using ((select public.is_admin()));

-- Applies (and consumes) a pending grant once the account's address is verified.
-- Fires after on_auth_user_created (triggers run in name order), so the profile exists.
create or replace function public.apply_upload_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and new.email is not null then
    with consumed as (
      delete from public.upload_grants g where g.email = lower(new.email) returning 1
    )
    update public.profiles p
       set can_upload = true
     where p.id = new.id and exists (select 1 from consumed);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_upload_grant
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.apply_upload_grant();

-- ---------------------------------------------------------------------------
-- Regular users cannot grant themselves upload access.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'immutable_column' using errcode = '42501';
  end if;

  if current_user in ('authenticated', 'anon') then
    if not public.is_admin() then
      if new.role is distinct from old.role
         or new.is_active is distinct from old.is_active
         or new.storage_quota_bytes is distinct from old.storage_quota_bytes
         or new.can_upload is distinct from old.can_upload then
        raise exception 'forbidden_column' using errcode = '42501';
      end if;
    elsif old.id = (select auth.uid())
          and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      raise exception 'self_privilege_change' using errcode = '42501';
    end if;
  end if;

  if old.role = 'admin' and old.is_active
     and (new.role <> 'admin' or not new.is_active)
     and not exists (
       select 1 from public.profiles p
       where p.role = 'admin' and p.is_active and p.id <> old.id
     ) then
    raise exception 'last_admin' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- session_context() also reports can_upload.
-- ---------------------------------------------------------------------------
drop function if exists public.session_context();

create function public.session_context()
returns table (
  role public.user_role,
  is_active boolean,
  preferred_locale public.app_locale,
  full_name text,
  has_verified_mfa boolean,
  session_valid boolean,
  can_upload boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.role,
    p.is_active,
    p.preferred_locale,
    p.full_name,
    exists (
      select 1 from auth.mfa_factors f
      where f.user_id = p.id and f.status = 'verified' and f.factor_type = 'totp'
    ),
    exists (
      select 1 from auth.sessions s
      where s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
        and s.user_id = p.id
    ),
    p.can_upload
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_list_users(): can_upload column and filter (p_upload: 'yes' | 'no').
-- ---------------------------------------------------------------------------
drop function if exists public.admin_list_users(text, text, text, text, text, integer, integer, uuid);

create function public.admin_list_users(
  p_search text default null,
  p_status text default null,   -- 'active' | 'inactive' | 'pending'
  p_role   text default null,   -- 'user' | 'admin'
  p_sort   text default 'created_at',
  p_dir    text default 'desc',
  p_limit  integer default 20,
  p_offset integer default 0,
  p_id     uuid default null,
  p_upload text default null    -- 'yes' | 'no'
)
returns table (
  id uuid,
  email text,
  full_name text,
  role public.user_role,
  is_active boolean,
  preferred_locale public.app_locale,
  storage_quota_bytes bigint,
  used_bytes bigint,
  file_count bigint,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  invitation_pending boolean,
  has_mfa boolean,
  can_upload boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pattern text := case when nullif(trim(p_search), '') is null then null
                         else '%' || public.like_escape(trim(p_search)) || '%' end;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with base as (
    select
      p.id,
      u.email::text as email,
      p.full_name,
      p.role,
      p.is_active,
      p.preferred_locale,
      p.storage_quota_bytes,
      coalesce((select sum(f.size_bytes) from public.files f where f.owner_id = p.id and f.deleted_at is null), 0)::bigint as used_bytes,
      (select count(*) from public.files f where f.owner_id = p.id and f.deleted_at is null)::bigint as file_count,
      p.created_at,
      u.last_sign_in_at,
      (u.email_confirmed_at is null) as invitation_pending,
      exists (select 1 from auth.mfa_factors m where m.user_id = p.id and m.status = 'verified') as has_mfa,
      p.can_upload
    from public.profiles p
    join auth.users u on u.id = p.id
    where (p_id is null or p.id = p_id)
      and (v_pattern is null or p.full_name ilike v_pattern or u.email ilike v_pattern)
      and (p_status is null
           or (p_status = 'active' and p.is_active and u.email_confirmed_at is not null)
           or (p_status = 'inactive' and not p.is_active)
           or (p_status = 'pending' and u.email_confirmed_at is null))
      and (p_role is null or p.role::text = p_role)
      and (p_upload is null or (p_upload = 'yes') = p.can_upload)
  )
  select b.*, count(*) over ()::bigint
  from base b
  order by
    case when p_sort = 'full_name' and p_dir = 'asc' then lower(b.full_name) end asc,
    case when p_sort = 'full_name' and p_dir = 'desc' then lower(b.full_name) end desc,
    case when p_sort = 'email' and p_dir = 'asc' then b.email end asc,
    case when p_sort = 'email' and p_dir = 'desc' then b.email end desc,
    case when p_sort = 'last_sign_in_at' and p_dir = 'asc' then b.last_sign_in_at end asc nulls first,
    case when p_sort = 'last_sign_in_at' and p_dir = 'desc' then b.last_sign_in_at end desc nulls last,
    case when p_sort = 'used_bytes' and p_dir = 'asc' then b.used_bytes end asc,
    case when p_sort = 'used_bytes' and p_dir = 'desc' then b.used_bytes end desc,
    case when p_sort = 'created_at' and p_dir = 'asc' then b.created_at end asc,
    b.created_at desc,
    b.id
  limit least(greatest(p_limit, 1), 50000)
  offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.admin_list_users(text, text, text, text, text, integer, integer, uuid, text) from public, anon;
grant execute on function public.admin_list_users(text, text, text, text, text, integer, integer, uuid, text) to authenticated, service_role;
