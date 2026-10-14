-- Element — whether the signed-in user has a password. Accounts created with
-- "Continue with Google" start without one; the profile then offers to create
-- it (confirmed with a one-time code sent by email) instead of changing it.

create or replace function public.my_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.encrypted_password, '') <> ''
  from auth.users u
  where u.id = (select auth.uid()) and public.is_active_user();
$$;

revoke all on function public.my_has_password() from public, anon;
grant execute on function public.my_has_password() to authenticated;
