#!/usr/bin/env node
// Månadens säkerhetskontroll — det Vanta gör, fast för oss.
//
// Går igenom kontrollerna vi lovar i docs/sakerhet/kontrollprogram.md och
// skriver en rapport i markdown: grönt, gult, rött och "ej kontrollerat".
// Körs av .github/workflows/sakerhetskontroll.yml den 1:a varje månad och
// vid behov för hand. Rapporten blir ett GitHub-ärende (bevis med tidsstämpel)
// och ett mejl.
//
// Vad som behövs i miljön:
//   GITHUB_TOKEN        (Actions egen) — PR, backup-körningar, ärenden
//   GH_ADMIN_TOKEN      (valfri, fine-grained PAT, läs) — branch protection,
//                       Dependabot-larm, medarbetare, org-2FA
//   SUPABASE_URL + SUPABASE_SECRET_KEY — rpc security_report()
//   VERCEL_TOKEN        (valfri) — teammedlemmar och preview-variabler
//   RESEND_API_KEY      (valfri) — mejlet
//   DRY_RUN=1           — skriv rapporten, skapa inget ärende, skicka inget mejl
//
// Allt som saknar nyckel markeras "ej kontrollerat", aldrig grönt.

import fs from "node:fs";
import dns from "node:dns/promises";

const REPO = process.env.GITHUB_REPOSITORY || "usha-ab/creators-platform";
const [OWNER] = REPO.split("/");
const SITE = process.env.SITE_URL || "https://usha.se";
const DOMAIN = new URL(SITE).hostname;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://hiurrvorwqfihtdfhbhv.supabase.co";
const REPORT_TO = process.env.REPORT_TO || "pablo.acosta@usha.se";
const DRY = process.env.DRY_RUN === "1";
const VERCEL_TEAM = process.env.VERCEL_TEAM_SLUG || "pablo-andre-acosta-gomezs-projects";
const VERCEL_PROJECT = process.env.VERCEL_PROJECT || "creators-platform";

/** @type {{area:string, name:string, status:"ok"|"warn"|"fail"|"skip", detail:string}[]} */
const rows = [];
const add = (area, name, status, detail = "") => rows.push({ area, name, status, detail });

