-- Element — local development seed (applied by `supabase db reset`). Never run in production.

-- Vault secrets for the purge-trash job, pointing at the local functions runtime.
-- The secret must match PURGE_TRASH_SECRET in supabase/functions/.env.
select vault.create_secret('http://host.docker.internal:54421/functions/v1/purge-trash', 'purge_trash_url');
select vault.create_secret('local-dev-purge-secret-change-me-0123456789', 'purge_trash_secret');

insert into public.file_categories (name_en, name_es) values
  ('Contracts', 'Contratos'),
  ('Invoices', 'Facturas'),
  ('Reports', 'Informes'),
  ('Certificates', 'Certificados');

insert into public.post_categories (name_en, name_es, slug_en, slug_es) values
  ('News', 'Noticias', 'news', 'noticias'),
  ('Announcements', 'Comunicados', 'announcements', 'comunicados');
