#!/usr/bin/env node
// Användning:
//   node scripts/db/bygg-baslinje.mjs <dump.sql> [--kalla "<text>"] [--ut <fil>]
// <dump.sql> = `pg_dump --schema-only --schema=public` av produktionen (eller av en
// databas som visats vara lika produktionen, se supabase/BRANCHING.md).
// Skriver supabase/migrations/20261123120000_baslinje.sql om inget --ut anges.
import { readFileSync, writeFileSync } from 'node:fs';
import { byggBaslinje } from './baslinje.mjs';

const args = process.argv.slice(2);
const dumpFil = args.find((a) => !a.startsWith('--'));
const flagga = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!dumpFil) {
  console.error('användning: node scripts/db/bygg-baslinje.mjs <dump.sql> [--kalla "…"] [--ut <fil>]');
  process.exit(2);
}
const ut = flagga('--ut') ?? 'supabase/migrations/20261123120000_baslinje.sql';
const sql = byggBaslinje(
  readFileSync(dumpFil, 'utf8'),
  readFileSync('supabase/baslinje/tillagg.sql', 'utf8'),
  { kalla: flagga('--kalla') },
);
writeFileSync(ut, sql);
console.log(`skrev ${ut} (${sql.split('\n').length} rader)`);
