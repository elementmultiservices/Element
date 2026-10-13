-- Element — newsletter: people who sign up to receive news, and a record of
-- every post emailed to them.
--
-- Sign-ups arrive through a public form and are written ONLY by the server with
-- the service role after validation, rate limiting and reCAPTCHA (same model as
-- contact_messages): there is no public insert policy. Each subscriber has a
-- random token used by the unsubscribe link in every email.

create table public.newsletter_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  locale            public.app_locale not null default 'es',
  source            text not null default 'footer' check (source in ('footer', 'home', 'blog', 'admin')),
  unsubscribe_token uuid not null default gen_random_uuid(),
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint newsletter_subscribers_email_key unique (email),
  constraint newsletter_subscribers_token_key unique (unsubscribe_token)
);

create index newsletter_subscribers_active_idx on public.newsletter_subscribers (created_at desc) where unsubscribed_at is null;

create trigger newsletter_subscribers_set_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

-- One row per newsletter email sent for a post.
create table public.newsletter_sends (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.posts (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 200),
  recipients  integer not null default 0 check (recipients >= 0),
  failed      integer not null default 0 check (failed >= 0),
  sent_by     uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index newsletter_sends_post_idx on public.newsletter_sends (post_id, created_at desc);

alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_sends       enable row level security;

revoke all on public.newsletter_subscribers, public.newsletter_sends from anon;

-- Admins read and manage the list; inserts happen on the server (service role).
create policy newsletter_subscribers_select_admin on public.newsletter_subscribers
  for select to authenticated
  using ((select public.is_admin()));

create policy newsletter_subscribers_update_admin on public.newsletter_subscribers
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy newsletter_subscribers_delete_admin on public.newsletter_subscribers
  for delete to authenticated
  using ((select public.is_admin()));

create policy newsletter_sends_select_admin on public.newsletter_sends
  for select to authenticated
  using ((select public.is_admin()));
