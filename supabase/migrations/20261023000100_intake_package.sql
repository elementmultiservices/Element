-- Element — intake form becomes the "New Client Package" (intake, service
-- agreement and documents). Adds the "not sure" filing status, how each
-- signature was made (drawn, typed or uploaded image) and the agreement
-- confirmations. Safe whether or not 20261022000100_intake_forms ran before.

alter table public.intake_submissions drop constraint if exists intake_submissions_filing_status_check;
alter table public.intake_submissions
  add constraint intake_submissions_filing_status_check
  check (filing_status in ('single', 'mfj', 'mfs', 'hoh', 'qss', 'unsure'));

alter table public.intake_submissions
  add column if not exists signature_method text not null default 'draw'
    check (signature_method in ('draw', 'type', 'upload')),
  add column if not exists spouse_signature_method text
    check (spouse_signature_method is null or spouse_signature_method in ('draw', 'type', 'upload')),
  add column if not exists pub135_acknowledged boolean not null default false,
  add column if not exists agreement_accepted boolean not null default false;
