-- Element — atomic save of a post and its translations.
-- SECURITY INVOKER: runs with the caller's privileges, so the admin RLS
-- policies (is_admin(): active admin + MFA session) govern every write.
-- Any failure (e.g. a duplicate slug) rolls back the whole save.
--
-- p_translations: {"en": {"title","slug","excerpt","content"}, "es": {...}}.
-- Locales absent from the payload are removed (the translation was emptied).

create or replace function public.admin_save_post(
  p_status public.post_status,
  p_translations jsonb,
  p_id uuid default null,
  p_published_at timestamptz default null,
  p_category_id uuid default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_locale text;
  v_t jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_translations) <> 'object' or (select count(*) from jsonb_object_keys(p_translations)) = 0 then
    raise exception 'translation_required' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.posts (status, published_at, category_id, author_id)
    values (p_status, p_published_at, p_category_id, (select auth.uid()))
    returning id into v_id;
  else
    update public.posts
       set status = p_status, published_at = p_published_at, category_id = p_category_id
     where id = v_id;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.post_translations
   where post_id = v_id and not (p_translations ? locale::text);

  for v_locale, v_t in select key, value from jsonb_each(p_translations) loop
    insert into public.post_translations (post_id, locale, title, slug, excerpt, content)
    values (
      v_id,
      v_locale::public.app_locale,
      v_t ->> 'title',
      v_t ->> 'slug',
      coalesce(v_t ->> 'excerpt', ''),
      coalesce(v_t ->> 'content', '')
    )
    on conflict (post_id, locale) do update
      set title = excluded.title,
          slug = excluded.slug,
          excerpt = excluded.excerpt,
          content = excluded.content;
  end loop;

  -- Touch the post so updated_at reflects translation edits too.
  update public.posts set updated_at = now() where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_save_post(public.post_status, jsonb, uuid, timestamptz, uuid) from public, anon;
grant execute on function public.admin_save_post(public.post_status, jsonb, uuid, timestamptz, uuid) to authenticated;
