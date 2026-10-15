-- Element — audit search without the blog tables.
--
-- admin_search_audit looked up post titles in public.post_translations and
-- public.post_categories, which 20261015000200_remove_blog dropped; plpgsql
-- does not record that dependency, so the function failed at run time (admin
-- overview and audit log). Old post entries now show the title stored in their
-- metadata, and newsletter sends of IRS updates show the update title.
-- create or replace keeps the existing grants.

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
        when 'post' then a.metadata ->> 'title'
        when 'post_category' then a.metadata ->> 'name'
        when 'update' then a.metadata ->> 'title'
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
