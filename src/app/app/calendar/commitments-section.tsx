"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Briefcase, MapPin, Pencil, Plus, Trash2, Loader2, X } from "lucide-react";
import { addCommitment, updateCommitment, deleteCommitment, type CalendarSuggestion } from "./actions";
import {
  commitmentTotals,
  summarizeEconomics,
  formatCommitmentRange,
  COMMITMENT_PURPOSES,
  type Commitment,
  type CommitmentInput,
  type EconomicsTotals,
} from "@/lib/calendar/commitments";
import { CommitmentForm, draftFromCommitment, emptyDraft, type CommitmentDraft } from "./commitment-form";
import { GoogleImport } from "./google-import";

function sortCommitments(list: Commitment[]) {
  return [...list].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date));
}

/** Ersätter rader med samma id och lägger till nya. */
function mergeCommitments(list: Commitment[], updated: Commitment[]) {
  const byId = new Map(list.map((c) => [c.id, c]));
  for (const c of updated) byId.set(c.id, c);
  return sortCommitments(Array.from(byId.values()));
}

type FormState = { mode: "add"; draft: CommitmentDraft; key: string } | { mode: "edit"; id: string; draft: CommitmentDraft; key: string };

/**
 * Egna åtaganden: festivaler, dansjobb, kurser och annat man själv går på eller
 * jobbar på, med en uppskattad ekonomi per resa. Privata — bara ägaren ser dem.
 * De dagarna går inte att markera som bokningsbara. Ingår medvetet inte i
 * kalenderprenumerationen: användarens egen kalender är redan källan.
 */
