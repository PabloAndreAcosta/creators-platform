import Link from "next/link";
import { ShieldCheck, ShieldAlert } from "lucide-react";

interface BankIdStatusProps {
  verifiedAt: string | null;
  bankidName: string | null;
  isCreatorRole: boolean;
}

export function BankIdStatus({
  verifiedAt,
  bankidName,
  isCreatorRole,
}: BankIdStatusProps) {
  if (verifiedAt) {
    const date = new Date(verifiedAt);
    const formatted = date.toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
            <ShieldCheck size={24} className="text-green-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-green-400">
              Identitet verifierad med BankID
            </h2>
            <p className="mt-1 text-sm text-[var(--usha-muted)]">
              {bankidName ? (
                <>
                  Verifierad som <span className="text-white">{bankidName}</span>{" "}
                  den {formatted}.
                </>
              ) : (
                <>Verifierad den {formatted}.</>
              )}
            </p>
            <p className="mt-2 text-xs text-[var(--usha-muted)]">
              Visas som grön sköld bredvid ditt namn på marketplace.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--usha-muted)]/10">
          <ShieldAlert size={24} className="text-[var(--usha-muted)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Identitet ej verifierad</h2>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {isCreatorRole
              ? "Verifiera ditt konto med BankID för att visa kunder att du är den du utger dig för att vara."
              : "Verifiera ditt konto med BankID om du senare vill bli kreatör eller upplevelseförmedlare."}
          </p>
          <Link
            href="/signup"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
          >
            <ShieldCheck size={14} /> Verifiera med BankID
          </Link>
        </div>
      </div>
    </div>
  );
}
