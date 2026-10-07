-- Element — Row Level Security. Every table has RLS enabled and at least one policy.
-- Writes that need server-side verification (file rows, contact messages, audit
-- entries) have NO client policy: they are performed only by the server with the
-- service role after validation.

alter table public.profiles          enable row level security;
alter table public.file_categories   enable row level security;
alter table public.files             enable row level security;
alter table public.upload_intents    enable row level security;
alter table public.post_categories   enable row level security;
alter table public.posts             enable row level security;
alter table public.post_translations enable row level security;
alter table public.contact_messages  enable row level security;
alter table public.audit_logs        enable row level security;

-- Belt and braces: anonymous visitors never touch private tables.
revoke all on public.profiles, public.file_categories, public.files, public.upload_intents,
              public.contact_messages, public.audit_logs from anon;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) and (select public.is_active_user()));

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

-- Column-level restrictions are enforced by the protect_profile_columns trigger.
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select public.is_active_user()))
  with check (id = (select auth.uid()));

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- file_categories (users need names for filters; only admins manage them)
-- ---------------------------------------------------------------------------
create policy file_categories_select_active_users on public.file_categories
  for select to authenticated
  using ((select public.is_active_user()));

create policy file_categories_insert_admin on public.file_categories
  for insert to authenticated
  with check ((select public.is_admin()));

create policy file_categories_update_admin on public.file_categories
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- files
-- ---------------------------------------------------------------------------
create policy files_select_own_not_trashed on public.files
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    and deleted_at is null
    and (select public.is_active_user())
  );

create policy files_select_admin on public.files
  for select to authenticated
  using ((select public.is_admin()));

-- Trash / restore / metadata edits.
create policy files_update_admin on public.files
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Permanent deletion only from the trash.
create policy files_delete_admin_trashed on public.files
  for delete to authenticated
  using ((select public.is_admin()) and deleted_at is not null);

-- ---------------------------------------------------------------------------
-- upload_intents (created/consumed by the server; readable for transparency)
-- ---------------------------------------------------------------------------
create policy upload_intents_select_own on public.upload_intents
  for select to authenticated
  using (requested_by = (select auth.uid()) and (select public.is_active_user()));

create policy upload_intents_select_admin on public.upload_intents
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Blog: public read of published content, admin management.
-- A scheduled post becomes visible as soon as published_at is reached.
-- ---------------------------------------------------------------------------
create policy post_categories_select_public on public.post_categories
  for select to anon, authenticated
  using (true);

create policy post_categories_insert_admin on public.post_categories
  for insert to authenticated
  with check ((select public.is_admin()));

create policy post_categories_update_admin on public.post_categories
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy post_categories_delete_admin on public.post_categories
  for delete to authenticated
  using ((select public.is_admin()));

create policy posts_select_public on public.posts
  for select to anon, authenticated
  using (
    status = 'published'
    or (status = 'scheduled' and published_at <= now())
  );

create policy posts_select_admin on public.posts
  for select to authenticated
  using ((select public.is_admin()));

create policy posts_insert_admin on public.posts
  for insert to authenticated
  with check ((select public.is_admin()) and author_id = (select auth.uid()));

create policy posts_update_admin on public.posts
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy posts_delete_admin on public.posts
  for delete to authenticated
  using ((select public.is_admin()));

create policy post_translations_select_public on public.post_translations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and (p.status = 'published' or (p.status = 'scheduled' and p.published_at <= now()))
    )
  );

create policy post_translations_select_admin on public.post_translations
  for select to authenticated
  using ((select public.is_admin()));

create policy post_translations_insert_admin on public.post_translations
  for insert to authenticated
  with check ((select public.is_admin()));

create policy post_translations_update_admin on public.post_translations
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy post_translations_delete_admin on public.post_translations
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- contact_messages (inserted by the server after reCAPTCHA + rate limit)
-- ---------------------------------------------------------------------------
create policy contact_messages_select_admin on public.contact_messages
  for select to authenticated
  using ((select public.is_admin()));

create policy contact_messages_update_admin on public.contact_messages
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- audit_logs: admins read; nobody updates or deletes (see trigger).
-- Users read their own sign-in activity through public.my_auth_activity().
-- ---------------------------------------------------------------------------
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select public.is_admin()));
