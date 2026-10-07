-- Element — scheduled jobs (pg_cron).
--
-- 1) purge-trash (daily 03:00 UTC): invokes the "purge-trash" Edge Function,
--    which deletes files trashed more than 30 days ago (storage object first,
--    then the database row) and cleans up expired upload intents and their
--    pending objects. Storage objects cannot be deleted from SQL, hence the
--    Edge Function.
--    Required Vault secrets (see README):
--      - purge_trash_url     e.g. https://<project>.supabase.co/functions/v1/purge-trash
--      - purge_trash_secret  same value as the function's PURGE_TRASH_SECRET
--
-- 2) publish-scheduled-posts (every 5 minutes): flips due scheduled posts to
--    'published'. Visibility does not depend on it (RLS already shows due
--    scheduled posts); it keeps the status column accurate.

create or replace function public.invoke_purge_trash()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
  v_id     bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'purge_trash_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'purge_trash_secret';

  if v_url is null or v_secret is null then
    raise warning 'purge-trash: vault secrets purge_trash_url / purge_trash_secret are not configured';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 55000
  ) into v_id;

  return v_id;
end;
$$;

revoke all on function public.invoke_purge_trash() from public, anon, authenticated, service_role;

create or replace function public.publish_due_posts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.posts
     set status = 'published'
   where status = 'scheduled' and published_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.publish_due_posts() from public, anon, authenticated, service_role;

do $$
begin
  perform cron.unschedule(jobid) from cron.job
   where jobname in ('purge-trash', 'publish-scheduled-posts');
end;
$$;

select cron.schedule('purge-trash', '0 3 * * *', $$select public.invoke_purge_trash();$$);
select cron.schedule('publish-scheduled-posts', '*/5 * * * *', $$select public.publish_due_posts();$$);
