"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Search, Check } from "lucide-react";
import { fillTemplate, TEMPLATE_KEYS, type TemplateKey } from "@/lib/agreements/templates";

interface Party { id: string; name: string; avatar: string | null; source: "crew" | "venue" | "search" }
interface ListingOption { id: string; title: string; event_date: string | null; event_location: string | null }

interface Props {
  myName: string;
  listings: ListingOption[];
  preselected: Party | null;
  preselectedListingId: string | null;
  /** Mallarna, redan översatta på servern: { key: { title, body } }. */
  templates: Record<TemplateKey, { title: string; body: string }>;
}

/**
 * Nytt avtal i tre steg på en sida: med vem, vilken mall, och texten.
 * Mallen fylls i med parternas namn och kvällen; belopp och detaljer lämnas
 * som [hakparenteser] att fylla i. Allt går att skriva om innan det sparas.
 */
export function NewAgreementForm({ myName, listings, preselected, preselectedListingId, templates }: Props) {
  const t = useTranslations("agreements");
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(preselected);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Party[]>([]);
  const [searching, setSearching] = useState(false);
  const [listingId, setListingId] = useState<string>(preselectedListingId ?? "");
  const [templateKey, setTemplateKey] = useState<TemplateKey>("cohost");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Samarbetspartners först, sökning när man skriver.
  useEffect(() => {
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/agreements/parties?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { parties: [] }))
        .then((d) => active && setResults(d.parties ?? []))
        .catch(() => active && setResults([]))
        .finally(() => active && setSearching(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  const listing = useMemo(() => listings.find((l) => l.id === listingId) ?? null, [listings, listingId]);

  // Mallen skrivs in på nytt när mall, motpart eller kväll byts — tills man
  // själv börjat redigera texten. Då rör vi den inte.
  useEffect(() => {
    if (touched) return;
    const tpl = templates[templateKey];
    const vars = {
      partA: myName || t("partyA"),
      partB: party?.name || t("partyB"),
      event: listing?.title || t("eventPlaceholder"),
      eventDate: listing?.event_date ? new Date(listing.event_date + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }) : t("datePlaceholder"),
      place: listing?.event_location || t("placePlaceholder"),
      today: new Date().toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }),
    };
    setTitle(fillTemplate(tpl.title, vars));
    setBody(fillTemplate(tpl.body, vars));
  }, [templateKey, party, listing, myName, templates, touched, t]);

  async function save() {
    if (!party) return setError(t("errNoParty"));
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterpartyId: party.id, templateKey, title, body, listingId: listingId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "premiumRequired" ? t("errPremium") : t("errSave"));
        return;
      }
      router.push(`/app/avtal/${data.id}`);
    } catch {
      setError(t("errSave"));
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2.5 text-sm text-[var(--usha-white)] focus:border-[var(--usha-gold)] focus:outline-none";

  return (
    <div className="space-y-8">
      {/* 1. Med vem */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{t("stepParty")}</h2>
        {party ? (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--usha-gold)]/50 bg-[var(--usha-card)] p-3">
            <Avatar p={party} />
            <span className="flex-1 font-medium">{party.name}</span>
            <button onClick={() => setParty(null)} className="text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]">{t("change")}</button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-[var(--usha-muted)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className={`${inputClass} pl-9`} />
            </div>
            <div className="mt-2 space-y-1">
              {searching && results.length === 0 && <p className="px-1 text-xs text-[var(--usha-muted)]">…</p>}
              {!searching && results.length === 0 && <p className="px-1 text-xs text-[var(--usha-muted)]">{q.length >= 2 ? t("noResults") : t("searchHint")}</p>}
              {results.map((p) => (
                <button key={p.id} onClick={() => setParty(p)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-left transition hover:border-[var(--usha-gold)]/50">
                  <Avatar p={p} />
                  <span className="flex-1 text-sm font-medium">{p.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--usha-muted)]">{t(`source_${p.source}`)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 2. Mall + kväll */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{t("stepTemplate")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEMPLATE_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => { setTemplateKey(k); setTouched(false); }}
              className={`rounded-xl border p-3 text-left text-sm transition ${templateKey === k ? "border-[var(--usha-gold)] bg-[var(--usha-gold)]/10" : "border-[var(--usha-border)] bg-[var(--usha-card)] hover:border-[var(--usha-gold)]/50"}`}
            >
              <span className="block font-semibold">{t(`template_${k}`)}</span>
              <span className="block text-xs text-[var(--usha-muted)]">{t(`template_${k}_hint`)}</span>
            </button>
          ))}
        </div>
        {listings.length > 0 && (
          <select value={listingId} onChange={(e) => { setListingId(e.target.value); setTouched(false); }} className={`${inputClass} mt-3`}>
            <option value="">{t("noListing")}</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>{l.event_date ? `${l.event_date} · ` : ""}{l.title}</option>
            ))}
          </select>
        )}
      </section>

      {/* 3. Texten */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{t("stepText")}</h2>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setTouched(true); }} className={`${inputClass} font-semibold`} maxLength={120} />
        <textarea value={body} onChange={(e) => { setBody(e.target.value); setTouched(true); }} rows={22} className={`${inputClass} mt-2 font-mono text-[13px] leading-relaxed`} maxLength={20000} />
        <p className="mt-1 text-xs text-[var(--usha-muted)]">{t("textHint")}</p>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={save} disabled={saving || !party || !title.trim() || !body.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--usha-gold)] py-3.5 text-base font-bold text-black disabled:opacity-50">
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        {t("saveDraft")}
      </button>
      <p className="text-center text-xs text-[var(--usha-muted)]">{t("saveDraftHint")}</p>
    </div>
  );
}

function Avatar({ p }: { p: Party }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--usha-black)] text-sm font-semibold text-[var(--usha-muted)]">
      {p.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        p.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
