# Element

Element is a file management web application with an institutional blog. It runs on
Next.js (App Router) and Supabase, is bilingual (English/Spanish), and is built with
security as a primary requirement.

> **Status:** Phases 1 (foundation) and 2 (user dashboard) complete. Later phases add the
> admin panel, the blog and public site, and production hardening. Sections marked
> _(phase N)_ are completed in that phase.

## Stack

| Concern | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, strict TypeScript), deployed on Vercel |
| Data / Auth / Files | Supabase: Postgres with RLS, Auth (TOTP MFA), private Storage |
| UI | Tailwind CSS 4, shadcn/ui (Radix), IBM Plex Sans |
| i18n | next-intl (`/en/...`, `/es/...`) |
| Validation | Zod (server-side on every input) |
| Abuse prevention | reCAPTCHA v3 (server-verified), Upstash Redis rate limiting |
| Email | Resend + React Email |
| Monitoring | Sentry _(phase 5)_ |

## Local development

### Prerequisites

- Node.js 22.12+ (24 recommended)
- Docker Desktop (for the local Supabase stack)

### 1. Install

```bash
npm ci
```

### 2. Start Supabase locally

```bash
cp supabase/functions/.env.example supabase/functions/.env
npm run db:start      # applies supabase/migrations and supabase/seed.sql
```

The local stack uses ports **544xx** so it can run next to other Supabase projects:
API `http://127.0.0.1:54421`, Studio `http://127.0.0.1:54423`, Mailpit `http://127.0.0.1:54424`.
`npm run db:start` prints the publishable key and the secret key.

### 3. Configure the environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (the secret key)
and a random `SESSION_SECRET`. In development, reCAPTCHA, Upstash and Resend may stay empty:

- reCAPTCHA checks are skipped,
- rate limiting uses an in-memory store,
- emails (including invitation and reset links) are printed to the server console.

These fallbacks are **refused in production builds**: the server will not start without the
real credentials.

### 4. Create the first administrator

Run this in an interactive terminal (PowerShell or Windows Terminal on Windows):

```bash
npm run admin:create -- --email admin@example.com --name "Full Name" --locale en
```

You will be asked for the password (12+ characters, upper/lowercase and digits). It is never
echoed or logged. On first sign-in the administrator must set up two-step verification (TOTP).

### 5. Run the app

```bash
npm run dev           # http://localhost:3100
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js development, build and start (port 3100) |
| `npm run lint` | ESLint (no `any`, locale-aware links enforced) |
| `npm run typecheck` | Route type generation + `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run audit:deps` | `npm audit` of production dependencies |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase lifecycle |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` |
| `npm run admin:create` | Bootstrap an administrator account |

## Supabase (cloud) setup

Use **separate projects** for development/preview and production, each with its own keys.

1. **Create the project** and link it: `npx supabase link --project-ref <ref>`.
2. **Apply the migrations**: `npx supabase db push`.
3. **Push the auth configuration** in `supabase/config.toml` (`npx supabase config push`), or set it in the dashboard:
   - Sign-ups **disabled** (Authentication → Sign In / Providers → "Allow new users to sign up" off). Keep the **Email provider enabled**.
   - Minimum password length **12**, requirement "lowercase, uppercase and digits".
   - Email OTP expiration **86400 s** (24 h).
   - MFA → TOTP **enabled**.
   - JWT expiry 900 s.
   - Site URL = your production URL; add it to the redirect allow list.
   - **Leaked password protection** (HaveIBeenPwned) requires the **Pro plan**. The project currently uses the Free plan, so turn this on when you upgrade. It is listed in the go-live checklist.
4. **Deploy the purge function and set its secret**:
   ```bash
   npx supabase functions deploy purge-trash --no-verify-jwt
   npx supabase secrets set PURGE_TRASH_SECRET=<random 48+ chars>
   ```
5. **Store the Vault secrets** used by the daily `purge-trash` cron job (SQL editor):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/purge-trash', 'purge_trash_url');
   select vault.create_secret('<same PURGE_TRASH_SECRET>', 'purge_trash_secret');
   ```
6. Create the first administrator with `npm run admin:create`, with `.env.local` pointing to that project.

## Third-party services

- **reCAPTCHA v3**: create a v3 site key restricted to your domains. Set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY`.
- **Upstash Redis**: create a Redis database (a region close to the Vercel functions). Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- **Resend**: verify the sending domain (SPF/DKIM). Set `RESEND_API_KEY` and `EMAIL_FROM`.
- **Sentry** _(phase 5)_.
- **Vercel deployment** _(phase 5)_.

