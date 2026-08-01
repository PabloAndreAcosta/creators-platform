import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";

export const metadata = { title: "Tack för ditt köp — Usha Platform" };

// Post-purchase confirmation for GUEST ticket buyers (no account). The Stripe
// success_url points here so a buyer gets a clear "it worked" screen instead of
// landing on the feed. The actual ticket (QR) is delivered by email.
export default function TicketPurchaseDonePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--usha-gold)]/15">
        <CheckCircle2 size={36} className="text-[var(--usha-gold)]" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--usha-white)]">Tack för ditt köp! 🎉</h1>
      <p className="mb-6 max-w-md text-sm text-[var(--usha-muted)]">
        Din biljett är bekräftad. Vi har mejlat den till dig — öppna mejlet och
        visa QR-koden vid entrén.
      </p>
      <div className="mb-8 flex items-center gap-2 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm text-[var(--usha-white)]">
        <Mail size={16} className="text-[var(--usha-gold)]" />
        Kolla din inkorg (och skräpposten) om några minuter.
      </div>
      <Link
        href="/"
        className="rounded-lg border border-[var(--usha-border)] px-5 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
      >
        Till startsidan
      </Link>
    </div>
  );
}
