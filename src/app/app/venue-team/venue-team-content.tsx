"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, UserPlus, Check, X, Copy, ShieldCheck } from "lucide-react";
import { VENUE_PRESETS } from "@/lib/venues/members";

/** Förval → behörigheter. Samma källa som servern, så de inte kan glida isär. */
const PRESET_CAPS: Record<string, string[]> = Object.fromEntries(
  Object.entries(VENUE_PRESETS).map(([k, v]) => [k, [...v]])
);

interface Cap { key: string; label: string; hint: string }
interface Preset { key: string; label: string; hint: string }

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  capabilities: string[];
  accepted: boolean;
  inviteToken: string | null;
}

interface Labels {
  heading: string; intro: string; ownerNote: string; empty: string;
  invite: string; inviteEmail: string; inviteSubmit: string;
  pending: string; copyLink: string; copied: string;
  remove: string; save: string; saved: string; failed: string; customPreset: string;
}

export default function VenueTeamContent({
  appUrl, capabilities, presets, labels,
}: {
  appUrl: string;
  capabilities: Cap[];
  presets: Preset[];
  labels: Labels;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [email, setEmail] = useState("");
  const [newCaps, setNewCaps] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/venue/members");
      const d = await r.json();
      setMembers(d.members ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  }

  async function invite() {
    if (!email.trim()) return;
    setInviting(true);
    setError(false);
    try {
      const r = await fetch("/api/venue/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, capabilities: newCaps }),
      });
      if (!r.ok) throw new Error();
      setEmail("");
      setNewCaps([]);
      await load();
    } catch {
      setError(true);
    } finally {
      setInviting(false);
    }
  }

  async function saveCaps(m: Member) {
    setBusy(m.id);
    try {
      const r = await fetch(`/api/venue/members/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capabilities: m.capabilities }),
      });
      if (!r.ok) throw new Error();
      setSavedId(m.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      const r = await fetch(`/api/venue/members/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  const capBox = (
    selected: string[],
    onToggle: (k: string) => void,
    idPrefix: string
  ) => (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {capabilities.map((c) => (
        <label
          key={c.key}
          htmlFor={`${idPrefix}-${c.key}`}
          className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--usha-border)] px-3 py-2.5 transition hover:border-[var(--usha-gold)]/40"
        >
          <input
            id={`${idPrefix}-${c.key}`}
            type="checkbox"
            checked={selected.includes(c.key)}
            onChange={() => onToggle(c.key)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--usha-gold)]"
          />
          <span>
            <span className="block text-sm font-medium">{c.label}</span>
            <span className="block text-xs text-[var(--usha-muted)]">{c.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-2 text-xl font-bold">{labels.heading}</h1>
        <p className="mb-4 text-sm text-[var(--usha-muted)]">{labels.intro}</p>

        <p className="mb-8 flex items-start gap-2.5 rounded-xl border border-[var(--usha-gold)]/25 bg-[var(--usha-gold)]/5 px-4 py-3 text-xs leading-relaxed text-[var(--usha-muted)]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--usha-gold)]" />
          {labels.ownerNote}
        </p>

        {error && (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            {labels.failed}
          </p>
        )}

        {/* Bjud in */}
        <section className="mb-10 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UserPlus size={15} className="text-[var(--usha-gold)]" />
            {labels.invite}
          </h2>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={labels.inviteEmail}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />

          {/* Förvalen är bara knippen av samma sex kryssrutor — de fyller i
              rutorna nedan i stället för att vara en egen mekanism. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                title={p.hint}
                onClick={() => setNewCaps(PRESET_CAPS[p.key] ?? [])}
                className="rounded-full border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--usha-gold)]/40"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNewCaps([])}
              className="rounded-full border border-[var(--usha-border)] px-3 py-1.5 text-xs text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/40"
            >
              {labels.customPreset}
            </button>
          </div>

          {capBox(newCaps, (k) => setNewCaps((s) => toggle(s, k)), "new")}

          <button
            onClick={invite}
            disabled={inviting || !email.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {inviting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {labels.inviteSubmit}
          </button>
        </section>

        {/* Medlemmar */}
        {loading ? (
          <Loader2 size={18} className="animate-spin text-[var(--usha-muted)]" />
        ) : members.length === 0 ? (
          <p className="text-sm text-[var(--usha-muted)]">{labels.empty}</p>
        ) : (
          <ul className="space-y-4">
            {members.map((m) => (
              <li key={m.id} className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{m.name || m.email}</p>
                    {!m.accepted && (
                      <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                        {labels.pending}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => remove(m.id)}
                    disabled={busy === m.id}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-border)] px-3 py-1.5 text-xs transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                  >
                    <X size={12} />
                    {labels.remove}
                  </button>
                </div>

                {capBox(
                  m.capabilities,
                  (k) =>
                    setMembers((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, capabilities: toggle(x.capabilities, k) } : x))
                    ),
                  m.id
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => saveCaps(m)}
                    disabled={busy === m.id}
                    className="rounded-full border border-[var(--usha-border)] px-4 py-2 text-xs font-medium transition hover:border-[var(--usha-gold)]/40 disabled:opacity-50"
                  >
                    {savedId === m.id ? labels.saved : labels.save}
                  </button>

                  {m.inviteToken && (
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(`${appUrl}/app/venue-team/join/${m.inviteToken}`);
                        setCopied(m.id);
                        setTimeout(() => setCopied(null), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-border)] px-4 py-2 text-xs font-medium transition hover:border-[var(--usha-gold)]/40"
                    >
                      <Copy size={12} />
                      {copied === m.id ? labels.copied : labels.copyLink}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
