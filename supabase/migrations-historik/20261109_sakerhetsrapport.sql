-- Säkerhetsrapport ur databasen, för den månatliga kontrollen
-- (.github/workflows/sakerhetskontroll.yml → scripts/sakerhetskontroll.mjs).
--
-- Svarar på det en revisor skulle fråga om datalagret: har alla tabeller RLS,
-- finns tabeller med RLS men utan en enda policy (= oåtkomliga eller glömda),
-- vilka funktioner kör som security definer, vilka tillägg är på. Läser bara
-- kataloger; ändrar inget. Bara service-rollen får anropa den.
create or replace function public.security_report()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'tables_total', (select count(*) from pg_tables where schemaname = 'public'),
    'tables_without_rls', (
      select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb)
      from pg_tables where schemaname = 'public' and rowsecurity = false
    ),
    'tables_rls_without_policy', (
      select coalesce(jsonb_agg(t.tablename order by t.tablename), '[]'::jsonb)
      from pg_tables t
      where t.schemaname = 'public' and t.rowsecurity = true
        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
    ),
    'policies_total', (select count(*) from pg_policies where schemaname = 'public'),
    'security_definer_functions', (
      select coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
    ),
    'extensions', (select coalesce(jsonb_agg(extname order by extname), '[]'::jsonb) from pg_extension),
    'anon_table_grants', (
      -- Tabeller där anon har någon rättighet alls. RLS avgör raderna, men en
      -- tabell anon inte ska se alls ska inte ha någon grant.
      select coalesce(jsonb_agg(distinct table_name order by table_name), '[]'::jsonb)
      from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public'
    )
  );
$$;

revoke all on function public.security_report() from public;
revoke all on function public.security_report() from anon;
revoke all on function public.security_report() from authenticated;
grant execute on function public.security_report() to service_role;

comment on function public.security_report() is
  'Månadskontrollens databasdel: RLS-täckning, policies, security definer-funktioner, tillägg, anon-grants. Bara service_role.';
