-- Element — client intake form ("What to bring").
--
-- A signed-in client fills out the intake form, attaches documents and signs it.
-- Everything is written ONLY by the server with the service role after
-- validation (same model as files and contact_messages): there are no client
-- insert/update policies for clients. The owner can read their own submissions;
-- administrators read all of them and mark them reviewed.
--
-- Objects (attachments and signature images) live in the private "files" bucket
-- under intake/<owner>/..., outside the files table, so they do not count toward
-- the storage quota and do not require upload access (can_upload).

-- ---------------------------------------------------------------------------
-- intake_submissions: one row per signed form. `data` holds the answers,
-- validated by the server (src/lib/intake/schema.ts).
-- ---------------------------------------------------------------------------
create table public.intake_submissions (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references public.profiles (id) on delete restrict,
  tax_year               smallint not null check (tax_year between 2000 and 2100),
  locale                 public.app_locale not null default 'en',
  taxpayer_name          text not null check (char_length(taxpayer_name) between 1 and 200),
  filing_status          text not null check (filing_status in ('single', 'mfj', 'mfs', 'hoh', 'qss')),
  data                   jsonb not null,
  signer_name            text not null check (char_length(signer_name) between 1 and 200),
  signature_path         text not null,
  spouse_signer_name     text check (spouse_signer_name is null or char_length(spouse_signer_name) between 1 and 200),
  spouse_signature_path  text,
  signed_at              timestamptz not null default now(),
  signer_ip              inet,
  signer_user_agent      text check (signer_user_agent is null or char_length(signer_user_agent) <= 500),
  status                 text not null default 'new' check (status in ('new', 'reviewed')),
  reviewed_by            uuid references public.profiles (id) on delete set null,
  reviewed_at            timestamptz,
  created_at             timestamptz not null default now(),
  constraint intake_submissions_spouse_consistency check ((spouse_signer_name is null) = (spouse_signature_path is null))
);

create index intake_submissions_owner_idx on public.intake_submissions (owner_id, created_at desc);
create index intake_submissions_status_idx on public.intake_submissions (status, created_at desc);
create index intake_submissions_name_trgm_idx on public.intake_submissions using gin (taxpayer_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- intake_uploads: documents attached to the form. A row is created with a
-- signed upload URL (pending), verified by the server (checksum set), and
-- attached when the form is submitted (submission_id set). Unattached rows
-- expire and are cleaned up by the purge-trash function.
-- ---------------------------------------------------------------------------
create table public.intake_uploads (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  submission_id    uuid references public.intake_submissions (id) on delete cascade,
  doc_type         text not null check (doc_type in (
                     'id', 'ssn', 'dependents', 'income', 'deductions', 'education',
                     'health', 'prior_return', 'irs_letters', 'business', 'other'
                   )),
  original_name    text not null check (char_length(original_name) between 1 and 255),
  storage_path     text not null unique,
  mime_type        text not null check (mime_type in (
                     'application/pdf',
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                     'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                     'image/jpeg',
                     'image/png'
                   )),
  size_bytes       bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  checksum_sha256  text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now()
);

create index intake_uploads_submission_idx on public.intake_uploads (submission_id, created_at);
create index intake_uploads_owner_pending_idx on public.intake_uploads (owner_id) where submission_id is null;
create index intake_uploads_expires_idx on public.intake_uploads (expires_at) where submission_id is null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.intake_submissions enable row level security;
alter table public.intake_uploads     enable row level security;

revoke all on public.intake_submissions, public.intake_uploads from anon;

create policy intake_submissions_select_own on public.intake_submissions
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_active_user()));

create policy intake_submissions_select_admin on public.intake_submissions
  for select to authenticated
  using ((select public.is_admin()));

create policy intake_submissions_update_admin on public.intake_submissions
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Only attached documents are visible to the owner; pending ones are handled by the server.
create policy intake_uploads_select_own on public.intake_uploads
  for select to authenticated
  using (owner_id = (select auth.uid()) and submission_id is not null and (select public.is_active_user()));

create policy intake_uploads_select_admin on public.intake_uploads
  for select to authenticated
  using ((select public.is_admin()));

-- Administrators may only change the review state, never the signed answers.
revoke update on public.intake_submissions from authenticated;
grant update (status, reviewed_by, reviewed_at) on public.intake_submissions to authenticated;
