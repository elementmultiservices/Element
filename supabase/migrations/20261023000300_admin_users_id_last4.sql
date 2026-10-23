-- Element — last four digits of the tax ID in the admin user list.
-- Requires 20261023000200_profile_id_last4. The digits are for staff only:
-- clients never see them.
--
-- admin_list_users(): returns id_last4 and finds accounts by it. A search made
-- only of four digits (optionally typed as "***-**-1234" or "xxx-xx-1234")
-- matches id_last4 exactly, in addition to the usual name/email match.

drop function if exists public.admin_list_users(text, text, text, text, text, integer, integer, uuid, text);

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
  id_last4 text,
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
  v_last4   text := case when trim(coalesce(p_search, '')) ~ '^[\s*xX•-]*[0-9]{4}$'
                         then right(regexp_replace(p_search, '[^0-9]', '', 'g'), 4) end;
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
      p.can_upload,
      p.id_last4
    from public.profiles p
    join auth.users u on u.id = p.id
    where (p_id is null or p.id = p_id)
      and (v_pattern is null
           or p.full_name ilike v_pattern
           or u.email ilike v_pattern
           or (v_last4 is not null and p.id_last4 = v_last4))
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

-- Clients must not read their own digits: remove the helper an earlier version
-- of this migration created.
drop function if exists public.my_id_last4();
