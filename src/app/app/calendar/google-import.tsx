"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarArrowDown, EyeOff, Link2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  saveExternalCalendarUrl,
  removeExternalCalendarUrl,
  fetchExternalCalendar,
  hideCalendarSuggestion,
  type CalendarSuggestion,
} from "./actions";
import { formatCommitmentRange, type Commitment } from "@/lib/calendar/commitments";
import { INPUT_CLASS } from "./commitment-form";

/**
 * "Från Google": koppla kalenderns hemliga iCal-adress och hämta händelser som
 * förslag. Inget läggs in automatiskt — varje förslag läggs till med ett tryck
 * (formuläret öppnas förifyllt) eller döljs.
 */
export function GoogleImport({
  initialMaskedUrl,
  importedUids,
  onAddSuggestion,
  onRefreshed,
}: {
  initialMaskedUrl: string | null;
  /** UID:n som redan finns som åtaganden — de visas inte som förslag. */
  importedUids: Set<string>;
  onAddSuggestion: (s: CalendarSuggestion) => void;
  onRefreshed: (updated: Commitment[]) => void;
}) {
  const t = useTranslations("calendarPage");
  const [maskedUrl, setMaskedUrl] = useState<string | null>(initialMaskedUrl);
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState<"save" | "fetch" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [suggestions, setSuggestions] = useState<CalendarSuggestion[] | null>(null);

  const visible = (suggestions || []).filter((s) => !importedUids.has(s.uid));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError("");
    const res = await saveExternalCalendarUrl(urlInput);
    setBusy(null);
    if ("error" in res) {
      setError(res.code === "invalidUrl" ? t("importErrorUrl") : t("importErrorSave"));
      return;
    }
    setMaskedUrl(res.masked);
    setUrlInput("");
    void handleFetch();
  }

  async function handleFetch() {
    setBusy("fetch");
    setError("");
    setInfo("");
    const res = await fetchExternalCalendar();
    setBusy(null);
    if ("error" in res) {
      setError(t(`importError_${res.code}`));
      return;
    }
    setSuggestions(res.suggestions);
    if (res.refreshed.length) {
      onRefreshed(res.refreshed);
      setInfo(t("importRefreshed", { count: res.refreshed.length }));
    }
  }

  async function handleRemove() {
    setBusy("remove");
    setError("");
    const res = await removeExternalCalendarUrl();
    setBusy(null);
    if ("error" in res) {
      setError(t("importErrorSave"));
      return;
    }
    setMaskedUrl(null);
    setSuggestions(null);
    setInfo("");
  }

  async function handleHide(uid: string) {
    setSuggestions((prev) => (prev || []).filter((s) => s.uid !== uid));
    const res = await hideCalendarSuggestion(uid);
    if ("error" in res) setError(t("importErrorHide"));
  }

  return (
    <div className="mb-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <CalendarArrowDown size={14} className="text-violet-600 dark:text-violet-300" />
        {t("importTitle")}
      </h3>

      {!maskedUrl ? (
        <>
          <p className="mt-1 text-xs text-[var(--usha-muted)]">{t("importIntro")}</p>
          <details className="mt-2 text-xs text-[var(--usha-muted)]">
            <summary className="cursor-pointer font-medium text-[var(--usha-white)]">{t("importHelpSummary")}</summary>
            <p className="mt-1">{t("importHelpSteps")}</p>
            <p className="mt-1">{t("importHelpWorkspace")}</p>
            <p className="mt-1">{t("importHelpPrivacy")}</p>
          </details>
          <form onSubmit={handleSave} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-[10px] text-[var(--usha-muted)]">
              {t("importUrlLabel")}
              <input
                type="url"
                required
                autoComplete="off"
                spellCheck={false}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                className={INPUT_CLASS}
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-600 transition hover:bg-violet-500/30 disabled:opacity-50 dark:text-violet-300"
            >
              {busy === "save" ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              {t("importConnect")}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-1 break-all text-xs text-[var(--usha-muted)]">
            {t("importConnectedTo")} <span className="font-mono">{maskedUrl}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void handleFetch()}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-600 transition hover:bg-violet-500/30 disabled:opacity-50 dark:text-violet-300"
            >
              {busy === "fetch" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {t("importFetch")}
            </button>
            <button
              onClick={() => void handleRemove()}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--usha-muted)] ring-1 ring-[var(--usha-border)] transition hover:text-red-400 disabled:opacity-50"
            >
              {busy === "remove" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {t("importDisconnect")}
            </button>
          </div>
        </>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {info && <p role="status" className="mt-2 text-xs text-violet-600 dark:text-violet-300">{info}</p>}

      {suggestions !== null && (
        <div className="mt-3 space-y-2">
          {visible.length === 0 ? (
            <p className="text-xs text-[var(--usha-muted)]">{t("importNoSuggestions")}</p>
          ) : (
            visible.map((s) => (
              <div
                key={s.uid}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.title || t("importUntitled")}</p>
                  <p className="truncate text-[11px] text-[var(--usha-muted)]">
                    {formatCommitmentRange(s)}
                    {s.location ? ` · ${s.location}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => onAddSuggestion(s)}
                    className="flex items-center gap-1 rounded-lg bg-violet-500/20 px-2.5 py-1.5 text-xs font-medium text-violet-600 transition hover:bg-violet-500/30 dark:text-violet-300"
                  >
                    <Plus size={12} />
                    {t("importAdd")}
                  </button>
                  <button
                    onClick={() => void handleHide(s.uid)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
                  >
                    <EyeOff size={12} />
                    {t("importHide")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
