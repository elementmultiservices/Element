# Element — security checklist before going live

Work through this list for the **production** environment. Every item should be checked by
the person deploying, and the open items reviewed again after each major change.

## Accounts, keys and environments

- [ ] Production uses its **own Supabase project**, separate from development and preview, with its own keys.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists only in Vercel server variables (marked Sensitive). It never appears in a `NEXT_PUBLIC_*` variable, the repository, or client code. Search the built output for it: `grep -r "sb_secret_" .next/static` must return nothing.
- [ ] `SESSION_SECRET` is a fresh random value (48+ bytes) unique to production.
- [ ] `PURGE_TRASH_SECRET` is random, set with `supabase secrets set`, and matches the `purge_trash_secret` Vault entry.
- [ ] `.env*` files are not committed (`git ls-files | grep .env` shows only `.env.example` files).
- [ ] Access to the Vercel, Supabase, Upstash, Resend, Google reCAPTCHA and Sentry consoles is limited to named people, with MFA enabled on each console.

## Supabase Auth

- [ ] Public sign-ups are **disabled**, and the Email provider is **enabled**.
- [ ] Minimum password length 12, with lowercase, uppercase and digits required.
- [ ] **Leaked password protection** enabled. This requires the **Pro plan**; until you upgrade, record it as an accepted risk.
- [ ] Email OTP expiry is 86400 s (24 h). JWT expiry is 900 s.
- [ ] MFA TOTP is enabled.
- [ ] The Site URL and redirect allow list contain **only** the production domain.
- [ ] The first administrator was created with `npm run admin:create` and has enrolled MFA. **At least two administrators** exist, so losing one authenticator does not lock the organization out.
- [ ] A documented procedure exists for an administrator who loses their authenticator. Today it means another person with database access removes their factor from `auth.mfa_factors`, with the change recorded.

## Database and storage

- [ ] All migrations are applied (`supabase db push`) and `supabase migration list` shows no drift.
- [ ] Every public table has RLS and at least one policy. This query must return no rows:
  ```sql
  select tablename from pg_tables t where schemaname = 'public'
    and (not rowsecurity or not exists (select 1 from pg_policies p where p.tablename = t.tablename));
  ```
- [ ] The `files` bucket is **private**. Only `blog-covers` is public.
- [ ] The cron jobs `purge-trash` and `publish-scheduled-posts` exist (`select * from cron.job`). The Edge Function `purge-trash` is deployed with `--no-verify-jwt`.
- [ ] Backups / Point-in-Time Recovery are configured according to the plan, and a restore has been tested.

## Abuse prevention and email

- [ ] reCAPTCHA v3 keys are restricted to the production domain. `RECAPTCHA_MIN_SCORE` has been reviewed (default 0.5).
- [ ] Upstash Redis is configured; the production server does not start without it.
- [ ] Resend: the sending domain is verified (SPF, DKIM, and a DMARC policy published). `EMAIL_FROM` uses that domain. `CONTACT_INBOX` is a monitored mailbox.
- [ ] The app is served **only through Vercel**. Per-IP rate limits trust `x-forwarded-for` / `x-real-ip`, which Vercel overwrites. If another proxy or CDN sits in front, it must overwrite these headers too.

## Headers and transport

- [ ] HTTPS only, on the final domain. HSTS is sent (`max-age=63072000; includeSubDomains; preload`). Submit the domain to hstspreload.org only once every subdomain is HTTPS.
- [ ] The response headers include the CSP (with a nonce, no `unsafe-eval`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy` (check with securityheaders.com or `curl -I`).
- [ ] The browser console shows no CSP violations on sign-in, upload, download, the blog editor or the contact form. This matters especially for reCAPTCHA, which is only active in production.

## Monitoring and logs

- [ ] The Sentry DSN is set for production. Trigger a test error and confirm in Sentry that the event has **no** user, cookies, headers, request body, query string, emails or file names.
- [ ] Sentry alerts are routed to someone who will act on them.
- [ ] Vercel log retention and access are set. Server logs contain error codes only, never passwords, tokens or file contents.
- [ ] Someone reviews the audit log periodically, at least for `auth.sign_in.locked`, `file.upload_rejected`, `user.deactivated`, `user.password_reset.forced` and `admin.export`.

## Application checks (production URL)

- [ ] `/` redirects to `/en` and the language choice persists. Without a session, `/en/admin` and `/en/dashboard` lead to sign-in.
- [ ] A regular user cannot open `/en/admin/*`, and `/api/admin/export/users` returns 403 for them.
- [ ] Uploading an `.exe` renamed to `.pdf`, a DOCX with macros, or a file over 10 MB is rejected.
- [ ] Downloads redirect to a signed URL valid for 60 s, served as an attachment.
- [ ] Deactivating a user ends their open session on the next request.
- [ ] An administrator is logged out after 30 minutes of inactivity, a user after 8 hours.
- [ ] The password reset response is identical for existing and unknown emails.

## Legal and data protection (Colombia)

- [ ] The privacy policy, data processing policy (Law 1581 of 2012), terms and cookie notice have been **reviewed by legal counsel**. Every `[PENDIENTE: …]` / `[PENDING: …]` is completed in `src/messages/*.json`, and the review banner has been removed or replaced.
- [ ] Contact details in the footer and the contact page are real, not placeholders.
- [ ] The database has been registered in the RNBD (Registro Nacional de Bases de Datos), if the organization is required to do so.
- [ ] Retention periods for audit logs and contact messages are defined, and a cleanup procedure exists.
- [ ] International data transfers (Supabase, Vercel, Resend, Upstash, Google, Sentry regions) have been documented.

## Dependencies and process

- [ ] `npm run check` passes (types, lint, unit tests, `npm audit --omit=dev` with no moderate or higher issues).
- [ ] `npm run test:integration` and `npm run test:e2e` pass against a fresh local stack (`npm run db:reset`).
- [ ] Dependencies are pinned (`save-exact`). A recurring task exists to update them and re-run the audit, for example Dependabot or Renovate opening PRs.
- [ ] Local test accounts (`*@test.local`) do not exist in production.
