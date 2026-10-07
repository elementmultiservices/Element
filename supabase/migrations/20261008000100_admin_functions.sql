-- Element — admin read models. Every function checks public.is_admin()
-- (active admin + MFA-verified session) before returning anything, and is the
-- only way the API exposes auth emails, sign-in times and storage figures.

-- Escapes LIKE wildcards so user input is matched literally.
create or replace function public.like_escape(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(p, '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- ---------------------------------------------------------------------------
-- Users list / detail
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_search text default null,
  p_status text default null,   -- 'active' | 'inactive' | 'pending'
  p_role   text default null,   -- 'user' | 'admin'
  p_sort   text default 'created_at',
  p_dir    text default 'desc',
  p_limit  integer default 20,
  p_offset integer default 0,
  p_id     uuid default null
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
      exists (select 1 from auth.mfa_factors m where m.user_id = p.id and m.status = 'verified') as has_mfa
    from public.profiles p
    join auth.users u on u.id = p.id
    where (p_id is null or p.id = p_id)
      and (v_pattern is null or p.full_name ilike v_pattern or u.email ilike v_pattern)
      and (p_status is null
           or (p_status = 'active' and p.is_active and u.email_confirmed_at is not null)
           or (p_status = 'inactive' and not p.is_active)
           or (p_status = 'pending' and u.email_confirmed_at is null))
      and (p_role is null or p.role::text = p_role)
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

-- ---------------------------------------------------------------------------
-- Name/email labels for ids (owners, actors) and the owner picker.
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_labels(p_ids uuid[])
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = any (p_ids);
end;
$$;

create or replace function public.admin_user_options()
returns table (id uuid, full_name text, email text, role public.user_role, is_active boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, u.email::text, p.role, p.is_active
  from public.profiles p
  join auth.users u on u.id = p.id
  order by lower(nullif(p.full_name, '')) nulls last, u.email
  limit 5000;
end;
$$;

-- ---------------------------------------------------------------------------
-- Overview totals
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns table (
  users_total bigint,
  users_active bigint,
  users_inactive bigint,
  users_pending bigint,
  files_active bigint,
  files_trashed bigint,
  storage_used_bytes bigint,
  storage_trashed_bytes bigint,
  uploads_last_7d bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select
    (select count(*) from public.profiles)::bigint,
    (select count(*) from public.profiles p join auth.users u on u.id = p.id where p.is_active and u.email_confirmed_at is not null)::bigint,
    (select count(*) from public.profiles where not is_active)::bigint,
    (select count(*) from auth.users u join public.profiles p on p.id = u.id where u.email_confirmed_at is null)::bigint,
    (select count(*) from public.files where deleted_at is null)::bigint,
    (select count(*) from public.files where deleted_at is not null)::bigint,
    coalesce((select sum(size_bytes) from public.files where deleted_at is null), 0)::bigint,
    coalesce((select sum(size_bytes) from public.files where deleted_at is not null), 0)::bigint,
    (select count(*) from public.files where created_at > now() - interval '7 days')::bigint;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit search (free text, action group, actor, subject user, date range).
-- Dates are interpreted in America/Bogota.
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_audit(
  p_q       text default null,
  p_action  text default null,   -- prefix, e.g. 'auth.' or 'file.uploaded'
  p_actor   text default null,   -- matches actor email or name
  p_subject uuid default null,   -- rows where the user is actor or target
  p_from    date default null,
  p_to      date default null,
  p_limit   integer default 50,
  p_offset  integer default 0
)
returns table (
  id bigint,
  created_at timestamptz,
  action text,
  actor_id uuid,
  actor_email text,
  actor_name text,
  target_type text,
  target_id text,
  target_label text,
  metadata jsonb,
  ip inet,
  user_agent text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := case when nullif(trim(p_q), '') is null then null else '%' || public.like_escape(trim(p_q)) || '%' end;
  v_actor text := case when nullif(trim(p_actor), '') is null then null else '%' || public.like_escape(trim(p_actor)) || '%' end;
  v_action text := case when nullif(trim(p_action), '') is null then null else public.like_escape(trim(p_action)) || '%' end;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with rows as (
    select
      a.*,
      au.email::text as actor_email,
      ap.full_name as actor_name,
      case a.target_type
        when 'user' then (select tu.email::text from auth.users tu where tu.id::text = a.target_id)
        when 'file' then coalesce((select f.original_name from public.files f where f.id::text = a.target_id), a.metadata ->> 'original_name')
        when 'category' then (select c.name_en || ' / ' || c.name_es from public.file_categories c where c.id::text = a.target_id)
        else null
      end as target_label
    from public.audit_logs a
    left join auth.users au on au.id = a.actor_id
    left join public.profiles ap on ap.id = a.actor_id
    where (v_action is null or a.action like v_action)
      and (p_subject is null or a.actor_id = p_subject or (a.target_type = 'user' and a.target_id = p_subject::text)
           or (a.metadata ->> 'owner_id') = p_subject::text)
      and (p_from is null or a.created_at >= (p_from::timestamp at time zone 'America/Bogota'))
      and (p_to is null or a.created_at < ((p_to + 1)::timestamp at time zone 'America/Bogota'))
      and (v_actor is null or au.email ilike v_actor or ap.full_name ilike v_actor)
  )
  select r.id, r.created_at, r.action, r.actor_id, r.actor_email, r.actor_name, r.target_type, r.target_id,
         r.target_label, r.metadata, r.ip, r.user_agent, count(*) over ()::bigint
  from rows r
  where v_q is null
     or r.action ilike v_q
     or r.target_id ilike v_q
     or r.target_label ilike v_q
     or r.actor_email ilike v_q
     or host(r.ip) ilike v_q
     or r.metadata::text ilike v_q
  order by r.created_at desc, r.id desc
  limit least(greatest(p_limit, 1), 50000)
  offset greatest(p_offset, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Category list with usage counts.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_categories()
returns table (id uuid, name_en text, name_es text, is_archived boolean, created_at timestamptz, file_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select c.id, c.name_en, c.name_es, c.is_archived, c.created_at,
         (select count(*) from public.files f where f.category_id = c.id and f.deleted_at is null)::bigint
  from public.file_categories c
  order by c.is_archived, lower(c.name_en);
end;
$$;

-- Grants: authenticated may call (the functions themselves enforce admin).
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.admin_list_users(text, text, text, text, text, integer, integer, uuid)',
    'public.admin_user_labels(uuid[])',
    'public.admin_user_options()',
    'public.admin_overview()',
    'public.admin_search_audit(text, text, text, uuid, date, date, integer, integer)',
    'public.admin_list_categories()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;

-- Category names are unique per language (case-insensitive) to avoid confusing filters.
create unique index file_categories_name_en_key on public.file_categories (lower(name_en));
create unique index file_categories_name_es_key on public.file_categories (lower(name_es));
