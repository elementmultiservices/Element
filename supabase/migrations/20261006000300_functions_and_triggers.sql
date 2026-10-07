-- Element — helper functions and triggers.
-- All SECURITY DEFINER functions pin search_path to '' and fully qualify names.

-- ---------------------------------------------------------------------------
-- Authorization helpers used by RLS policies.
-- ---------------------------------------------------------------------------

-- True when the caller has an active profile.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

-- True only for an active admin whose session has completed MFA (aal2).
-- An admin without a verified second factor gets no elevated access at all.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
     and exists (
       select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.is_active and p.role = 'admin'
     );
$$;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_active_user() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Session context consumed by the proxy and server guards in a single call.
-- ---------------------------------------------------------------------------
create or replace function public.session_context()
returns table (
  role public.user_role,
  is_active boolean,
  preferred_locale public.app_locale,
  full_name text,
  has_verified_mfa boolean
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
    )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;

-- ---------------------------------------------------------------------------
-- Server-only helpers (service_role).
-- ---------------------------------------------------------------------------

-- Resolve an auth user id by email without exposing the auth schema.
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;

-- Revoke every session (and its refresh tokens) for a user. Used on deactivation.
create or replace function public.revoke_user_sessions(p_user uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = p_user;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Storage usage for quota checks: active files plus pending upload intents.
-- ---------------------------------------------------------------------------
create or replace function public.storage_usage(p_owner uuid)
returns table (used_bytes bigint, pending_bytes bigint, quota_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    p_owner = (select auth.uid()) and public.is_active_user()
    or public.is_admin()
    or (select auth.role()) = 'service_role'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    coalesce((select sum(f.size_bytes) from public.files f
              where f.owner_id = p_owner and f.deleted_at is null), 0)::bigint,
    coalesce((select sum(i.declared_size) from public.upload_intents i
              where i.owner_id = p_owner and i.consumed_at is null and i.expires_at > now()), 0)::bigint,
    (select p.storage_quota_bytes from public.profiles p where p.id = p_owner);
end;
$$;

revoke all on function public.storage_usage(uuid) from public, anon;
grant execute on function public.storage_usage(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Recent authentication activity for the signed-in user (profile page).
-- ---------------------------------------------------------------------------
create or replace function public.my_auth_activity(p_limit integer default 20)
returns table (id bigint, action text, ip inet, user_agent text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.action, a.ip, a.user_agent, a.created_at
  from public.audit_logs a
  where public.is_active_user()
    and a.action like 'auth.%'
    and (a.actor_id = (select auth.uid())
         or (a.target_type = 'user' and a.target_id = (select auth.uid())::text))
  order by a.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.my_auth_activity(integer) from public, anon;
grant execute on function public.my_auth_activity(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- New auth user -> profile. The role is ALWAYS 'user'; promotion happens only
-- through the server (service role) or an admin with MFA.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale public.app_locale := 'en';
begin
  if new.raw_user_meta_data ->> 'preferred_locale' = 'es' then
    v_locale := 'es';
  end if;

  insert into public.profiles (id, full_name, preferred_locale)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    v_locale
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Protect privileged profile columns.
-- - Regular users can only change full_name and preferred_locale.
-- - Admins cannot change their own role or active status.
-- - The last active admin can never be demoted or deactivated.
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
         or new.storage_quota_bytes is distinct from old.storage_quota_bytes then
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

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- updated_at maintenance.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create trigger post_translations_set_updated_at
  before update on public.post_translations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs is append-only for every role, including service_role.
-- ---------------------------------------------------------------------------
create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_immutable();

revoke update, delete, truncate on public.audit_logs from anon, authenticated, service_role;
