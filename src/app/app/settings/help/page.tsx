import { ArrowLeft, HelpCircle, MessageCircle, Mail, FileText } from "lucide-react";
import Link from "next/link";

const faqs = [
  {
    q: "Hur bokar jag en tjänst?",
    a: "Gå till Marketplace, hitta en kreatör och klicka på 'Boka'. Välj datum och tid, och skicka din förfrågan.",
  },
  {
    q: "Hur uppgraderar jag till Guld eller Premium?",
    a: "Gå till Profil > Betalningsmetoder och välj den plan som passar dig.",
  },
  {
    q: "Hur får jag mina utbetalningar?",
    a: "Koppla ditt Stripe-konto i Dashboard > Inställningar. Utbetalningar sker automatiskt varje vecka, eller direkt via snabbutbetalning.",
  },
  {
    q: "Kan jag avboka en bokning?",
    a: "Ja, du kan avboka under Mina Bokningar så länge bokningen inte redan är slutförd.",
  },
  {
    q: "Vad är Early Bird / Guld-exklusivt?",
    a: "Guld- och Premium-medlemmar får tillgång till vissa event före alla andra. När klockan räknat ned släpps eventet för alla.",
  },
];

export default function HelpPage() {
  return (
    <div className="px-4 py-6 space-y-6 md:max-w-2xl md:mx-auto">
      <div>
        <Link
          href="/app/profile"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <div className="flex items-center gap-3">
          <HelpCircle size={20} className="text-[var(--usha-gold)]" />
          <h1 className="text-2xl font-bold">Hjälp & Support</h1>
        </div>
      </div>

      {/* Contact options */}
      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="mailto:support@usha.se"
          className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition-colors hover:border-[var(--usha-gold)]/20"
        >
          <Mail size={20} className="text-[var(--usha-gold)]" />
          <div>
            <p className="text-sm font-medium">E-post</p>
            <p className="text-xs text-[var(--usha-muted)]">support@usha.se</p>
          </div>
        </a>
        <a
          href="https://instagram.com/ushaplatform"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition-colors hover:border-[var(--usha-gold)]/20"
        >
          <MessageCircle size={20} className="text-[var(--usha-gold)]" />
          <div>
            <p className="text-sm font-medium">Instagram DM</p>
            <p className="text-xs text-[var(--usha-muted)]">@ushaplatform</p>
          </div>
        </a>
      </div>

      {/* FAQ */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <FileText size={16} className="text-[var(--usha-gold)]" />
          <h2 className="text-lg font-bold">Vanliga frågor</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden"
            >
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-[var(--usha-card-hover)] [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{faq.q}</span>
                <span className="text-[var(--usha-muted)] transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-[var(--usha-border)] px-4 py-3">
                <p className="text-sm text-[var(--usha-muted)]">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Legal links */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-[var(--usha-muted)]">
        <Link href="/privacy" className="underline hover:text-white">Integritetspolicy</Link>
        <Link href="/terms" className="underline hover:text-white">Användarvillkor</Link>
        <Link href="/cookies" className="underline hover:text-white">Cookiepolicy</Link>
      </div>
    </div>
  );
}
