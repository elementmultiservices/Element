-- Element — tables, constraints and indexes.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. The role lives here, never in user_metadata.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  full_name           text not null default '' check (char_length(full_name) <= 120),
  role                public.user_role not null default 'user',
  is_active           boolean not null default true,
  preferred_locale    public.app_locale not null default 'en',
  storage_quota_bytes bigint not null default 524288000 check (storage_quota_bytes >= 0),
  created_at          timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_full_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- file_categories
-- ---------------------------------------------------------------------------
create table public.file_categories (
  id          uuid primary key default gen_random_uuid(),
  name_en     text not null check (char_length(name_en) between 1 and 80),
  name_es     text not null check (char_length(name_es) between 1 and 80),
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- files: metadata only; the object lives in the private "files" bucket under a
-- random UUID path. original_name is never used as a storage key.
-- ---------------------------------------------------------------------------
create table public.files (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete restrict,
  uploaded_by      uuid not null references public.profiles (id) on delete restrict,
  category_id      uuid references public.file_categories (id) on delete set null,
  original_name    text not null check (char_length(original_name) between 1 and 255),
  description      text check (description is null or char_length(description) <= 1000),
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
  checksum_sha256  text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  deleted_at       timestamptz,
  deleted_by       uuid references public.profiles (id) on delete restrict,
  created_at       timestamptz not null default now(),
  constraint files_deleted_consistency check ((deleted_at is null) = (deleted_by is null))
);

create index files_owner_active_idx on public.files (owner_id, created_at desc) where deleted_at is null;
create index files_trash_idx on public.files (deleted_at) where deleted_at is not null;
create index files_category_idx on public.files (category_id);
create index files_uploaded_by_idx on public.files (uploaded_by);
create index files_mime_idx on public.files (mime_type);
create index files_created_idx on public.files (created_at desc);
create index files_name_trgm_idx on public.files using gin (original_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- upload_intents: issued by the server together with a signed upload URL.
-- The confirm step only accepts objects that match an unexpired, unconsumed
-- intent belonging to the caller.
-- ---------------------------------------------------------------------------
create table public.upload_intents (
  id              uuid primary key default gen_random_uuid(),
  requested_by    uuid not null references public.profiles (id) on delete cascade,
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  storage_path    text not null unique,
  original_name   text not null check (char_length(original_name) between 1 and 255),
  description     text check (description is null or char_length(description) <= 1000),
  category_id     uuid references public.file_categories (id) on delete set null,
  declared_mime   text not null,
  declared_size   bigint not null check (declared_size > 0 and declared_size <= 10485760),
  expires_at      timestamptz not null,
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index upload_intents_owner_pending_idx on public.upload_intents (owner_id) where consumed_at is null;
create index upload_intents_expires_idx on public.upload_intents (expires_at) where consumed_at is null;

-- ---------------------------------------------------------------------------
-- Blog
-- ---------------------------------------------------------------------------
create table public.post_categories (
  id         uuid primary key default gen_random_uuid(),
  name_en    text not null check (char_length(name_en) between 1 and 80),
  name_es    text not null check (char_length(name_es) between 1 and 80),
  slug_en    text not null unique check (slug_en ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug_en) <= 100),
  slug_es    text not null unique check (slug_es ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug_es) <= 100),
  created_at timestamptz not null default now()
);

create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  cover_path   text,
  status       public.post_status not null default 'draft',
  author_id    uuid not null references public.profiles (id) on delete restrict,
  category_id  uuid references public.post_categories (id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint posts_published_at_required check (status = 'draft' or published_at is not null)
);

create index posts_public_idx on public.posts (status, published_at desc);
create index posts_category_idx on public.posts (category_id);

create table public.post_translations (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  locale     public.app_locale not null,
  title      text not null check (char_length(title) between 1 and 200),
  slug       text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 200),
  excerpt    text not null default '' check (char_length(excerpt) <= 500),
  content    text not null default '' check (char_length(content) <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_translations_post_locale_key unique (post_id, locale),
  constraint post_translations_locale_slug_key unique (locale, slug)
);

-- ---------------------------------------------------------------------------
-- contact_messages
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 254),
  subject     text not null check (char_length(subject) between 1 and 200),
  message     text not null check (char_length(message) between 1 and 5000),
  locale      public.app_locale not null default 'en',
  is_handled  boolean not null default false,
  handled_by  uuid references public.profiles (id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index contact_messages_pending_idx on public.contact_messages (is_handled, created_at desc);

-- ---------------------------------------------------------------------------
-- audit_logs: append-only (enforced by trigger, see functions migration).
-- actor_id deliberately has no foreign key so log rows are never rewritten.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null check (char_length(action) between 1 and 100),
  target_type text check (target_type is null or char_length(target_type) <= 50),
  target_id   text check (target_id is null or char_length(target_id) <= 100),
  metadata    jsonb not null default '{}'::jsonb,
  ip          inet,
  user_agent  text check (user_agent is null or char_length(user_agent) <= 500),
  created_at  timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);
