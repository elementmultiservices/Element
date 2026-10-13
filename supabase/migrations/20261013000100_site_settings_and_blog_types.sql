-- Element — editable business details and richer blog posts.
--
-- 1) site_settings: a single row with the contact details, location, opening
--    hours and the top announcement bar, editable by admins from the panel and
--    readable by everyone (it is public information shown on the site).
-- 2) posts: kind (article or quick update), featured flag and official source.
--    New read/write functions (blog_feed, blog_article, admin_save_post_v2) are
--    added next to the existing ones, so the application keeps working while
--    this migration is pending.

-- ---------------------------------------------------------------------------
-- site_settings (singleton row: id is always true)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id                     boolean primary key default true check (id),
  phone                  text not null default '' check (char_length(phone) <= 40),
  whatsapp               text not null default '' check (whatsapp ~ '^[0-9]{0,15}$'),
  email                  text not null default '' check (char_length(email) <= 254),
  address                text not null default '' check (char_length(address) <= 300),
  maps_url               text not null default '' check (maps_url = '' or (maps_url ~ '^https://' and char_length(maps_url) <= 1000)),
  booking_url            text not null default '' check (booking_url = '' or (booking_url ~ '^https://' and char_length(booking_url) <= 1000)),
  hours_regular_es       text not null default '' check (char_length(hours_regular_es) <= 1000),
  hours_regular_en       text not null default '' check (char_length(hours_regular_en) <= 1000),
  hours_season_es        text not null default '' check (char_length(hours_season_es) <= 1000),
  hours_season_en        text not null default '' check (char_length(hours_season_en) <= 1000),
  announcement_enabled   boolean not null default true,
  announcement_label_es  text not null default '' check (char_length(announcement_label_es) <= 40),
  announcement_label_en  text not null default '' check (char_length(announcement_label_en) <= 40),
  announcement_text_es   text not null default '' check (char_length(announcement_text_es) <= 200),
  announcement_text_en   text not null default '' check (char_length(announcement_text_en) <= 200),
  updated_by             uuid references public.profiles (id) on delete set null,
  updated_at             timestamptz not null default now()
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

insert into public.site_settings (
  phone, whatsapp, email, address,
  hours_regular_es, hours_regular_en, hours_season_es, hours_season_en,
  announcement_label_es, announcement_label_en, announcement_text_es, announcement_text_en
) values (
  '+1 (917) 890-0892', '19178900892', '', '',
  E'Lun – Vie · 10:00 a. m. – 6:00 p. m.\nSábados · con cita\nDomingos · cerrado',
  E'Mon – Fri · 10:00 a.m. – 6:00 p.m.\nSaturday · by appointment\nSunday · closed',
  E'Lun – Sáb · 9:00 a. m. – 8:00 p. m.\nDomingos · con cita',
  E'Mon – Sat · 9:00 a.m. – 8:00 p.m.\nSunday · by appointment',
  '15 OCT', 'OCT 15',
  '¿Pediste extensión? Te ayudamos a presentar tu declaración a tiempo.',
  'Filed an extension? We''ll help you file your return on time.'
);

alter table public.site_settings enable row level security;

create policy site_settings_select_public on public.site_settings
  for select to anon, authenticated
  using (true);

create policy site_settings_update_admin on public.site_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- No insert/delete for anyone but the service role: the row always exists.
revoke insert, delete, truncate on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

-- ---------------------------------------------------------------------------
-- posts: kind, featured, official source
-- ---------------------------------------------------------------------------
create type public.post_kind as enum ('article', 'update');

alter table public.posts
  add column kind        public.post_kind not null default 'article',
  add column is_featured boolean not null default false,
  add column source_url  text check (source_url is null or (source_url ~ '^https://' and char_length(source_url) <= 1000));

-- At most one featured post.
create unique index posts_single_featured_idx on public.posts (is_featured) where is_featured;

-- Estimated reading time from the stored HTML (about 1,100 characters a minute).
create or replace function public.reading_minutes(p_html text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(1, ceil(char_length(regexp_replace(coalesce(p_html, ''), '<[^>]*>', '', 'g')) / 1100.0))::integer;
$$;

-- Listing with optional category and kind filters.
create or replace function public.blog_feed(
  p_locale   public.app_locale,
  p_category text default null,
  p_kind     public.post_kind default null,
  p_limit    integer default 9,
  p_offset   integer default 0
)
returns table (
  post_id         uuid,
  title           text,
  slug            text,
  excerpt         text,
  cover_path      text,
  published_at    timestamptz,
  category_name   text,
  category_slug   text,
  kind            public.post_kind,
  is_featured     boolean,
  reading_minutes integer,
  total_count     bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    t.title,
    t.slug,
    t.excerpt,
    p.cover_path,
    p.published_at,
    case when p_locale = 'es' then c.name_es else c.name_en end,
    case when p_locale = 'es' then c.slug_es else c.slug_en end,
    p.kind,
    p.is_featured,
    public.reading_minutes(t.content),
    count(*) over ()
  from public.posts p
  join public.post_translations t on t.post_id = p.id and t.locale = p_locale
  left join public.post_categories c on c.id = p.category_id
  where public.post_is_visible(p.status, p.published_at)
    and (p_category is null or c.slug_en = p_category or c.slug_es = p_category)
    and (p_kind is null or p.kind = p_kind)
  order by p.published_at desc, p.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

-- Single post (same rules as blog_post) with the new fields.
create or replace function public.blog_article(p_locale public.app_locale, p_slug text)
returns table (
  post_id         uuid,
  title           text,
  slug            text,
  excerpt         text,
  content         text,
  cover_path      text,
  published_at    timestamptz,
  updated_at      timestamptz,
  category_name   text,
  category_slug   text,
  slugs           jsonb,
  kind            public.post_kind,
  source_url      text,
  reading_minutes integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    b.post_id, b.title, b.slug, b.excerpt, b.content, b.cover_path, b.published_at, b.updated_at,
    b.category_name, b.category_slug, b.slugs,
    p.kind, p.source_url, public.reading_minutes(b.content)
  from public.blog_post(p_locale, p_slug) b
  join public.posts p on p.id = b.post_id;
$$;

grant execute on function public.reading_minutes(text) to anon, authenticated;
grant execute on function public.blog_feed(public.app_locale, text, public.post_kind, integer, integer) to anon, authenticated;
grant execute on function public.blog_article(public.app_locale, text) to anon, authenticated;

-- Save with the new fields. Featuring a post un-features the previous one.
create or replace function public.admin_save_post_v2(
  p_status       public.post_status,
  p_translations jsonb,
  p_id           uuid default null,
  p_published_at timestamptz default null,
  p_category_id  uuid default null,
  p_kind         public.post_kind default 'article',
  p_featured     boolean default false,
  p_source_url   text default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_featured then
    update public.posts set is_featured = false
     where is_featured and (p_id is null or id <> p_id);
  end if;

  v_id := public.admin_save_post(p_status, p_translations, p_id, p_published_at, p_category_id);

  update public.posts
     set kind = p_kind,
         is_featured = p_featured,
         source_url = nullif(trim(p_source_url), '')
   where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_save_post_v2(public.post_status, jsonb, uuid, timestamptz, uuid, public.post_kind, boolean, text) from public, anon;
grant execute on function public.admin_save_post_v2(public.post_status, jsonb, uuid, timestamptz, uuid, public.post_kind, boolean, text) to authenticated;
