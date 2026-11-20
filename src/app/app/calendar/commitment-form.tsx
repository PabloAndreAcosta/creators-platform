"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, Plus, Check } from "lucide-react";
import {
  COMMITMENT_KINDS,
  COMMITMENT_LIMITS,
  COMMITMENT_PURPOSES,
  COMMITMENT_COST_FIELDS,
  kronorToOre,
  oreToKronorInput,
  type Commitment,
  type CommitmentAmountField,
  type CommitmentInput,
  type CommitmentKind,
} from "@/lib/calendar/commitments";

export const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm text-[var(--usha-white)]";
const LABEL_CLASS = "block text-[10px] text-[var(--usha-muted)]";

/** Formulärets tillstånd: belopp som text i kronor, som de skrivs. */
export interface CommitmentDraft {
  title: string;
  kind: CommitmentKind;
  role: string;
  start_date: string;
  end_date: string;
  location: string;
  note: string;
  purpose: string;
  amounts: Record<CommitmentAmountField, string>;
  cost_note: string;
  /** Satt när utkastet kommer från ett kalenderförslag. */
  external_uid: string | null;
}

const EMPTY_AMOUNTS: Record<CommitmentAmountField, string> = {
  cost_transport_ore: "",
  cost_lodging_ore: "",
  cost_food_ore: "",
  cost_ticket_ore: "",
  cost_other_ore: "",
  income_ore: "",
};

export function emptyDraft(): CommitmentDraft {
  return {
    title: "",
    kind: "festival",
    role: "",
    start_date: "",
    end_date: "",
    location: "",
    note: "",
    purpose: "",
    amounts: { ...EMPTY_AMOUNTS },
    cost_note: "",
    external_uid: null,
  };
}

export function draftFromCommitment(c: Commitment): CommitmentDraft {
  return {
    title: c.title,
    kind: c.kind,
    role: c.role ?? "",
    start_date: c.start_date,
    end_date: c.end_date,
    location: c.location ?? "",
    note: c.note ?? "",
    purpose: c.purpose ?? "",
    amounts: {
      cost_transport_ore: oreToKronorInput(c.cost_transport_ore),
      cost_lodging_ore: oreToKronorInput(c.cost_lodging_ore),
      cost_food_ore: oreToKronorInput(c.cost_food_ore),
      cost_ticket_ore: oreToKronorInput(c.cost_ticket_ore),
      cost_other_ore: oreToKronorInput(c.cost_other_ore),
      income_ore: oreToKronorInput(c.income_ore),
    },
    cost_note: c.cost_note ?? "",
    external_uid: c.external_uid,
  };
}

/** Utkast → indata till serveråtgärden; null om ett belopp inte går att läsa. */
function draftToInput(d: CommitmentDraft): CommitmentInput | null {
  const amounts: Partial<Record<CommitmentAmountField, number | null>> = {};
  for (const [field, text] of Object.entries(d.amounts) as [CommitmentAmountField, string][]) {
    const ore = kronorToOre(text);
    if (ore === "invalid") return null;
    amounts[field] = ore;
  }
  return {
    title: d.title,
    kind: d.kind,
    role: d.role,
    start_date: d.start_date,
    // Tomt slutdatum = endagsåtagande.
    end_date: d.end_date || d.start_date,
    location: d.location,
    note: d.note,
    purpose: d.purpose || null,
    ...amounts,
    cost_note: d.cost_note,
    external_uid: d.external_uid,
  };
}

const hasEconomics = (d: CommitmentDraft) =>
  !!d.purpose || !!d.cost_note || Object.values(d.amounts).some((v) => v.trim() !== "");

