-- Element — public blog read model.
-- SECURITY INVOKER functions (RLS still applies) that ALSO filter visibility
-- explicitly, so signed-in admins browsing the public site never see drafts or
-- future scheduled posts. A post appears in a locale only if it has a
-- translation for that locale.

create or replace function public.post_is_visible(p_status public.post_status, p_published_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'published' or (p_status = 'scheduled' and p_published_at <= now());
$$;

-- Listing with optional category (slug in either language) and pagination.
create or replace function public.blog_list(
  p_locale public.app_locale,
  p_category text default null,
  p_limit integer default 9,
  p_offset integer default 0
)
returns table (
  post_id uuid,
  title text,
  slug text,
  excerpt text,
  cover_path text,
  published_at timestamptz,
  category_name text,
  category_slug text,
  total_count bigint
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
    count(*) over ()
  from public.posts p
  join public.post_translations t on t.post_id = p.id and t.locale = p_locale
  left join public.post_categories c on c.id = p.category_id
  where public.post_is_visible(p.status, p.published_at)
    and (p_category is null or c.slug_en = p_category or c.slug_es = p_category)
  order by p.published_at desc, p.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

-- Single post by slug. The slug may belong to any locale (e.g. after a language
-- switch); the requested locale's translation is returned when it exists
-- (title is null otherwise). `slugs` maps each available locale to its slug.
create or replace function public.blog_post(p_locale public.app_locale, p_slug text)
returns table (
  post_id uuid,
  title text,
  slug text,
  excerpt text,
  content text,
  cover_path text,
  published_at timestamptz,
  updated_at timestamptz,
  category_name text,
  category_slug text,
  slugs jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with target as (
    select t0.post_id
    from public.post_translations t0
    join public.posts p0 on p0.id = t0.post_id
    where t0.slug = p_slug and public.post_is_visible(p0.status, p0.published_at)
    order by (t0.locale = p_locale) desc
    limit 1
  )
  select
    p.id,
    t.title,
    t.slug,
    t.excerpt,
    t.content,
    p.cover_path,
    p.published_at,
    greatest(p.updated_at, coalesce(t.updated_at, p.updated_at)),
    case when p_locale = 'es' then c.name_es else c.name_en end,
    case when p_locale = 'es' then c.slug_es else c.slug_en end,
    (select jsonb_object_agg(t2.locale, t2.slug) from public.post_translations t2 where t2.post_id = p.id)
  from target
  join public.posts p on p.id = target.post_id
  left join public.post_translations t on t.post_id = p.id and t.locale = p_locale
  left join public.post_categories c on c.id = p.category_id;
$$;

-- Categories that have at least one visible post in the locale.
create or replace function public.blog_categories(p_locale public.app_locale)
returns table (name text, slug text, post_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case when p_locale = 'es' then c.name_es else c.name_en end,
    case when p_locale = 'es' then c.slug_es else c.slug_en end,
    count(*)
  from public.post_categories c
  join public.posts p on p.category_id = c.id
  join public.post_translations t on t.post_id = p.id and t.locale = p_locale
  where public.post_is_visible(p.status, p.published_at)
  group by c.id, c.name_en, c.name_es, c.slug_en, c.slug_es
  order by 1;
$$;

-- Sitemap entries for every visible post.
create or replace function public.blog_sitemap()
returns table (post_id uuid, slugs jsonb, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, jsonb_object_agg(t.locale, t.slug), max(greatest(p.updated_at, t.updated_at))
  from public.posts p
  join public.post_translations t on t.post_id = p.id
  where public.post_is_visible(p.status, p.published_at)
  group by p.id;
$$;

grant execute on function public.post_is_visible(public.post_status, timestamptz) to anon, authenticated;
grant execute on function public.blog_list(public.app_locale, text, integer, integer) to anon, authenticated;
grant execute on function public.blog_post(public.app_locale, text) to anon, authenticated;
grant execute on function public.blog_categories(public.app_locale) to anon, authenticated;
grant execute on function public.blog_sitemap() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit labels for posts, post categories and contact messages.
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_audit(
  p_q       text default null,
  p_action  text default null,
  p_actor   text default null,
  p_subject uuid default null,
  p_from    date default null,
  p_to      date default null,
  p_limit   integer default 50,
  p_offset  integer default 0
)
returns table (
  id bigint,
  created_at timestamptz,
  action text,
  actor_id uuid,
  actor_email text,
  actor_name text,
  target_type text,
  target_id text,
  target_label text,
  metadata jsonb,
  ip inet,
  user_agent text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := case when nullif(trim(p_q), '') is null then null else '%' || public.like_escape(trim(p_q)) || '%' end;
  v_actor text := case when nullif(trim(p_actor), '') is null then null else '%' || public.like_escape(trim(p_actor)) || '%' end;
  v_action text := case when nullif(trim(p_action), '') is null then null else public.like_escape(trim(p_action)) || '%' end;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with rows as (
    select
      a.*,
      au.email::text as actor_email,
      ap.full_name as actor_name,
      case a.target_type
        when 'user' then (select tu.email::text from auth.users tu where tu.id::text = a.target_id)
        when 'file' then coalesce((select f.original_name from public.files f where f.id::text = a.target_id), a.metadata ->> 'original_name')
        when 'category' then (select c.name_en || ' / ' || c.name_es from public.file_categories c where c.id::text = a.target_id)
        when 'post' then coalesce(
          (select string_agg(pt.title, ' / ' order by pt.locale) from public.post_translations pt where pt.post_id::text = a.target_id),
          a.metadata ->> 'title')
        when 'post_category' then coalesce(
          (select pc.name_en || ' / ' || pc.name_es from public.post_categories pc where pc.id::text = a.target_id),
          a.metadata ->> 'name')
        when 'contact' then (select cm.subject from public.contact_messages cm where cm.id::text = a.target_id)
        else null
      end as target_label
    from public.audit_logs a
    left join auth.users au on au.id = a.actor_id
    left join public.profiles ap on ap.id = a.actor_id
    where (v_action is null or a.action like v_action)
      and (p_subject is null or a.actor_id = p_subject or (a.target_type = 'user' and a.target_id = p_subject::text)
           or (a.metadata ->> 'owner_id') = p_subject::text)
      and (p_from is null or a.created_at >= (p_from::timestamp at time zone 'America/Bogota'))
      and (p_to is null or a.created_at < ((p_to + 1)::timestamp at time zone 'America/Bogota'))
      and (v_actor is null or au.email ilike v_actor or ap.full_name ilike v_actor)
  )
  select r.id, r.created_at, r.action, r.actor_id, r.actor_email, r.actor_name, r.target_type, r.target_id,
         r.target_label, r.metadata, r.ip, r.user_agent, count(*) over ()::bigint
  from rows r
  where v_q is null
     or r.action ilike v_q
     or r.target_id ilike v_q
     or r.target_label ilike v_q
     or r.actor_email ilike v_q
     or host(r.ip) ilike v_q
     or r.metadata::text ilike v_q
  order by r.created_at desc, r.id desc
  limit least(greatest(p_limit, 1), 50000)
  offset greatest(p_offset, 0);
end;
$$;
