-- Element — storage quota and usage are not disclosed to regular users.
-- Quota checks happen server-side (service role); only admins may read them.

-- 1) storage_usage(): admins (with MFA) and the service role only.
create or replace function public.storage_usage(p_owner uuid)
returns table (used_bytes bigint, pending_bytes bigint, quota_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or (select auth.role()) = 'service_role') then
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

-- 2) profiles.storage_quota_bytes: not readable through the API by authenticated
--    sessions (column privileges). Admin screens read it with the service role
--    after requireAdmin().
revoke select on public.profiles from authenticated;
grant select (id, full_name, role, is_active, preferred_locale, created_at) on public.profiles to authenticated;