async function gh(path, token = process.env.GH_ADMIN_TOKEN || process.env.GITHUB_TOKEN) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${path}`), { status: res.status });
  return res.json();
}

// ---------- GitHub ----------
async function checkGitHub() {
  const area = "GitHub";
  const admin = !!process.env.GH_ADMIN_TOKEN;

  // Skydd på main: PR krävs, ingen force-push, gäller även admins.
  try {
    const p = await gh(`/repos/${REPO}/branches/main/protection`);
    const prReq = !!p.required_pull_request_reviews;
    const admins = !!p.enforce_admins?.enabled;
    const force = !!p.allow_force_pushes?.enabled;
    const del = !!p.allow_deletions?.enabled;
    const ok = prReq && admins && !force && !del;
    add(area, "Skydd på main", ok ? "ok" : "fail", `PR krävs: ${prReq ? "ja" : "nej"} · gäller admins: ${admins ? "ja" : "nej"} · force-push: ${force ? "tillåten" : "blockerad"} · radering: ${del ? "tillåten" : "blockerad"}`);
  } catch (e) {
    if (e.status === 404 && admin) add(area, "Skydd på main", "fail", "Grenen är oskyddad — direkt push till produktion är möjlig.");
    else add(area, "Skydd på main", "skip", admin ? `Kunde inte läsa (${e.message})` : "Kräver GH_ADMIN_TOKEN");
  }

  // Dependabot: öppna kritiska/höga, uppdelat på runtime (når besökare) och byggkedja.
  try {
    const alerts = await gh(`/repos/${REPO}/dependabot/alerts?state=open&severity=critical,high&per_page=100`);
    const runtime = alerts.filter((a) => a.dependency?.scope === "runtime");
    const dev = alerts.length - runtime.length;
    add(area, "Sårbarheter (Dependabot, kritiska/höga)", runtime.length === 0 ? (dev > 0 ? "warn" : "ok") : "fail",
      `${runtime.length} i runtime${runtime.length ? ": " + runtime.slice(0, 6).map((a) => a.dependency?.package?.name).join(", ") : ""} · ${dev} i byggkedjan`);
  } catch (e) {
    add(area, "Sårbarheter (Dependabot)", "skip", admin ? `Kunde inte läsa (${e.message})` : "Kräver GH_ADMIN_TOKEN");
  }

  // Vilka har skrivrätt — underlaget för åtkomstgenomgången.
  try {
    const c = await gh(`/repos/${REPO}/collaborators?affiliation=all&per_page=100`);
    const writers = c.filter((x) => x.permissions?.push || x.permissions?.admin);
    add(area, "Konton med skrivrätt i repot", writers.length <= 3 ? "ok" : "warn", writers.map((x) => `${x.login}${x.permissions?.admin ? " (admin)" : ""}`).join(", ") || "inga");
  } catch (e) {
    add(area, "Konton med skrivrätt i repot", "skip", admin ? `Kunde inte läsa (${e.message})` : "Kräver GH_ADMIN_TOKEN");
  }

  // 2FA-tvång i organisationen.
  try {
    const org = await gh(`/orgs/${OWNER}`);
    if (typeof org.two_factor_requirement_enabled === "boolean")
      add(area, "2FA-tvång i organisationen", org.two_factor_requirement_enabled ? "ok" : "fail", org.two_factor_requirement_enabled ? "På" : "AV");
    else add(area, "2FA-tvång i organisationen", "skip", "Kräver GH_ADMIN_TOKEN med org-läsning");
  } catch (e) {
    add(area, "2FA-tvång i organisationen", "skip", `Kunde inte läsa (${e.message})`);
  }

  // Backup-jobbet har gått grönt senaste veckan.
  try {
    const runs = await gh(`/repos/${REPO}/actions/workflows/storage-backup.yml/runs?status=success&per_page=1`, process.env.GITHUB_TOKEN || process.env.GH_ADMIN_TOKEN);
    const last = runs.workflow_runs?.[0]?.updated_at;
    const days = last ? (Date.now() - Date.parse(last)) / 86400000 : Infinity;
    add(area, "Storage-backup senaste veckan", days <= 8 ? "ok" : "fail", last ? `Senast grön: ${last.slice(0, 10)}` : "Ingen grön körning hittad");
  } catch (e) {
    add(area, "Storage-backup senaste veckan", "skip", `Kunde inte läsa (${e.message})`);
  }

  // Gamla öppna PR: inte en säkerhetsrisk, men ett tecken på osynkat arbete.
  try {
    const prs = await gh(`/repos/${REPO}/pulls?state=open&per_page=100`, process.env.GITHUB_TOKEN || process.env.GH_ADMIN_TOKEN);
    const old = prs.filter((p) => Date.now() - Date.parse(p.created_at) > 30 * 86400000);
    add(area, "Öppna PR äldre än 30 dagar", old.length === 0 ? "ok" : "warn", old.length ? old.map((p) => `#${p.number}`).join(", ") : "inga");
  } catch (e) {
    add(area, "Öppna PR äldre än 30 dagar", "skip", `Kunde inte läsa (${e.message})`);
  }
}

