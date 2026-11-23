import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { byggBaslinje, kontrolleraMigrationsnamn } from './baslinje.mjs';
const { previewVakt } = require('./preview-vakt.cjs');

const MIGRATIONER = path.resolve(__dirname, '../../supabase/migrations');

describe('migrationsmappen', () => {
  it('har bara filer som Supabase faktiskt kör (14 siffror, unika versioner)', () => {
    expect(kontrolleraMigrationsnamn(readdirSync(MIGRATIONER))).toEqual([]);
  });

  it('börjar med baslinjen, så att en ny gren byggs från noll', () => {
    const filer = readdirSync(MIGRATIONER).filter((f) => f.endsWith('.sql')).sort();
    expect(filer[0]).toBe('20261123120000_baslinje.sql');
  });

  it('baslinjen har ingen data och inga psql-kommandon', () => {
    const sql = readFileSync(path.join(MIGRATIONER, '20261123120000_baslinje.sql'), 'utf8');
    expect(sql).not.toMatch(/^(COPY|INSERT INTO public\.)/m);
    expect(sql).not.toMatch(/^\\/m);
    expect(sql).toMatch(/CREATE TRIGGER on_auth_user_created/);
  });
});

describe('kontrolleraMigrationsnamn', () => {
  it('fångar bokstav efter datumet, kort datum och dubbletter', () => {
    const fel = kontrolleraMigrationsnamn([
      '20261124090000_ny_tabell.sql',
      '20260722b_buddy.sql',
      '20261121_kort.sql',
      '20261124090000_samma_version.sql',
      'README.md',
    ]);
    expect(fel).toHaveLength(3);
    expect(fel.join('\n')).toMatch(/20260722b_buddy/);
    expect(fel.join('\n')).toMatch(/20261121_kort/);
    expect(fel.join('\n')).toMatch(/samma version 20261124090000/);
  });
});

describe('byggBaslinje', () => {
  const dump = [
    '\\restrict abc',
    'CREATE SCHEMA public;',
    'ALTER SCHEMA public OWNER TO pg_database_owner;',
    "COMMENT ON SCHEMA public IS 'standard public schema';",
    'CREATE TABLE public.t (id int);',
    'CREATE FUNCTION public.f() RETURNS void LANGUAGE sql AS $$',
    '    INSERT INTO public.t VALUES (1);',
    '$$;',
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;',
    'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public',
    '    GRANT ALL ON TABLES TO anon;',
    '\\unrestrict abc',
  ].join('\n');

  it('tar bort psql-kommandon, schemarader och supabase_admins standardrättigheter', () => {
    const ut = byggBaslinje(dump, '-- tillägg');
    expect(ut).not.toMatch(/restrict/);
    expect(ut).not.toMatch(/CREATE SCHEMA public/);
    expect(ut).not.toMatch(/supabase_admin/);
    expect(ut).toMatch(/CREATE TABLE public\.t/);
    expect(ut).toMatch(/    INSERT INTO public\.t VALUES \(1\);/); // funktionskropp, inte data
  });

  it('stänger av standardrättigheterna före objekten och slår på dem efter tillägget', () => {
    const ut = byggBaslinje(dump, '-- tillägg');
    const av = ut.indexOf('REVOKE ALL ON TABLES FROM anon, authenticated, service_role');
    const tabell = ut.indexOf('CREATE TABLE public.t');
    const tillagg = ut.indexOf('-- tillägg');
    const pa = ut.indexOf('FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon');
    expect(av).toBeGreaterThan(-1);
    expect(av).toBeLessThan(tabell);
    expect(tabell).toBeLessThan(tillagg);
    expect(tillagg).toBeLessThan(pa);
  });

  it('vägrar en dump med data', () => {
    expect(() => byggBaslinje('CREATE TABLE public.t (id int);\nCOPY public.t (id) FROM stdin;', '')).toThrow(/data/);
    expect(() => byggBaslinje('-- tom', '')).toThrow(/inga tabeller/);
  });
});

describe('previewVakt', () => {
  const pa = { VERCEL_ENV: 'preview', SUPABASE_PREVIEW_KRAV_GREN: '1' };

  it('stoppar ett förhandsbygge mot produktionen när spärren är på', () => {
    expect(previewVakt({ ...pa, NEXT_PUBLIC_SUPABASE_URL: 'https://hiurrvorwqfihtdfhbhv.supabase.co' })).toMatch(/produktionsdatabasen/);
    expect(previewVakt({ ...pa, NEXT_PUBLIC_SUPABASE_URL: 'https://auth.usha.se' })).toMatch(/produktionsdatabasen/);
    expect(previewVakt({ ...pa, NEXT_PUBLIC_SUPABASE_URL: '' })).toMatch(/saknas/);
  });

  it('släpper igenom grenens adress', () => {
    expect(previewVakt({ ...pa, NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' })).toBeNull();
  });

  it('rör inte produktionen, lokal utveckling eller previews innan spärren slagits på', () => {
    const prod = 'https://hiurrvorwqfihtdfhbhv.supabase.co';
    expect(previewVakt({ VERCEL_ENV: 'production', SUPABASE_PREVIEW_KRAV_GREN: '1', NEXT_PUBLIC_SUPABASE_URL: prod })).toBeNull();
    expect(previewVakt({ NEXT_PUBLIC_SUPABASE_URL: prod })).toBeNull();
    expect(previewVakt({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: prod })).toBeNull();
  });
});
