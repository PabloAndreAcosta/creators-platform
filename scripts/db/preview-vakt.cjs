// Spärr i bygget: en förhandsversion på Vercel får inte prata med
// produktionsdatabasen när Supabase-grenar per PR är påslagna.
//
// Slås på med SUPABASE_PREVIEW_KRAV_GREN=1 i Vercels Preview-miljö (steg i
// supabase/BRANCHING.md). Då misslyckas bygget om NEXT_PUBLIC_SUPABASE_URL
// fortfarande pekar på produktionen. Det händer när Vercel hinner börja bygga
// innan Supabase har skrivit grenens adress och nycklar; Supabase bygger då om
// den senaste deployen av PR:en, och den andra gången har den grenens värden.
// Hellre ett rött förhandsbygge än en förhandsversion som skriver i skarp data.
//
// Påverkar inte produktionen (VERCEL_ENV=production) eller lokal utveckling.

const PROD_VARDAR = ['hiurrvorwqfihtdfhbhv.supabase.co', 'auth.usha.se'];

/** @param {Record<string, string | undefined>} env @returns {string | null} felmeddelande eller null */
function previewVakt(env) {
  if (env.VERCEL_ENV !== 'preview') return null;
  if ((env.SUPABASE_PREVIEW_KRAV_GREN || '').trim() !== '1') return null;
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (!url) return 'NEXT_PUBLIC_SUPABASE_URL saknas i förhandsbygget – Supabase-grenen har inte skrivit sina värden än.';
  let host;
  try { host = new URL(url).host.toLowerCase(); } catch { return `NEXT_PUBLIC_SUPABASE_URL är ingen giltig adress: ${url}`; }
  const extra = (env.SUPABASE_PROD_VARDAR || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if ([...PROD_VARDAR, ...extra].includes(host)) {
    return `Förhandsbygget pekar på produktionsdatabasen (${host}). Väntar på Supabase-grenens värden; Supabase bygger om automatiskt när grenen är klar.`;
  }
  return null;
}

module.exports = { previewVakt, PROD_VARDAR };
