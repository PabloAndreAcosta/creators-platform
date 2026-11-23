// Gör om en pg_dump av schemat public till en migration som Supabase kan köra
// på en tom databas (förhandsgrenar per PR och `supabase db reset` lokalt).
//
// Det som tas bort är sådant en ny Supabase-databas redan har, eller sådant
// migreringskörningen inte får göra som rollen postgres:
//   - psql-kommandona \restrict/\unrestrict (pg_dump 17.6+); migreringskörningen är inte psql
//   - CREATE/ALTER/COMMENT ON SCHEMA public (schemat finns redan och ägs av pg_database_owner)
//   - ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin (kräver en roll som postgres
//     inte har; en ny Supabase-databas har dem redan)
//
// Standardrättigheterna för postgres stängs av medan baslinjen körs och slås på
// igen sist. Annars får varje ny tabell och funktion anon/authenticated-rättigheter
// av databasens standard, och pg_dump återkallar dem inte (den jämför bara mot
// Postgres inbyggda standard). Utan det skulle t.ex. award_points() gå att anropa
// som anon på en förhandsgren, fast produktionen bara tillåter service_role.
// Det som läggs till sist är tilläggsfilen: triggern på auth.users, lagringsbuckets
// och policyerna på storage.objects, som inte följer med en dump av public.

/** @param {string} dump  @param {string} tillagg  @param {{ kalla?: string }} [opt] */
export function byggBaslinje(dump, tillagg, opt = {}) {
  const rader = dump.replace(/\r\n/g, '\n').split('\n');
  const ut = [];
  const standard = [];
  let samlar = null; // 'hoppa' | 'spara' medan en flerradig ALTER DEFAULT PRIVILEGES läses
  for (const rad of rader) {
    if (samlar) {
      if (samlar === 'spara') standard[standard.length - 1] += `\n${rad}`;
      if (rad.trimEnd().endsWith(';')) samlar = null;
      continue;
    }
    if (/^\\(un)?restrict\b/.test(rad)) continue;
    if (/^(CREATE SCHEMA|ALTER SCHEMA|COMMENT ON SCHEMA) "?public"?\b/.test(rad)) continue;
    const m = /^ALTER DEFAULT PRIVILEGES FOR ROLE "?(\w+)"?/.exec(rad);
    if (m || /^ALTER DEFAULT PRIVILEGES\b/.test(rad)) {
      const spara = m?.[1] === 'postgres';
      if (spara) standard.push(rad);
      if (!rad.trimEnd().endsWith(';')) samlar = spara ? 'spara' : 'hoppa';
      continue;
    }
    ut.push(rad);
  }
  const kropp = ut.join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (!/CREATE TABLE/.test(kropp)) throw new Error('Dumpen innehåller inga tabeller – fel fil?');
  // Data i en dump står först på raden; funktionskroppar med INSERT är indragna.
  if (/^(COPY|INSERT INTO) /m.test(kropp)) {
    throw new Error('Dumpen innehåller data (COPY/INSERT) – baslinjen får bara innehålla schema');
  }
  const huvud = [
    '-- Baslinje: hela schemat public som det ser ut i produktionen.',
    '-- Byggd av scripts/db/bygg-baslinje.mjs – redigera inte för hand.',
    opt.kalla ? `-- Källa: ${opt.kalla}` : null,
    '-- Äldre migrationer ligger i supabase/migrations-historik/ och körs inte längre.',
    '',
  ].filter((r) => r !== null);
  const av = ['TABLES', 'SEQUENCES', 'FUNCTIONS']
    .map((t) => `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ${t} FROM anon, authenticated, service_role;`)
    .join('\n');
  const pa = standard.length ? standard.join('\n') : '-- (dumpen hade inga standardrättigheter för postgres)';
  return [
    huvud.join('\n'),
    '-- Standardrättigheterna av medan objekten skapas (se scripts/db/baslinje.mjs).',
    av,
    '',
    kropp,
    '',
    tillagg.trim(),
    '',
    '-- Standardrättigheterna på igen, som i produktionen, för kommande migrationer.',
    pa,
    '',
  ].join('\n');
}

/** Supabase kräver <14 siffror>_<namn>.sql och unika versioner. */
export const MIGRATIONSNAMN = /^(\d{14})_[a-z0-9_]+\.sql$/;

/** @param {string[]} filer  @returns {string[]} fel */
export function kontrolleraMigrationsnamn(filer) {
  const fel = [];
  const sedda = new Map();
  for (const f of filer) {
    if (!f.endsWith('.sql')) continue;
    const m = MIGRATIONSNAMN.exec(f);
    if (!m) {
      fel.push(`${f}: namnet ska vara ÅÅÅÅMMDDttmmss_namn.sql (små bokstäver, siffror, _) – annars hoppar Supabase tyst över filen`);
      continue;
    }
    if (sedda.has(m[1])) fel.push(`${f}: samma version ${m[1]} som ${sedda.get(m[1])}`);
    else sedda.set(m[1], f);
  }
  return fel;
}
