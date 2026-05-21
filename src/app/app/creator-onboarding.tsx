import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Rocket } from "lucide-react";

interface Props {
  bio?: string | null;
  avatarUrl?: string | null;
  bankidVerifiedAt?: string | null;
  servicesCount: number;
  stripeAccountId?: string | null;
  isPublic?: boolean;
}

export function CreatorOnboarding({
  bio,
  avatarUrl,
  bankidVerifiedAt,
  servicesCount,
  stripeAccountId,
  isPublic,
}: Props) {
  const steps = [
    { done: !!(bio && avatarUrl), label: "Komplettera din profil", href: "/dashboard/profile" },
    { done: !!bankidVerifiedAt, label: "Verifiera med BankID", href: "/dashboard/profile" },
    { done: servicesCount > 0, label: "Skapa din första tjänst", href: "/dashboard/listings/new" },
    { done: !!stripeAccountId, label: "Anslut Stripe för utbetalningar", href: "/dashboard/payouts" },
    { done: !!isPublic, label: "Gör din profil publik", href: "/dashboard/profile" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  // Hide once everything is done — keep the dashboard clean for established creators.
  if (doneCount === steps.length) return null;

  return (
    <section className="rounded-2xl border border-[var(--usha-gold)]/25 bg-[var(--usha-gold)]/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Rocket size={16} className="text-[var(--usha-gold)]" />
          Kom igång
        </h2>
        <span className="text-xs text-[var(--usha-muted)]">{doneCount}/{steps.length} klart</span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--usha-border)]">
        <div className="h-full rounded-full bg-[var(--usha-gold)]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ul className="space-y-0.5">
        {steps.map((s) =>
          s.done ? (
            <li key={s.label} className="flex items-center gap-2 px-1 py-1.5 text-sm text-[var(--usha-muted)] line-through">
              <CheckCircle2 size={16} className="shrink-0 text-green-400" />
              {s.label}
            </li>
          ) : (
            <li key={s.label}>
              <Link href={s.href} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm transition hover:text-[var(--usha-gold)]">
                <Circle size={16} className="shrink-0 text-[var(--usha-muted)]" />
                <span className="flex-1">{s.label}</span>
                <ArrowRight size={14} className="shrink-0 text-[var(--usha-muted)]" />
              </Link>
            </li>
          )
        )}
      </ul>
    </section>
  );
}
