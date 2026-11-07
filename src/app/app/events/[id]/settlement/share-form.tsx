"use client";

import { useState, useTransition } from "react";
import { Handshake, Loader2, Trash2 } from "lucide-react";
import { saveRevenueShare, removeRevenueShare } from "./actions";

interface Labels {
  heading: string;
  intro: string;
  noVenue: string;
  percent: string;
  vat: string;
  delay: string;
  delayHint: string;
  save: string;
  saved: string;
  remove: string;
  locked: string;
  partner: string;
  partnerHint: string;
}

interface PartnerOption {
  id: string;
  name: string;
  label: string;
}

/**
 * Skapa eller ändra delningsavtalet för en kväll.
 *
 * Mottagaren väljs bland kvällens lokal och medarrangörerna i crew. Bara en
 * mottagare per kväll.
 * Låst så snart en biljett sålts: att ändra procenten mitt i en försäljning
 * ändrar vad som är skyldigt på köp som redan skett.
 */
export default function ShareForm({
  listingId,
  partnerOptions,
  hasSales,
  existing,
  labels,
}: {
  listingId: string;
  partnerOptions: PartnerOption[];
  hasSales: boolean;
  existing: { partnerProfileId: string; partnerPercent: number; vatRate: number; payoutDelayDays: number } | null;
  labels: Labels;
}) {
  const [percent, setPercent] = useState(String(existing?.partnerPercent ?? 50));
  const [vat, setVat] = useState(String(Math.round((existing?.vatRate ?? 0.25) * 100)));
  const [delay, setDelay] = useState(String(existing?.payoutDelayDays ?? 1));
  const [partnerId, setPartnerId] = useState(existing?.partnerProfileId ?? partnerOptions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const selected = partnerOptions.find((o) => o.id === partnerId) ?? partnerOptions[0] ?? null;

  if (!selected) {
    return (
      <section className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
          <Handshake size={15} className="text-[var(--usha-gold)]" />
          {labels.heading}
        </h2>
        <p className="text-xs leading-relaxed text-[var(--usha-muted)]">{labels.noVenue}</p>
      </section>
    );
  }

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveRevenueShare(listingId, {
        partnerPercent: percent,
        vatRate: vat,
        payoutDelayDays: delay,
        partnerProfileId: selected?.id,
      });
      if (res?.error) setError(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await removeRevenueShare(listingId);
      if (res?.error) setError(res.error);
    });
  }

  const field = "w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--usha-gold)]/40 disabled:opacity-50";

  return (
    <section className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
      <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        <Handshake size={15} className="text-[var(--usha-gold)]" />
        {labels.heading}
      </h2>
      <p className="mb-4 text-xs leading-relaxed text-[var(--usha-muted)]">
        {labels.intro.replace("{venue}", selected.name)}
      </p>

      {partnerOptions.length > 1 && (
        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-[var(--usha-muted)]">{labels.partner}</span>
          <select value={selected.id} disabled={hasSales}
            onChange={(e) => setPartnerId(e.target.value)} className={field}>
            {partnerOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-[var(--usha-muted)]">{labels.partnerHint}</span>
        </label>
      )}

      {hasSales && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
          {labels.locked}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--usha-muted)]">{labels.percent}</span>
          <input type="number" min={0} max={100} step={1} value={percent} disabled={hasSales}
            onChange={(e) => setPercent(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--usha-muted)]">{labels.vat}</span>
          <input type="number" min={0} max={99} step={0.1} value={vat} disabled={hasSales}
            onChange={(e) => setVat(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--usha-muted)]">{labels.delay}</span>
          <input type="number" min={0} max={30} step={1} value={delay} disabled={hasSales}
            onChange={(e) => setDelay(e.target.value)} className={field} />
        </label>
      </div>

      <p className="mt-2 text-xs text-[var(--usha-muted)]">{labels.delayHint}</p>

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={submit} disabled={pending || hasSales}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50">
          {pending ? <Loader2 size={14} className="animate-spin" /> : null}
          {saved ? labels.saved : labels.save}
        </button>
        {existing && !hasSales && (
          <button onClick={remove} disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-border)] px-4 py-2.5 text-xs font-medium transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50">
            <Trash2 size={13} />
            {labels.remove}
          </button>
        )}
      </div>
    </section>
  );
}
