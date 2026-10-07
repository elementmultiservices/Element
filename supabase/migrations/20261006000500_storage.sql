-- Element — Storage buckets and policies.

-- Private bucket for user files. Size and MIME limits are enforced by Storage
-- itself in addition to the server-side checks (magic bytes, quota, etc.).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files',
  'files',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket for blog cover images (public content by definition).
-- Only the server (service role) writes to it, after admin checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-covers', 'blog-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects in "files" are readable only by their owner (if the file row is not
-- trashed and the account is active) or by an admin with MFA. There are no
-- insert/update/delete policies: uploads use server-issued signed upload URLs
-- and every other mutation is done by the server with the service role.
create policy files_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'files'
    and (
      (select public.is_admin())
      or exists (
        select 1 from public.files f
        where f.storage_path = storage.objects.name
          and f.owner_id = (select auth.uid())
          and f.deleted_at is null
          and (select public.is_active_user())
      )
    )
  );

create policy blog_covers_objects_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'blog-covers');
