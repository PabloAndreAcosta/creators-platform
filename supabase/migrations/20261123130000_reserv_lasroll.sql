-- Läsroll för den nattliga kopian av databasen till Hjärnan (Kroppens reserv,
-- kroppen-app deploy/hjarnan/reserv/). Beslut Pablo 2026-11-23, juristens villkor 3–4.
--
-- Rollen kan bara läsa: SELECT på schemat public och på fyra tabeller i auth/storage.
-- Den når aldrig sessioner, tokens eller hemligheter (auth.sessions, auth.refresh_tokens,
-- auth.one_time_tokens, auth.flow_state, vault.secrets) – de saknas i rättigheterna.
-- BYPASSRLS behövs för att pg_dump ska se alla rader; rollen kan ändå inte skriva.
--
-- Skapas utan inloggning och utan lösenord. Lösenordet sätter Pablo själv i
-- Supabase SQL Editor efter att migrationen körts (aldrig i en fil eller en chatt):
--   alter role usha_reserv_las with login password '<nytt lösenord>';
-- På en förhandsgren (Supabase-gren per PR) blir rollen kvar utan inloggning.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'usha_reserv_las') then
    create role usha_reserv_las nologin nosuperuser nocreatedb nocreaterole noinherit bypassrls;
  end if;
end $$;

alter role usha_reserv_las set default_transaction_read_only = on;
alter role usha_reserv_las set statement_timeout = '10min';

grant usage on schema public, auth, storage to usha_reserv_las;
grant select on all tables in schema public to usha_reserv_las;
grant select on all sequences in schema public to usha_reserv_las;
alter default privileges for role postgres in schema public grant select on tables to usha_reserv_las;
alter default privileges for role postgres in schema public grant select on sequences to usha_reserv_las;

grant select on auth.users, auth.identities to usha_reserv_las;
grant select on storage.buckets, storage.objects to usha_reserv_las;