## Architecture overview

```
src/
  app/[locale]/(site)/     public pages and auth pages (header + footer)
  app/[locale]/dashboard/  user panel (requireUser)
  app/[locale]/admin/      admin panel (requireAdmin, MFA)
  actions/                 server actions (each one re-checks authorization)
  components/              ui/ (shadcn), brand/Wordmark, layout/, forms/, states/
  i18n/                    routing, navigation, request config
  lib/auth/                session context, guards, inactivity cookie, auth links
  lib/security/            reCAPTCHA, rate limiting, request metadata, hashing
  lib/supabase/            server client (RLS), admin client (server-only), types
  lib/email/               Resend sender and institutional templates
  messages/                en.json, es.json
  proxy.ts                 locale + session + inactivity + role/MFA gate
supabase/
  migrations/              schema, functions, RLS, storage, cron
  functions/purge-trash/   retention job (30 days)
scripts/create-admin.ts
```

### Security model (summary)

- **RLS on every table and on Storage.** Users read only their own, non-trashed files. Admin
  rights require an active admin profile **and** an MFA-verified session (`aal2`), checked
  inside Postgres (`public.is_admin()`).
- **Role and status live in `profiles`.** A trigger blocks non-admins from changing `role`,
  `is_active` or the quota. Admins cannot change their own role or status, and the last active
  admin cannot be demoted.
- **Every request is checked** in `proxy.ts` (session, inactivity, active account, MFA, role),
  and every page, server action and route handler checks again through `requireUser` /
  `requireAdmin` / `authorize`.
- **Sessions:** HttpOnly + SameSite=Lax (+ Secure in production) cookies only; there is no
  browser Supabase client. Idle timeout is 30 min for admins and 8 h for users.
- **Sign-in:** reCAPTCHA, per-IP rate limit, per-account lockout (5 failures → 15 min), the same
  response and padded timing for every failure, and full audit trail.
- **Invitation and reset links** are single-use, expire after 24 h, and are only consumed by an
  explicit POST, so email link scanners cannot burn them.
- **`audit_logs` is append-only**, enforced by a trigger even for the service role.

### File upload and download flow

1. `POST /api/files/upload-intent` checks the session, same origin, reCAPTCHA, the per-IP and
   per-user rate limits, the name (one allowed extension, no double extensions), the MIME
   type, the size (10 MB max), the category and the remaining quota. It then records an
   intent and returns a signed upload URL for a random `pending/<uuid>` path.
2. The browser uploads the file **directly to Supabase Storage**. The file never passes
   through the Vercel function.
3. `POST /api/files/confirm` consumes the intent exactly once, downloads the object and
   verifies its real size, its content type and its magic bytes. It rejects PDF scripts or
   launch actions (including inside compressed streams), Office macros, ActiveX controls,
   embedded executables and decompression bombs. It then computes the SHA-256, re-checks
   the quota, moves the object to `<owner>/<uuid>` and only then inserts the `files` row.
   Rejected objects are deleted and the attempt is audited.
4. `GET /api/files/<id>/download` checks permissions with the user's own client (RLS on
   `files` and `storage.objects`), audits the download and redirects to a 60-second signed
   URL served with `Content-Disposition: attachment` and a sanitized name.

A daily cap of 50 authorized uploads per user applies (`DAILY_UPLOAD_CAP`).

Storage quota and usage are **never disclosed to regular users**. Quota checks run on the
server with the service role. `storage_usage()` is limited to admins and the service role, and
`profiles.storage_quota_bytes` is not readable by authenticated sessions (column privileges).
When the quota is exceeded, the user sees a neutral message asking them to contact the
administrator.

See `SECURITY-CHECKLIST.md` _(phase 5)_ before going live.

## Legal

Legal pages (privacy policy, personal data processing policy under Colombian Law 1581 of 2012,
terms of use, cookie notice) are added in phase 4 with placeholder text marked for legal review.
