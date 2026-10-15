-- Element — remove the blog.
--
-- The public blog was replaced by the IRS updates page (read from irs.gov, no
-- database), so posts, their translations and categories, the blog functions,
-- the scheduled-publishing job and the cover bucket policy are dropped.
--
-- The newsletter stays: it now emails an IRS update, so newsletter_sends keeps
-- its history but references the update by its irs.gov slug instead of a post.
--
-- Audit log entries about posts are kept (they are history, not blog data).

-- 1) Newsletter sends: post_id -> update_slug ---------------------------------
alter table public.newsletter_sends add column if not exists update_slug text
  check (update_slug is null or update_slug ~ '^[a-z0-9-]{1,300}$');
drop index if exists public.newsletter_sends_post_idx;
alter table public.newsletter_sends drop column if exists post_id;
create index if not exists newsletter_sends_update_idx on public.newsletter_sends (update_slug, created_at desc);

-- 2) Scheduled publishing job --------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'publish-scheduled-posts';

-- 3) Functions (every overload) ------------------------------------------------
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'publish_due_posts', 'post_is_visible', 'reading_minutes',
         'blog_list', 'blog_post', 'blog_categories', 'blog_sitemap', 'blog_feed', 'blog_article',
         'admin_save_post', 'admin_save_post_v2'
       )
  loop
    execute format('drop function %s', fn);
  end loop;
end
$$;

-- 4) Tables and types ------------------------------------------------------------
drop table if exists public.post_translations;
drop table if exists public.posts;
drop table if exists public.post_categories;
drop type if exists public.post_kind;
drop type if exists public.post_status;

-- 5) Cover images ----------------------------------------------------------------
drop policy if exists blog_covers_objects_select on storage.objects;

-- Supabase does not allow deleting stored files with SQL. An empty bucket is
-- removed here; if covers were uploaded, delete the "blog-covers" bucket from
-- the dashboard (Storage) instead.
do $$
begin
  delete from storage.buckets where id = 'blog-covers';
exception when others then
  raise notice 'blog-covers bucket not removed (%). Delete it from Storage in the dashboard.', sqlerrm;
end
$$;