// ---------- Supabase ----------
async function checkSupabase() {
  const area = "Databas";
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return add(area, "RLS och policies", "skip", "Kräver SUPABASE_SECRET_KEY");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/security_report`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: "{}",
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const r = await res.json();
    const noRls = r.tables_without_rls ?? [];
    const noPol = r.tables_rls_without_policy ?? [];
    add(area, "RLS på alla tabeller", noRls.length === 0 ? "ok" : "fail", noRls.length ? `Utan RLS: ${noRls.join(", ")}` : `${r.tables_total} tabeller, alla med RLS`);
    add(area, "Tabeller med RLS men utan policy", noPol.length === 0 ? "ok" : "warn", noPol.length ? `${noPol.join(", ")} (bara service-rollen når dem — avsiktligt?)` : "inga");
    add(area, "Security definer-funktioner", "ok", `${(r.security_definer_functions ?? []).length} st — granskas vid ändring`);
    add(area, "Anon har grant på tabeller", (r.anon_table_grants ?? []).length <= 40 ? "ok" : "warn", `${(r.anon_table_grants ?? []).length} tabeller (RLS avgör raderna)`);
  } catch (e) {
    add(area, "RLS och policies", "fail", `Rapporten gick inte att hämta: ${e.message}`);
  }
}

// ---------- Vercel ----------
async function checkVercel() {
  const area = "Vercel";
  const token = process.env.VERCEL_TOKEN;
  if (!token) return add(area, "Medlemmar och preview-variabler", "skip", "Kräver VERCEL_TOKEN");
  const v = async (p) => {
    const res = await fetch(`https://api.vercel.com${p}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${res.status} ${p}`);
    return res.json();
  };
  try {
    const team = await v(`/v2/teams/${VERCEL_TEAM}`);
    const members = await v(`/v2/teams/${team.id}/members?limit=100`);
    const list = (members.members ?? []).map((m) => `${m.username ?? m.email} (${m.role})`);
    add(area, "Teammedlemmar", list.length <= 3 ? "ok" : "warn", list.join(", "));
    const envs = await v(`/v9/projects/${VERCEL_PROJECT}/env?teamId=${team.id}`);
    const risky = /(SERVICE_ROLE|SECRET|PRIVATE|TOKEN|PASSWORD)/i;
    const leaks = (envs.envs ?? []).filter((e) => e.target?.includes("preview") && !e.target?.includes("production") && risky.test(e.key)).map((e) => e.key);
    const shared = (envs.envs ?? []).filter((e) => e.target?.includes("preview") && e.target?.includes("production") && risky.test(e.key) && !/^NEXT_PUBLIC_/.test(e.key)).map((e) => e.key);
    add(area, "Hemligheter i preview", shared.length === 0 ? "ok" : "warn", shared.length ? `Delas med produktion: ${shared.join(", ")}` : `Inga produktionshemligheter delas med preview${leaks.length ? ` (egna preview-nycklar: ${leaks.join(", ")})` : ""}`);
  } catch (e) {
    add(area, "Medlemmar och preview-variabler", "skip", `Kunde inte läsa (${e.message})`);
  }
}

// ---------- Sajten ----------
async function checkSite() {
  const area = "Sajten";
  try {
    const res = await fetch(SITE, { redirect: "manual" });
    const h = (n) => res.headers.get(n);
    const want = {
      "strict-transport-security": (v) => v && /max-age=(\d+)/.test(v) && Number(RegExp.$1) >= 31536000,
      "x-content-type-options": (v) => v === "nosniff",
      "x-frame-options": (v) => !!v,
      "referrer-policy": (v) => !!v,
      "content-security-policy": (v) => !!v,
    };
    const missing = Object.entries(want).filter(([k, f]) => !f(h(k))).map(([k]) => k);
    add(area, "Säkerhetsheaders", missing.length === 0 ? "ok" : "warn", missing.length ? `Saknas/svaga: ${missing.join(", ")}` : "HSTS, nosniff, frame, referrer, CSP på plats");
  } catch (e) {
    add(area, "Säkerhetsheaders", "fail", `Sajten svarade inte: ${e.message}`);
  }
  for (const p of ["/privacy", "/terms", "/cookies"]) {
    try {
      const r = await fetch(`${SITE}${p}`, { redirect: "follow" });
      add(area, `Sidan ${p}`, r.ok ? "ok" : "fail", `HTTP ${r.status}`);
    } catch (e) {
      add(area, `Sidan ${p}`, "fail", e.message);
    }
  }
}

// ---------- E-post/DNS ----------
async function checkDns() {
  const area = "E-post";
  const txt = async (name) => {
    try {
      return (await dns.resolveTxt(name)).map((r) => r.join(""));
    } catch {
      return [];
    }
  };
  const spf = (await txt(DOMAIN)).find((t) => t.startsWith("v=spf1"));
  add(area, "SPF", spf ? (/[-~]all$/.test(spf) ? "ok" : "warn") : "fail", spf ?? "saknas");
  const dmarc = (await txt(`_dmarc.${DOMAIN}`)).find((t) => t.startsWith("v=DMARC1"));
  const pol = dmarc?.match(/p=(\w+)/)?.[1];
  add(area, "DMARC", pol === "reject" ? "ok" : pol === "quarantine" ? "warn" : "fail", dmarc ? `p=${pol}` : "saknas");
  const dkim = await txt(`resend._domainkey.${DOMAIN}`);
  add(area, "DKIM (Resend)", dkim.length ? "ok" : "fail", dkim.length ? "finns" : "saknas");
}

