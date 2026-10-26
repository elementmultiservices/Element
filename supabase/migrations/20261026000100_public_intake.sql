-- Element — public intake form. Anyone can fill out the New Client Package
-- without an account; staff then assign each form to a client account (an
-- existing one, usually the one that uses the email typed in the form, or a new
-- one invited with that email).
--
-- Anonymous visitors are identified only by a signed draft token issued with
-- the page (src/lib/security/form-token.ts): their pending documents carry the
-- draft id instead of an owner, and a submission records it so a draft can be
-- submitted only once. Everything is still written by the server with the
-- service role; no new client policies. Unassigned forms are visible to
-- administrators only (the owner policies match on owner_id).

-- ---------------------------------------------------------------------------
-- intake_submissions
-- ---------------------------------------------------------------------------
alter table public.intake_submissions alter column owner_id drop not null;

alter table public.intake_submissions
  add column if not exists contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  add column if not exists draft_id uuid,
  add column if not exists assigned_by uuid references public.profiles (id) on delete set null,
  add column if not exists assigned_at timestamptz;

update public.intake_submissions
set contact_email = lower(data -> 'taxpayer' ->> 'email')
where contact_email is null;

create unique index if not exists intake_submissions_draft_key on public.intake_submissions (draft_id) where draft_id is not null;
create index if not exists intake_submissions_unassigned_idx on public.intake_submissions (created_at desc) where owner_id is null;
create index if not exists intake_submissions_contact_email_idx on public.intake_submissions (contact_email);

-- ---------------------------------------------------------------------------
-- intake_uploads: a pending document belongs to an account or to a draft;
-- once attached, the submission decides (owner_id follows the assignment).
-- ---------------------------------------------------------------------------
alter table public.intake_uploads alter column owner_id drop not null;
alter table public.intake_uploads add column if not exists draft_id uuid;

alter table public.intake_uploads drop constraint if exists intake_uploads_owner_or_draft;
alter table public.intake_uploads
  add constraint intake_uploads_owner_or_draft
  check (owner_id is not null or draft_id is not null or submission_id is not null);

create index if not exists intake_uploads_draft_pending_idx on public.intake_uploads (draft_id) where submission_id is null;
