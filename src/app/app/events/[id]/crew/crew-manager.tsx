"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, Copy, Check, UserPlus, ShieldCheck, Search, ScanLine } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import {
  COLLAB_ROLES,
  BANKID_GATED_ROLES,
  collabRoleLabel,
  type CollabRole,
} from "@/lib/collaborators";

interface Collaborator {
  user_id: string;
  role: string;
  full_name: string | null;
  avatar_url: string | null;
  can_scan: boolean;
}

interface PendingInvite {
  id: string;
  role: string;
  invited_email: string | null;
  invited_phone: string | null;
  invited_name?: string | null;
  invite_url: string;
  expires_at: string;
}

interface CreatorResult {
  id: string;
  full_name: string | null;
  category: string | null;
  location: string | null;
  avatar_url: string | null;
}

export function CrewManager({
  listingId,
  initialCollaborators,
  initialPendingInvites,
}: {
  listingId: string;
  initialCollaborators: Collaborator[];
  initialPendingInvites: PendingInvite[];
}) {
  const { toast } = useToast();
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [pending, setPending] = useState(initialPendingInvites);

  const [role, setRole] = useState<CollabRole>("creator");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CreatorResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [scanToggling, setScanToggling] = useState<string | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (seq === searchSeq.current) setResults(data.creators ?? []);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function handleInviteUser(creator: CreatorResult) {
    setInvitingId(creator.id);
    try {
      const res = await fetch(`/api/listings/${listingId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, user_id: creator.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Kunde inte bjuda in");
        return;
      }
      setPending((prev) => [
        {
          id: data.id,
          role,
          invited_email: null,
          invited_phone: null,
          invited_name: creator.full_name,
          invite_url: data.invite_url,
          expires_at: data.expires_at,
        },
        ...prev,
      ]);
      setInvitedIds((prev) => new Set(prev).add(creator.id));
      toast.success(`${creator.full_name ?? "Personen"} inbjuden`);
    } catch {
      toast.error("Nätverksfel");
    } finally {
      setInvitingId(null);
    }
  }

  async function handleToggleScan(userId: string, next: boolean) {
    setScanToggling(userId);
    // optimistic
    setCollaborators((prev) =>
      prev.map((c) => (c.user_id === userId ? { ...c, can_scan: next } : c))
    );
    try {
      const res = await fetch(
        `/api/listings/${listingId}/collaborators/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ can_scan: next }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Kunde inte uppdatera");
        setCollaborators((prev) =>
          prev.map((c) => (c.user_id === userId ? { ...c, can_scan: !next } : c))
        );
        return;
      }
      toast.success(next ? "Kan skanna biljetter" : "Skann-rätt borttagen");
    } catch {
      toast.error("Nätverksfel");
      setCollaborators((prev) =>
        prev.map((c) => (c.user_id === userId ? { ...c, can_scan: !next } : c))
      );
    } finally {
      setScanToggling(null);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("Kunde inte kopiera");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const value = contact.trim();
    if (!value) {
      toast.error("Ange e-post eller telefonnummer");
      return;
    }
    const isEmail = value.includes("@");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          email: isEmail ? value : null,
          phone: isEmail ? null : value,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Kunde inte skapa inbjudan");
        return;
      }
      setPending((prev) => [
        {
          id: data.id,
          role,
          invited_email: isEmail ? value : null,
          invited_phone: isEmail ? null : value,
          invite_url: data.invite_url,
          expires_at: data.expires_at,
        },
        ...prev,
      ]);
      setContact("");
      toast.success("Inbjudan skapad");
      copy(data.invite_url, data.id);
    } catch {
      toast.error("Nätverksfel");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(userId: string) {
    setRemoving(userId);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/collaborators/${userId}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Kunde inte ta bort");
        return;
      }
      setCollaborators((prev) => prev.filter((c) => c.user_id !== userId));
      toast.success("Borttagen från crew");
    } catch {
      toast.error("Nätverksfel");
    } finally {
      setRemoving(null);
    }
  }

  const gated = BANKID_GATED_ROLES.has(role);

  return (
    <div className="mt-6 space-y-8">
      {/* Invite form */}
      <section className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-[var(--usha-gold)]" />
          <h2 className="text-base font-semibold">Bjud in</h2>
        </div>
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {COLLAB_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  role === r
                    ? "bg-[var(--usha-gold)] text-black"
                    : "border border-[var(--usha-border)] text-[var(--usha-white)] hover:text-[var(--usha-white)]"
                }`}
              >
                {collabRoleLabel(r)}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="E-post eller telefonnummer"
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-4 py-3 text-sm text-[var(--usha-white)] placeholder:text-[var(--usha-muted)] focus:border-[var(--usha-gold)] focus:outline-none"
          />
          {gated && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-300/90">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" />
              {collabRoleLabel(role)} kräver att personen är BankID-verifierad innan
              hen kan tacka ja.
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Skapa inbjudningslänk
          </button>
        </form>

        {/* Or: invite an existing Usch-Ja creator directly by profile */}
        <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-[var(--usha-muted)]">
          <span className="h-px flex-1 bg-[var(--usha-border)]" />
          eller sök på Usch-Ja
          <span className="h-px flex-1 bg-[var(--usha-border)]" />
        </div>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--usha-muted)]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök kreatör efter namn"
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] py-3 pl-10 pr-4 text-sm text-[var(--usha-white)] placeholder:text-[var(--usha-muted)] focus:border-[var(--usha-gold)] focus:outline-none"
          />
          {searching && (
            <Loader2
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--usha-muted)]"
            />
          )}
        </div>
        {query.trim().length >= 2 && (
          <div className="mt-2 space-y-1.5">
            {!searching && results.length === 0 && (
              <p className="px-1 py-2 text-xs text-[var(--usha-muted)]">
                Inga kreatörer hittades. De måste ha en publik profil för att synas här.
              </p>
            )}
            {results.map((cr) => {
              const invited = invitedIds.has(cr.id);
              return (
                <div
                  key={cr.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] p-2.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--usha-card)] text-sm font-semibold text-[var(--usha-muted)]">
                    {cr.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cr.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (cr.full_name ?? "?").slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-[var(--usha-white)]">
                      {cr.full_name ?? "Kreatör"}
                    </p>
                    {(cr.category || cr.location) && (
                      <p className="line-clamp-1 text-[11px] text-[var(--usha-muted)]">
                        {[cr.category, cr.location].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInviteUser(cr)}
                    disabled={invited || invitingId === cr.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--usha-gold)] px-3 py-1.5 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    {invitingId === cr.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : invited ? (
                      <Check size={13} />
                    ) : (
                      <UserPlus size={13} />
                    )}
                    {invited ? "Inbjuden" : `Bjud in som ${collabRoleLabel(role).toLowerCase()}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Accepted crew */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
          Crew ({collaborators.length})
        </h2>
        {collaborators.length === 0 ? (
          <p className="text-sm text-[var(--usha-muted)]">Ingen har tackat ja än.</p>
        ) : (
          <div className="space-y-2">
            {collaborators.map((c) => (
              <div
                key={c.user_id}
                className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--usha-black)] text-sm font-semibold text-[var(--usha-muted)]">
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (c.full_name ?? "?").slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-[var(--usha-white)]">
                    {c.full_name ?? "Medverkande"}
                  </p>
                  <p className="text-[11px] text-[var(--usha-muted)]">
                    {collabRoleLabel(c.role)}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleScan(c.user_id, !c.can_scan)}
                  disabled={scanToggling === c.user_id}
                  aria-pressed={c.can_scan}
                  title="Låt den här personen skanna biljetter för eventet"
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                    c.can_scan
                      ? "bg-[var(--usha-gold)] text-black"
                      : "border border-[var(--usha-border)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
                  }`}
                >
                  {scanToggling === c.user_id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ScanLine size={13} />
                  )}
                  {c.can_scan ? "Kan skanna" : "Skanna"}
                </button>
                <button
                  onClick={() => handleRemove(c.user_id)}
                  disabled={removing === c.user_id}
                  className="rounded-lg p-2 text-[var(--usha-muted)] transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  aria-label="Ta bort"
                >
                  {removing === c.user_id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending invites */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
            Väntar på svar ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((inv) => {
              const expired = new Date(inv.expires_at).getTime() < Date.now();
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm text-[var(--usha-white)]">
                      {inv.invited_name ?? inv.invited_email ?? inv.invited_phone ?? "Inbjudan"}
                    </p>
                    <p className="text-[11px] text-[var(--usha-muted)]">
                      {collabRoleLabel(inv.role)}
                      {expired ? " · utgången" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => copy(inv.invite_url, inv.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs text-[var(--usha-white)] transition hover:text-[var(--usha-white)]"
                  >
                    {copied === inv.id ? <Check size={13} /> : <Copy size={13} />}
                    {copied === inv.id ? "Kopierad" : "Kopiera länk"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
