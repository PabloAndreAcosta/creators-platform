import type { Metadata } from "next";
import Link from "next/link";
import { Check, Ticket, QrCode, Layers, Users, BellRing, Receipt, ArrowRight } from "lucide-react";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Sälj biljetter på Usha – lägre avgift än Tickster",
  description:
    "Sälj och leverera biljetter till dina event via Usha. 3 % serviceavgift (max 15 kr/biljett), QR-biljetter, incheckning och utbetalning via Stripe. Gratis event är alltid gratis.",
  alternates: { canonical: "/salj-biljetter" },
  openGraph: {
    title: "Sälj biljetter på Usha",
    description:
      "Lägre avgift än Tickster. 3 % (max 15 kr/biljett), QR-biljetter och utbetalning via Stripe.",
    url: "https://usha.se/salj-biljetter",
    type: "website",
    locale: "sv_SE",
    siteName: "Usha Platform",
  },
};

const FEATURES = [
  { icon: Ticket, title: "Betald- och gratisbiljetter", body: "Sätt pris eller gör eventet gratis. Early bird, rabattkoder och åtkomstkoder ingår." },
  { icon: Layers, title: "Biljett-typer", body: "Flera pris-nivåer per event – t.ex. Ordinarie, VIP och Student, var och en med egen kapacitet." },
  { icon: Users, title: "Flerköp med QR per gäst", body: "Köp flera biljetter i ett köp – varje gäst får en egen skanningsbar QR och kan namnges." },
  { icon: QrCode, title: "QR-biljett direkt", body: "Köparen får sin QR-biljett på mejl och sida – ingen inloggning krävs. Skanna vid dörren." },
  { icon: BellRing, title: "Väntelista som säljer", body: "Slutsålt? Frigörs en plats vid en avbokning mejlas nästa person i kön automatiskt." },
  { icon: Receipt, title: "Utbetalning & avräkning", body: "Pengarna går direkt till ditt Stripe-konto, med per-event-avräkning och CSV-export." },
];

const COMPARE = [
  { label: "Serviceavgift", usha: "3 % (min 3 kr, max 15 kr)", tickster: "ofta ~20 kr/biljett" },
  { label: "Gratis event", usha: "0 kr – alltid gratis", tickster: "avgift kan tillkomma" },
  { label: "Vem betalar avgiften", usha: "du väljer – köpare eller du", tickster: "oftast köparen" },
  { label: "Fast månadskostnad", usha: "0 kr", tickster: "varierar" },
];

export default function SellTicketsPage() {
  return (
    <main className="bg-[var(--usha-black)] text-[var(--usha-white)]">
      <Nav />

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-12 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
          <Ticket size={13} /> Biljettförsäljning
        </span>
        <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
          Sälj biljetter på Usha – <span className="text-[var(--usha-gold)]">billigare än Tickster</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--usha-muted)]">
          Skapa ditt event, dela länken och leverera QR-biljetter automatiskt. Bara{" "}
          <strong className="text-[var(--usha-white)]">3 % i serviceavgift</strong> (max 15 kr per biljett),
          inga fasta kostnader – och du väljer själv om köparen eller du står för avgiften.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app/events/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--usha-gold)] px-5 py-3 text-sm font-semibold text-[var(--usha-black)] transition hover:opacity-90"
          >
            Skapa event <ArrowRight size={16} />
          </Link>
          <Link
            href="/upplevelser"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-5 py-3 text-sm font-medium text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/40"
          >
            Se event live
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
              <f.icon className="h-6 w-6 text-[var(--usha-gold)]" />
              <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--usha-muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing card */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-[var(--usha-gold)]/30 bg-gradient-to-b from-[var(--usha-gold)]/10 to-transparent p-8 text-center">
          <p className="text-sm text-[var(--usha-muted)]">Serviceavgift per såld biljett</p>
          <p className="mt-2 text-5xl font-bold text-[var(--usha-gold)]">3 %</p>
          <p className="mt-2 text-sm text-[var(--usha-muted)]">min 3 kr · max 15 kr per biljett · gratis event = 0 kr</p>
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
            {[
              "Inga fasta månadskostnader",
              "Du väljer: köparen betalar eller du står för avgiften",
              "Utbetalning direkt till ditt Stripe-konto",
              "QR-biljetter, incheckning och statistik ingår",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--usha-gold)]" />
                <span className="text-[var(--usha-muted)]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="mb-5 text-center text-2xl font-bold">Usha vs. Tickster</h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--usha-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--usha-border)] bg-[var(--usha-card)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--usha-muted)]"></th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--usha-gold)]">Usha</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--usha-muted)]">Tickster</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr key={row.label} className={i % 2 ? "bg-[var(--usha-card)]/40" : ""}>
                  <td className="px-4 py-3 text-[var(--usha-muted)]">{row.label}</td>
                  <td className="px-4 py-3 font-medium text-[var(--usha-white)]">{row.usha}</td>
                  <td className="px-4 py-3 text-[var(--usha-muted)]">{row.tickster}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-xs text-[var(--usha-muted)]">
          Tickster publicerar ingen fast prislista; siffrorna är branschgängse uppskattningar och kan variera.
        </p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h2 className="text-2xl font-bold">Redo att sälja din första biljett?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--usha-muted)]">
          Skapa ett konto, lägg upp eventet och dela länken. Vi sköter biljetter, betalning och incheckning.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--usha-gold)] px-6 py-3 text-sm font-semibold text-[var(--usha-black)] transition hover:opacity-90"
        >
          Kom igång gratis <ArrowRight size={16} />
        </Link>
      </section>

      <Footer />
    </main>
  );
}
