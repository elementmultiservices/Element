-- Element — extensions and enumerated types.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create type public.user_role as enum ('user', 'admin');
create type public.app_locale as enum ('en', 'es');
create type public.post_status as enum ('draft', 'scheduled', 'published');
