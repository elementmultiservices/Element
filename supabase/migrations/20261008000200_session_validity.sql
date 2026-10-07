-- Element — immediate session revocation.
-- Access tokens stay cryptographically valid until they expire (jwt_expiry).
-- session_context() now also reports whether the token's session still exists,
-- so revoked sessions (deactivation, forced password reset, "sign out other
-- sessions" after a password change) lose access on their very next request.

drop function if exists public.session_context();

create function public.session_context()
returns table (
  role public.user_role,
  is_active boolean,
  preferred_locale public.app_locale,
  full_name text,
  has_verified_mfa boolean,
  session_valid boolean
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
    )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;
