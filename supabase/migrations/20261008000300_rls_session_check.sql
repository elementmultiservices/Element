-- Element — RLS helpers also require the token's session to still exist, so a
-- revoked session cannot keep using the Data/Storage APIs directly until its
-- access token expires. (Lookup by primary key: negligible cost.)

create or replace function public.current_session_valid()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
      and s.user_id = (select auth.uid())
  );
$$;

revoke all on function public.current_session_valid() from public, anon;
grant execute on function public.current_session_valid() to authenticated, service_role;

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
  ) and public.current_session_valid();
$$;

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
     )
     and public.current_session_valid();
$$;