export function CommitmentsSection({
  commitments,
  onChange,
  importMaskedUrl,
}: {
  commitments: Commitment[];
  onChange: (next: Commitment[]) => void;
  importMaskedUrl: string | null;
}) {
  const t = useTranslations("calendarPage");
  const ta = useTranslations("a11y");
  const locale = useLocale();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "SEK", maximumFractionDigits: 0 });
  const kr = (ore: number) => money.format(Math.round(ore / 100));

  const todayKey = new Date().toISOString().slice(0, 10);
  const upcoming = sortCommitments(commitments).filter((c) => c.end_date >= todayKey);
  const summary = summarizeEconomics(upcoming);
  const importedUids = new Set(commitments.map((c) => c.external_uid).filter((u): u is string => !!u));

  function openAdd(draft: CommitmentDraft = emptyDraft()) {
    setError("");
    setNotice("");
    setForm({ mode: "add", draft, key: `add-${Date.now()}` });
  }

  function openFromSuggestion(s: CalendarSuggestion) {
    openAdd({
      ...emptyDraft(),
      title: s.title,
      kind: s.kind,
      start_date: s.start_date,
      end_date: s.end_date,
      location: s.location ?? "",
      external_uid: s.uid,
    });
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => document.getElementById("commitment-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function resultError(res: { error: string; code?: string }) {
    return res.code ? t(`commitmentError_${res.code}`) : t("commitmentSaveFailed");
  }

  async function handleSubmit(input: CommitmentInput): Promise<string | null> {
    if (!form) return null;
    const res = form.mode === "edit" ? await updateCommitment(form.id, input) : await addCommitment(input);
    if ("error" in res) return resultError(res);
    onChange(mergeCommitments(commitments, [res.commitment]));
    setNotice(
      res.availabilityOverlap > 0 ? t("commitmentAvailabilityOverlap", { count: res.availabilityOverlap }) : ""
    );
    setForm(null);
    return null;
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError("");
    const result = await deleteCommitment(id);
    setDeletingId(null);
    if ("error" in result) {
      setError(t("commitmentDeleteFailed"));
      return;
    }
    if (form?.mode === "edit" && form.id === id) setForm(null);
    onChange(commitments.filter((c) => c.id !== id));
  }

  const totalsLine = (totals: EconomicsTotals) => (
    <>
      <span>{t("economyCost")} {kr(totals.cost)}</span>
      <span>{t("economyIncome")} {kr(totals.income)}</span>
      <span className={totals.net < 0 ? "text-red-400" : "text-emerald-500 dark:text-emerald-400"}>
        {t("economyNet")} {kr(totals.net)}
      </span>
    </>
  );

  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{t("commitmentsTitle")}</h2>
        <button
          onClick={() => (form ? setForm(null) : openAdd())}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--usha-card)] px-3 py-2 text-xs font-medium text-[var(--usha-muted)] ring-1 ring-[var(--usha-border)] transition hover:text-[var(--usha-white)]"
        >
          {form ? <X size={14} /> : <Plus size={14} />}
          {form ? t("commitmentCancel") : t("commitmentAdd")}
        </button>
      </div>
      <p className="mb-4 text-xs text-[var(--usha-muted)]">{t("commitmentsIntro")}</p>

      <GoogleImport
        initialMaskedUrl={importMaskedUrl}
        importedUids={importedUids}
        onAddSuggestion={openFromSuggestion}
        onRefreshed={(updated) => onChange(mergeCommitments(commitments, updated))}
      />

      {form && (
        <div id="commitment-form" className="mb-4 scroll-mt-4">
          {form.mode === "edit" && (
            <p className="mb-2 text-xs font-medium text-[var(--usha-muted)]">{t("commitmentEditing")}</p>
          )}
          <CommitmentForm key={form.key} initial={form.draft} mode={form.mode} onSubmit={handleSubmit} />
        </div>
      )}

      {notice && <p role="status" className="mb-3 text-xs text-violet-600 dark:text-violet-300">{notice}</p>}
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {/* Summering: bara när minst ett kommande åtagande har belopp. */}
      {summary.counted > 0 && (
        <div className="mb-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{t("economySummaryTitle")}</h3>
            <span className="text-[10px] uppercase tracking-wide text-[var(--usha-muted)]">{t("economyEstimated")}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">{totalsLine(summary)}</div>
          <div className="mt-3 space-y-1 border-t border-[var(--usha-border)] pt-3 text-xs text-[var(--usha-muted)]">
            {[...COMMITMENT_PURPOSES, "none" as const]
              .filter((p) => summary.byPurpose[p])
              .map((p) => (
                <div key={p} className="flex flex-wrap items-center justify-between gap-x-3">
                  <span className="font-medium text-[var(--usha-white)]">
                    {p === "none" ? t("commitmentPurposeNone") : t(`commitmentPurpose_${p}`)}
                  </span>
                  <span className="flex flex-wrap gap-x-3">{totalsLine(summary.byPurpose[p]!)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {upcoming.length > 0 ? (
          upcoming.map((c) => {
            const totals = commitmentTotals(c);
            return (
              <div
                key={c.id}
                className="rounded-xl border border-[var(--usha-border)] border-l-4 border-l-violet-500 bg-[var(--usha-card)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{c.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--usha-muted)]">
                      <span className="flex items-center gap-1">
                        <Briefcase size={10} className="shrink-0" />
                        {t(`commitmentKind_${c.kind}`)}
                        {c.role ? ` · ${c.role}` : ""}
                      </span>
                      {c.location && (
                        <span className="flex min-w-0 items-center gap-1">
                          <MapPin size={10} className="shrink-0" />
                          <span className="truncate">{c.location}</span>
                        </span>
                      )}
                      {c.source === "google" && <span>{t("commitmentFromGoogle")}</span>}
                    </div>
                    {c.note && <p className="mt-1 text-xs text-[var(--usha-muted)]">{c.note}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300">
                    {formatCommitmentRange(c)}
                  </span>
                </div>

                {totals && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--usha-muted)]">
                    {totalsLine(totals)}
                    <span className="text-[10px]">({t("economyEstimated")})</span>
                  </div>
                )}
                {c.cost_note && <p className="mt-1 text-[11px] italic text-[var(--usha-muted)]">{c.cost_note}</p>}

                <div className="mt-2 flex justify-end gap-1">
                  <button
                    onClick={() => {
                      setError("");
                      setNotice("");
                      setForm({ mode: "edit", id: c.id, draft: draftFromCommitment(c), key: `edit-${c.id}-${Date.now()}` });
                      requestAnimationFrame(() =>
                        document.getElementById("commitment-form")?.scrollIntoView({ behavior: "smooth", block: "start" })
                      );
                    }}
                    aria-label={ta("editCommitment")}
                    className="rounded p-1.5 text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    aria-label={ta("removeCommitment")}
                    className="rounded p-1.5 text-[var(--usha-muted)] transition hover:text-red-400 disabled:opacity-50"
                  >
                    {deletingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full rounded-xl border border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-6 text-center text-sm text-[var(--usha-muted)]">
            {t("noCommitments")}
          </div>
        )}
      </div>
    </section>
  );
}