// ---------- Rapport ----------
function render() {
  const icon = { ok: "🟢", warn: "🟡", fail: "🔴", skip: "⚪" };
  const now = new Date();
  const month = now.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  const counts = { ok: 0, warn: 0, fail: 0, skip: 0 };
  for (const r of rows) counts[r.status]++;
  let md = `# Säkerhetskontroll ${month}\n\n`;
  md += `Körd ${now.toISOString().slice(0, 16).replace("T", " ")} UTC. ${counts.fail} röda · ${counts.warn} gula · ${counts.ok} gröna · ${counts.skip} ej kontrollerade.\n\n`;
  const areas = [...new Set(rows.map((r) => r.area))];
  for (const a of areas) {
    md += `## ${a}\n\n| | Kontroll | Läge |\n|---|---|---|\n`;
    for (const r of rows.filter((r) => r.area === a)) md += `| ${icon[r.status]} | ${r.name} | ${r.detail.replace(/\|/g, "/")} |\n`;
    md += "\n";
  }
  md += `## Manuellt varje kvartal\n\n- Åtkomstgenomgång: listan ovan + Google Workspace-konton + Supabase/Stripe/Resend/Cloudflare-inloggningar. Ta bort det som inte behövs.\n- Google Workspace: 2FA-tvång på, inga delade inloggningar.\n- Leverantörslistan i docs/sakerhet/leverantorer.md stämmer.\n- Riskregistret i docs/sakerhet/risker.md genomgånget.\n\n`;
  md += `Programmet beskrivs i docs/sakerhet/kontrollprogram.md. Rapporten skapas av scripts/sakerhetskontroll.mjs.\n`;
  return { md, counts, month };
}

async function publish({ md, counts, month }) {
  fs.writeFileSync("sakerhetskontroll.md", md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  if (DRY) return console.log(md);

  // Ärende = bevis med tidsstämpel. Ett per körning, taggat.
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Säkerhetskontroll ${month}: ${counts.fail} röda, ${counts.warn} gula`, body: md, labels: ["säkerhetskontroll"] }),
    });
    if (!res.ok) console.error("Kunde inte skapa ärende:", res.status, await res.text());
    else console.log("Ärende skapat:", (await res.json()).html_url);
  }

  // Mejlet: sammanfattningen och var detaljerna finns. Alltid — ett tyst larm
  // döljer veckor av fel.
  const resend = process.env.RESEND_API_KEY;
  if (resend) {
    const red = rows.filter((r) => r.status === "fail").map((r) => `• ${r.area}: ${r.name} — ${r.detail}`).join("\n");
    const yellow = rows.filter((r) => r.status === "warn").map((r) => `• ${r.area}: ${r.name} — ${r.detail}`).join("\n");
    const text = `Säkerhetskontroll ${month}\n\n${counts.fail} röda, ${counts.warn} gula, ${counts.ok} gröna, ${counts.skip} ej kontrollerade.\n\n${red ? "RÖTT\n" + red + "\n\n" : ""}${yellow ? "GULT\n" + yellow + "\n\n" : ""}Hela rapporten ligger som ärende i GitHub (etikett säkerhetskontroll) under usha-ab/creators-platform.`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Usha Platform <noreply@usha.se>", to: REPORT_TO, subject: `${counts.fail ? "🔴" : counts.warn ? "🟡" : "🟢"} Säkerhetskontroll ${month}: ${counts.fail} röda, ${counts.warn} gula`, text }),
    });
    if (!res.ok) console.error("Kunde inte mejla:", res.status, await res.text());
  }
}

await checkGitHub();
await checkSupabase();
await checkVercel();
await checkSite();
await checkDns();
await publish(render());
