"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, PenLine, Send, X, Undo2, Printer } from "lucide-react";
import Link from "next/link";

interface Props {
  id: string;
  status: "draft" | "sent" | "signed" | "declined" | "withdrawn";
  isCreator: boolean;
  /** Kan jag skriva under? (BankID-verifierat konto med namn.) */
  canSign: boolean;
  /** Får jag skicka avtal (Premium)? Bara relevant för skaparen. */
  canSend: boolean;
  title: string;
  body: string;
}

/**
 * Knapparna under avtalet. Vad som visas styrs av status och roll:
 * utkast → skaparen redigerar och "Signera och skicka"; skickat → motparten
 * "Signera" eller "Avböj", skaparen "Dra tillbaka"; klart → skriv ut.
 */
export function AgreementActions({ id, status, isCreator, canSign, canSend, title, body }: Props) {
  const t = useTranslations("agreements");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftBody, setDraftBody] = useState(body);
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "PATCH" | "POST", payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/agreements/${id}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const map: Record<string, string> = { premiumRequired: "errPremium", bankidRequired: "errBankid", contentChanged: "errChanged", notDraft: "errState", notSent: "errState", notOpen: "errState" };
        setError(t(map[data.error] ?? "errGeneric"));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(t("errGeneric"));
      return false;
    } finally {
      setBusy(null);
    }
  }

  const primary = "flex items-center justify-center gap-2 rounded-xl bg-[var(--usha-gold)] px-5 py-3 text-sm font-bold text-black disabled:opacity-50";
  const secondary = "flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] px-5 py-3 text-sm font-medium text-[var(--usha-muted)] hover:text-[var(--usha-white)] disabled:opacity-50";
  const inputClass = "w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2.5 text-sm text-[var(--usha-white)] focus:border-[var(--usha-gold)] focus:outline-none";

  if (editing) {
    return (
      <div className="space-y-3">
        <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className={`${inputClass} font-semibold`} maxLength={120} />
        <textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} rows={22} className={`${inputClass} font-mono text-[13px] leading-relaxed`} maxLength={20000} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={primary} disabled={busy !== null} onClick={async () => { if (await call("PATCH", { title: draftTitle, body: draftBody }, "save")) setEditing(false); }}>
            {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />} {t("saveChanges")}
          </button>
          <button className={secondary} onClick={() => { setEditing(false); setDraftTitle(title); setDraftBody(body); }}>{t("cancel")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "draft" && isCreator && (
          <>
            <button className={primary} disabled={busy !== null || !canSend || !canSign} title={!canSign ? t("errBankid") : !canSend ? t("errPremium") : undefined} onClick={() => call("POST", { action: "send" }, "send")}>
              {busy === "send" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t("signAndSend")}
            </button>
            <button className={secondary} onClick={() => setEditing(true)}><PenLine size={16} /> {t("edit")}</button>
            <button className={secondary} disabled={busy !== null} onClick={() => call("POST", { action: "withdraw" }, "withdraw")}><X size={16} /> {t("discard")}</button>
          </>
        )}
        {status === "sent" && !isCreator && !declining && (
          <>
            <button className={primary} disabled={busy !== null || !canSign} title={!canSign ? t("errBankid") : undefined} onClick={() => call("POST", { action: "sign" }, "sign")}>
              {busy === "sign" ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />} {t("sign")}
            </button>
            <button className={secondary} onClick={() => setDeclining(true)}><X size={16} /> {t("decline")}</button>
          </>
        )}
        {status === "sent" && isCreator && (
          <button className={secondary} disabled={busy !== null} onClick={() => call("POST", { action: "withdraw" }, "withdraw")}><Undo2 size={16} /> {t("withdraw")}</button>
        )}
        {status === "signed" && (
          <Link href={`/app/avtal/${id}/utskrift`} className={secondary}><Printer size={16} /> {t("print")}</Link>
        )}
      </div>
      {declining && (
        <div className="space-y-2 rounded-xl border border-[var(--usha-border)] p-3">
          <p className="text-sm">{t("declineHint")}</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} maxLength={500} placeholder={t("declinePlaceholder")} />
          <div className="flex gap-2">
            <button className={primary} disabled={busy !== null} onClick={() => call("POST", { action: "decline", reason }, "decline")}>
              {busy === "decline" ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} {t("declineConfirm")}
            </button>
            <button className={secondary} onClick={() => setDeclining(false)}>{t("cancel")}</button>
          </div>
        </div>
      )}
      {!canSign && (status === "draft" && isCreator || status === "sent" && !isCreator) && (
        <p className="text-xs text-[var(--usha-muted)]">{t("bankidHint")} <Link href="/app/settings/security" className="text-[var(--usha-gold)]">{t("bankidLink")}</Link></p>
      )}
    </div>
  );
}
