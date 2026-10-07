-- Element — MFA recovery codes.
-- Supabase Auth has no native recovery codes. Ten single-use codes are issued
-- when TOTP is enrolled (or regenerated with a valid TOTP code). Only a keyed
-- hash (HMAC-SHA256 with a server-side secret) is stored; plaintext codes are
-- shown to the user exactly once. All writes are done by the server with the
-- service role; users can only learn how many unused codes they have left.

create table public.mfa_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  code_hash  text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint mfa_recovery_codes_user_hash_key unique (user_id, code_hash)
);

create index mfa_recovery_codes_user_unused_idx on public.mfa_recovery_codes (user_id) where used_at is null;

alter table public.mfa_recovery_codes enable row level security;
revoke all on public.mfa_recovery_codes from anon, authenticated;

-- Admins (with MFA) may see that codes exist for a user; nobody reads hashes
-- through the API (no column grant on code_hash).
grant select (id, user_id, used_at, created_at) on public.mfa_recovery_codes to authenticated;

create policy mfa_recovery_codes_select_own on public.mfa_recovery_codes
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy mfa_recovery_codes_select_admin on public.mfa_recovery_codes
  for select to authenticated
  using ((select public.is_admin()));

-- Remaining unused codes for the signed-in user (profile page).
create or replace function public.my_recovery_codes_remaining()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.mfa_recovery_codes c
  where c.user_id = (select auth.uid()) and c.used_at is null and public.is_active_user();
$$;

revoke all on function public.my_recovery_codes_remaining() from public, anon;
grant execute on function public.my_recovery_codes_remaining() to authenticated;

-- Atomically consumes one unused code (service role only). Returns true if a
-- matching unused code existed.
create or replace function public.consume_recovery_code(p_user uuid, p_hash text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with used as (
    update public.mfa_recovery_codes
       set used_at = now()
     where user_id = p_user and code_hash = p_hash and used_at is null
    returning id
  )
  select exists (select 1 from used);
$$;

revoke all on function public.consume_recovery_code(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_recovery_code(uuid, text) to service_role;

