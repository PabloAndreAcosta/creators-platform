import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  pickMessages,
  PUBLIC_NAMESPACES,
  APP_NAMESPACES,
  DASHBOARD_NAMESPACES,
  AUTH_NAMESPACES,
} from "@/lib/i18n/client-namespaces";
import sv from "@/i18n/messages/sv.json";

const SRC = path.resolve(__dirname, "../../..");
const APP_DIR = path.join(SRC, "app");
const ENTRY_FILES = new Set(["page.tsx", "layout.tsx", "template.tsx", "error.tsx", "not-found.tsx"]);

/** Kommentarer bort innan koden läses — annars matchar en kommentar som NÄMNER
 *  ett anrop, vilket gav falskt alarm när analysen skrevs första gången. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function resolveSpec(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const isClient = (src: string) => /^\s*["']use client["']/.test(src);

type Walk = { namespaces: Set<string>; rootCalls: string[] };

/** Följ importkedjan från en ingångsfil och samla klientkomponenternas namespace. */
function walk(entry: string): Walk {
  const seen = new Set<string>();
  const namespaces = new Set<string>();
  const rootCalls: string[] = [];
  const stack = [entry];

  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    let raw: string;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const src = stripComments(raw);

    if (isClient(raw)) {
      for (const m of src.matchAll(/useTranslations\(\s*["']([A-Za-z0-9_.]+)["']/g)) {
        namespaces.add(m[1].split(".")[0]);
      }
      if (/useTranslations\(\s*\)/.test(src) || /\buseMessages\(/.test(src)) {
        rootCalls.push(path.relative(SRC, file));
      }
    }

    for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
      const r = resolveSpec(m[1], file);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return { namespaces, rootCalls };
}

function entryFiles(): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p);
      else if (ENTRY_FILES.has(e.name)) out.push(p);
    }
  };
  visit(APP_DIR);
  return out;
}

type Group = "PUBLIC" | "APP" | "DASHBOARD" | "AUTH";

function groupOf(file: string): Group {
  const rel = path.relative(APP_DIR, file);
  if (rel.startsWith(`app${path.sep}`)) return "APP";
  if (rel.includes("(dashboard)")) return "DASHBOARD";
  if (rel.includes("(auth)")) return "AUTH";
  return "PUBLIC"; // inkl. rotlayouten, som delar provider med de publika sidorna
}

/** Vad varje grupp faktiskt behöver, härlett ur koden. */
function neededByGroup(): Record<Group, Set<string>> {
  const out: Record<Group, Set<string>> = {
    PUBLIC: new Set(), APP: new Set(), DASHBOARD: new Set(), AUTH: new Set(),
  };
  for (const f of entryFiles()) {
    const { namespaces } = walk(f);
    for (const ns of namespaces) out[groupOf(f)].add(ns);
  }
  return out;
}

const DECLARED: Record<Group, readonly string[]> = {
  PUBLIC: PUBLIC_NAMESPACES,
  APP: APP_NAMESPACES,
  DASHBOARD: DASHBOARD_NAMESPACES,
  AUTH: AUTH_NAMESPACES,
};

describe("klientens översättningsnamespace per grupp", () => {
  const needed = neededByGroup();

  it("ingen klientkomponent läser från roten", () => {
    // useTranslations() utan namespace eller useMessages() kräver HELA
    // språkfilen och gör varje urvalslista verkningslös.
    const offenders = entryFiles().flatMap((f) => walk(f).rootCalls);
    expect([...new Set(offenders)]).toEqual([]);
  });

  for (const g of ["PUBLIC", "APP", "DASHBOARD", "AUTH"] as const) {
    it(`${g}: listan täcker allt gruppen använder`, () => {
      const missing = [...needed[g]].filter((ns) => !DECLARED[g].includes(ns));
      expect(missing, `Lägg till i ${g}_NAMESPACES: ${missing.join(", ")}`).toEqual([]);
    });

    it(`${g}: listan innehåller inget oanvänt`, () => {
      const unused = DECLARED[g].filter((ns) => !needed[g].has(ns));
      expect(unused, `Kan tas bort ur ${g}_NAMESPACES: ${unused.join(", ")}`).toEqual([]);
    });

    it(`${g}: alla namespace finns i språkfilen`, () => {
      const saknas = DECLARED[g].filter((ns) => !(ns in (sv as Record<string, unknown>)));
      expect(saknas, `Finns inte i sv.json: ${saknas.join(", ")}`).toEqual([]);
    });
  }

  it("publika sidor skickar dramatiskt mindre än hela filen", () => {
    const full = JSON.stringify(sv).length;
    const picked = JSON.stringify(pickMessages(sv as Record<string, unknown>, PUBLIC_NAMESPACES)).length;
    expect(picked).toBeLessThan(full * 0.3);
  });

  it("pickMessages hoppar tyst över okända namespace", () => {
    expect(pickMessages({ a: 1, b: 2 }, ["a", "finns-inte"])).toEqual({ a: 1 });
  });
});
