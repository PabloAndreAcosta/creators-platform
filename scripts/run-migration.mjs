import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://hiurrvorwqfihtdfhbhv.supabase.co',
  process.env.SK,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const sql = readFileSync('supabase/migrations/20260216_add_tiers_and_payouts.sql', 'utf8');

// Split into individual statements
const statements = sql
  .split(/;\s*$/m)
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && !s.startsWith('COMMENT'));

for (const stmt of statements) {
  if (!stmt || stmt.startsWith('--')) continue;
  const clean = stmt.replace(/--.*$/gm, '').trim();
  if (!clean) continue;

  console.log('Running:', clean.substring(0, 80) + '...');
  const { error } = await supabase.rpc('exec_sql', { sql_string: clean });
  if (error) {
    console.log('  -> RPC not available, trying direct...');
    break;
  }
  console.log('  -> OK');
}
