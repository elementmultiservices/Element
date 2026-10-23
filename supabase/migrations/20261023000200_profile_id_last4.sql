-- Element — last four digits of the client's tax ID (SSN, ITIN or EIN).
-- Used to match office records to accounts. Never the full number. Not
-- readable or writable by regular sessions: only admins (through the service
-- role after requireAdmin()) and import scripts set it.

alter table public.profiles
  add column if not exists id_last4 text check (id_last4 is null or id_last4 ~ '^[0-9]{4}$');

create index if not exists profiles_id_last4_idx on public.profiles (id_last4) where id_last4 is not null;

-- No column grant to authenticated: select on profiles is column-restricted
-- (20261007000100), so id_last4 stays hidden from the API. Updates are
-- table-level, so the trigger also blocks non-admins from changing it.
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
         or new.can_upload is distinct from old.can_upload
         or new.id_last4 is distinct from old.id_last4 then
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