export function CommitmentForm({
  initial,
  mode,
  onSubmit,
}: {
  initial: CommitmentDraft;
  mode: "add" | "edit";
  /** Returnerar ett översatt felmeddelande, eller null när det gick bra. */
  onSubmit: (input: CommitmentInput) => Promise<string | null>;
}) {
  const t = useTranslations("calendarPage");
  const [draft, setDraft] = useState<CommitmentDraft>(initial);
  const [economyOpen, setEconomyOpen] = useState(hasEconomics(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof CommitmentDraft>(key: K, value: CommitmentDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));
  const setAmount = (field: CommitmentAmountField, value: string) =>
    setDraft((prev) => ({ ...prev, amounts: { ...prev.amounts, [field]: value } }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const input = draftToInput(draft);
    if (!input) {
      setError(t("commitmentError_amountInvalid"));
      setEconomyOpen(true);
      return;
    }
    setSaving(true);
    const err = await onSubmit(input);
    setSaving(false);
    if (err) setError(err);
  }

  const amountLabel: Record<CommitmentAmountField, string> = {
    cost_transport_ore: t("commitmentCostTransport"),
    cost_lodging_ore: t("commitmentCostLodging"),
    cost_food_ore: t("commitmentCostFood"),
    cost_ticket_ore: t("commitmentCostTicket"),
    cost_other_ore: t("commitmentCostOther"),
    income_ore: t("commitmentIncome"),
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
      <label className={LABEL_CLASS}>
        {t("commitmentFieldTitle")}
        <input
          required
          maxLength={COMMITMENT_LIMITS.title}
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={t("commitmentTitlePlaceholder")}
          className={INPUT_CLASS}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className={LABEL_CLASS}>
          {t("commitmentFieldKind")}
          <select
            value={draft.kind}
            onChange={(e) => set("kind", e.target.value as CommitmentKind)}
            className={INPUT_CLASS}
          >
            {COMMITMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`commitmentKind_${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          {t("commitmentFieldRole")}
          <input
            maxLength={COMMITMENT_LIMITS.role}
            value={draft.role}
            onChange={(e) => set("role", e.target.value)}
            placeholder={t("commitmentRolePlaceholder")}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className={LABEL_CLASS}>
          {t("commitmentFieldStart")}
          <input
            type="date"
            required
            value={draft.start_date}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((prev) => ({
                ...prev,
                start_date: v,
                end_date: prev.end_date && v > prev.end_date ? v : prev.end_date,
              }));
            }}
            className={INPUT_CLASS}
          />
        </label>
        <label className={LABEL_CLASS}>
          {t("commitmentFieldEnd")}
          <input
            type="date"
            min={draft.start_date || undefined}
            value={draft.end_date}
            onChange={(e) => set("end_date", e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <label className={LABEL_CLASS}>
        {t("commitmentFieldLocation")}
        <input
          maxLength={COMMITMENT_LIMITS.location}
          value={draft.location}
          onChange={(e) => set("location", e.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label className={LABEL_CLASS}>
        {t("commitmentFieldNote")}
        <textarea
          rows={2}
          maxLength={COMMITMENT_LIMITS.note}
          value={draft.note}
          onChange={(e) => set("note", e.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      {/* Ekonomi: hopfälld som standard — de flesta åtaganden läggs in utan belopp. */}
      <div className="rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)]">
        <button
          type="button"
          onClick={() => setEconomyOpen(!economyOpen)}
          aria-expanded={economyOpen}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
        >
          <span>{t("commitmentEconomy")}</span>
          <ChevronDown size={14} className={`transition ${economyOpen ? "rotate-180" : ""}`} />
        </button>
        {economyOpen && (
          <div className="space-y-3 border-t border-[var(--usha-border)] p-3">
            <p className="text-[10px] text-[var(--usha-muted)]">{t("commitmentEconomyHint")}</p>
            <label className={LABEL_CLASS}>
              {t("commitmentFieldPurpose")}
              <select value={draft.purpose} onChange={(e) => set("purpose", e.target.value)} className={INPUT_CLASS}>
                <option value="">{t("commitmentPurposeNone")}</option>
                {COMMITMENT_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {t(`commitmentPurpose_${p}`)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[...COMMITMENT_COST_FIELDS, "income_ore" as const].map((field) => (
                <label key={field} className={LABEL_CLASS}>
                  {amountLabel[field]}
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft.amounts[field]}
                    onChange={(e) => setAmount(field, e.target.value)}
                    placeholder="0"
                    className={INPUT_CLASS}
                  />
                </label>
              ))}
            </div>
            <label className={LABEL_CLASS}>
              {t("commitmentFieldCostNote")}
              <textarea
                rows={2}
                maxLength={COMMITMENT_LIMITS.costNote}
                value={draft.cost_note}
                onChange={(e) => set("cost_note", e.target.value)}
                placeholder={t("commitmentCostNotePlaceholder")}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-2.5 text-sm font-medium text-violet-600 transition hover:bg-violet-500/30 disabled:opacity-50 dark:text-violet-300"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : mode === "edit" ? <Check size={14} /> : <Plus size={14} />}
        {mode === "edit" ? t("commitmentSaveChanges") : t("commitmentSave")}
      </button>
    </form>
  );
}
