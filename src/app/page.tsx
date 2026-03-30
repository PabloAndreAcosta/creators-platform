"use client";

import { useState } from "react";
import { InstallPrompt } from "@/components/install-prompt";
import {
  Menu,
  X,
  ArrowRight,
  Sparkles,
  Users,
  CalendarCheck,
  CreditCard,
  Zap,
  ChevronDown,
  Palette,
  Globe,
  Search,
  Star,
  BarChart3,
  Shield,
  Ticket,
} from "lucide-react";

/* ─────────────── NAV ─────────────── */
function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "#ecosystem", label: "Ekosystemet" },
    { href: "#pricing", label: "Priser" },
    { href: "/marketplace", label: "Marketplace" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
            <span className="text-sm font-bold text-black">U</span>
          </div>
          <span className="text-lg font-bold tracking-tight">Usha</span>
        </a>

        <div className="hidden items-center gap-8 text-sm text-[var(--usha-muted)] md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-white">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/app"
            className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Öppna appen
          </a>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--usha-muted)] transition hover:text-white md:hidden"
            aria-label="Meny"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--usha-border)] bg-[var(--usha-black)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-sm text-[var(--usha-muted)] transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─────────────── HERO ─────────────── */
function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16">
      {/* Background glows */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[600px] w-[900px] rounded-full bg-[var(--usha-gold)] opacity-[0.05] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-5 py-2 text-xs">
          <Zap size={12} className="text-[var(--usha-accent)]" />
          <span className="text-[var(--usha-muted)]">Gratis under beta</span>
          <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 font-mono text-[10px] text-[var(--usha-gold)]">BETA</span>
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-up delay-100 mb-6 text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl"
          style={{ opacity: 0 }}
        >
          Kreativitet &{" "}
          <br className="hidden sm:block" />
          <span className="text-gradient">upplevelser, förenade</span>
        </h1>

        {/* Hero video */}
        <div
          className="animate-fade-up delay-150 mx-auto mb-10 max-w-3xl overflow-hidden rounded-2xl border border-[var(--usha-border)]"
          style={{ opacity: 0 }}
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full"
            suppressHydrationWarning
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
        </div>

        <p
          className="animate-fade-up delay-200 mx-auto mb-12 max-w-xl text-lg leading-relaxed text-[var(--usha-muted)]"
          style={{ opacity: 0 }}
        >
          Usha samlar kreatörer, upplevelser och kunder på en plattform.
          Profil, bokning och betalning — allt på ett ställe.
        </p>

        {/* CTA */}
        <div
          className="animate-fade-up delay-300 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          style={{ opacity: 0 }}
        >
          <a
            href="/app"
            className="glow-gold inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black transition hover:scale-[1.02] hover:opacity-90"
          >
            Kom igång gratis
            <ArrowRight size={16} />
          </a>
          <a
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-8 py-4 text-base font-medium text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/30 hover:text-white"
          >
            Utforska marketplace
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="h-8 w-5 rounded-full border-2 border-[var(--usha-border)] p-1">
          <div className="mx-auto h-2 w-1 rounded-full bg-[var(--usha-gold)]" />
        </div>
      </div>
    </section>
  );
}

/* ─────────────── ECOSYSTEM ─────────────── */
const STEPS = [
  {
    icon: Users,
    title: "Bygg din närvaro",
    desc: "Skapa en professionell profil, lägg till dina tjänster eller events och bli synlig direkt på marketplace.",
    details: [
      { icon: Palette, text: "Profil med bio, portfolio, priser och kontaktinfo" },
      { icon: Ticket, text: "Publicera tjänster, kurser eller events med bilder och beskrivning" },
      { icon: Globe, text: "Egen profiladress — usha.se/dittnamn" },
      { icon: BarChart3, text: "Statistik över visningar och besökare" },
    ],
  },
  {
    icon: CalendarCheck,
    title: "Bli upptäckt & bokad",
    desc: "Kunder hittar dig, jämför och bokar direkt med datum och tid. Inga mejlkedjor.",
    details: [
      { icon: Search, text: "Sökbar marketplace med filter på kategori, plats och pris" },
      { icon: CalendarCheck, text: "Direktbokning med kalender — kunder väljer tid som passar" },
      { icon: Ticket, text: "Biljettförsäljning till events med QR-kod och incheckning" },
      { icon: Users, text: "Meddelanden direkt mellan kreatör och kund" },
    ],
  },
  {
    icon: CreditCard,
    title: "Få betalt & väx",
    desc: "Stripe hanterar betalningen säkert. Du bygger rykte med varje bokning — fler kunder följer.",
    details: [
      { icon: CreditCard, text: "Stripe-betalningar med automatisk fakturering och utbetalning" },
      { icon: Shield, text: "Säkra transaktioner — trygg för båda parter" },
      { icon: Star, text: "Omdömen och betyg som stärker din profil" },
      { icon: BarChart3, text: "Intäktsrapporter och insikter för att växa" },
    ],
  },
];

function Ecosystem() {
  const [openStep, setOpenStep] = useState<number | null>(null);

  return (
    <section id="ecosystem" className="relative py-28 px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[500px] w-[700px] rounded-full bg-[var(--usha-gold)] opacity-[0.03] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Så fungerar <span className="text-gradient">ekosystemet</span>
          </h2>
          <p className="mx-auto max-w-lg text-[var(--usha-muted)]">
            Tre steg — från profil till intäkter. Klicka för att se mer.
          </p>
        </div>

        <div className="space-y-4">
          {STEPS.map((step, i) => {
            const isOpen = openStep === i;
            return (
              <div key={step.title} className={`rounded-2xl border bg-[var(--usha-card)] transition-all ${isOpen ? "border-[var(--usha-gold)]/30" : "border-[var(--usha-border)] hover:border-[var(--usha-gold)]/20"}`}>
                <button
                  onClick={() => setOpenStep(isOpen ? null : i)}
                  className="flex w-full items-center gap-4 p-6 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                    <step.icon size={18} className="text-black" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--usha-muted)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-semibold">{step.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-[var(--usha-muted)]">{step.desc}</p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[var(--usha-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--usha-border)] px-6 pb-6 pt-4">
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {step.details.map((detail) => (
                        <li key={detail.text} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
                            <detail.icon size={14} className="text-[var(--usha-gold)]" />
                          </div>
                          <span className="text-sm text-[var(--usha-muted)]">{detail.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── PRICING ─────────────── */
const ROLE_TABS = [
  { key: "publik" as const, label: "Publik" },
  { key: "kreator" as const, label: "Kreatör" },
  { key: "upplevelse" as const, label: "Upplevelse" },
];

const PRICING_DATA: Record<string, { gratis: { features: string[] }; guld: { price: number; features: string[]; popular: boolean }; premium: { price: number; features: string[]; popular: boolean } }> = {
  publik: {
    gratis: {
      features: [
        "Skapa profil och logga in",
        "Bläddra i marknadsplatsen",
        "Köpa biljetter och boka kreatörer",
      ],
    },
    guld: {
      price: 199,
      popular: true,
      features: [
        "10% rabatt på bokningar",
        "Tidig tillgång 48h före alla andra",
        "Prioriterad support",
        "Kalendersync",
      ],
    },
    premium: {
      price: 499,
      popular: false,
      features: [
        "20% rabatt på bokningar",
        "VIP — aldrig i kö",
        "Exklusivt innehåll",
        "72h tidig tillgång",
      ],
    },
  },
  kreator: {
    gratis: {
      features: [
        "Upp till 3 tjänster",
        "15% kommission",
        "Grundläggande statistik",
      ],
    },
    guld: {
      price: 299,
      popular: true,
      features: [
        "Upp till 15 tjänster",
        "8% kommission (istället för 15%)",
        "Skapa events",
        "Avancerad statistik",
        "Prioriterad synlighet",
      ],
    },
    premium: {
      price: 599,
      popular: false,
      features: [
        "Obegränsade tjänster",
        "3% kommission (istället för 15%)",
        "Toppsynlighet + utvalda",
        "Facebook-sync",
        "Dedikerad support",
      ],
    },
  },
  upplevelse: {
    gratis: {
      features: [
        "Upp till 3 events",
        "15% kommission",
        "Grundläggande statistik",
      ],
    },
    guld: {
      price: 299,
      popular: true,
      features: [
        "Upp till 15 events",
        "8% kommission (istället för 15%)",
        "Boka kreatörer",
        "Avancerad statistik",
      ],
    },
    premium: {
      price: 599,
      popular: false,
      features: [
        "Obegränsade events",
        "3% kommission (istället för 15%)",
        "Toppsynlighet + utvalda",
        "Facebook-sync",
        "Dedikerad support",
      ],
    },
  },
};

function Pricing() {
  const [activeRole, setActiveRole] = useState<"publik" | "kreator" | "upplevelse">("kreator");
  const data = PRICING_DATA[activeRole];

  const tiers = [
    { name: "Gratis", price: 0, desc: "Perfekt för att komma igång", features: data.gratis.features, cta: "Kom igång gratis", popular: false },
    { name: "Guld", price: data.guld.price, desc: "Väx din verksamhet", features: data.guld.features, cta: "Starta Guld", popular: data.guld.popular },
    { name: "Premium", price: data.premium.price, desc: "Full kontroll", features: data.premium.features, cta: "Starta Premium", popular: data.premium.popular },
  ];

  return (
    <section id="pricing" className="relative py-28 px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[600px] rounded-full bg-[var(--usha-accent)] opacity-[0.03] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Priser
          </h2>
          <p className="mx-auto max-w-lg text-[var(--usha-muted)]">
            Alla planer är <span className="font-semibold text-[var(--usha-gold)]">gratis under betaperioden</span> — på obestämd tid.
          </p>
        </div>

        {/* Role tabs */}
        <div className="mb-12 flex justify-center">
          <div className="inline-flex rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-1">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveRole(tab.key)}
                className={`rounded-lg px-6 py-2.5 text-sm font-medium transition ${
                  activeRole === tab.key
                    ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black"
                    : "text-[var(--usha-muted)] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 transition-all ${
                plan.popular
                  ? "border-[var(--usha-gold)]/40 bg-[var(--usha-card)] glow-gold scale-[1.02]"
                  : "border-[var(--usha-border)] bg-[var(--usha-card)] hover:border-[var(--usha-gold)]/20"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-1 text-xs font-bold text-black">
                  Populärast
                </div>
              )}

              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-[var(--usha-muted)]">
                {plan.desc}
              </p>

              <div className="my-6">
                {plan.price > 0 ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-[var(--usha-gold)]">0</span>
                    <span className="text-[var(--usha-muted)]">SEK/mån</span>
                    <span className="text-lg text-[var(--usha-muted)] line-through decoration-[var(--usha-muted)]/50">
                      {plan.price} SEK
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">0</span>
                    <span className="text-[var(--usha-muted)]">SEK — för alltid</span>
                  </div>
                )}
                {plan.price > 0 && (
                  <p className="mt-1 text-xs text-[var(--usha-gold)]">Gratis under beta</p>
                )}
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-[var(--usha-gold)]">&#10003;</span>
                    <span className="text-[var(--usha-muted)]">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href="/app"
                className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition ${
                  plan.popular
                    ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black hover:opacity-90"
                    : "border border-[var(--usha-border)] text-white hover:border-[var(--usha-gold)]/30"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── CTA ─────────────── */
function CTA() {
  return (
    <section className="relative py-28 px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--usha-gold)] opacity-[0.06] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-4 py-1.5 text-xs">
          <Sparkles size={12} className="text-[var(--usha-gold)]" />
          <span className="text-[var(--usha-muted)]">Helt gratis under beta</span>
        </div>

        <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
          Redo att testa?
        </h2>
        <p className="mb-10 text-lg text-[var(--usha-muted)]">
          Skapa konto på sekunder och utforska hela plattformen utan kostnad.
        </p>

        <a
          href="/app"
          className="glow-gold inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black transition hover:scale-[1.02] hover:opacity-90"
        >
          Kom igång gratis
          <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
}

/* ─────────────── FOOTER ─────────────── */
const FOOTER_LINKS = {
  Plattform: [
    { label: "Marketplace", href: "/marketplace" },
    { label: "Priser", href: "#pricing" },
  ],
  Juridiskt: [
    { label: "Användarvillkor", href: "/terms" },
    { label: "Integritetspolicy", href: "/privacy" },
    { label: "Cookiepolicy", href: "/cookies" },
  ],
};

function Footer() {
  return (
    <footer className="border-t border-[var(--usha-border)] pt-16 pb-8 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                <span className="text-sm font-bold text-black">U</span>
              </div>
              <span className="text-lg font-bold tracking-tight">Usha</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[var(--usha-muted)]">
              Kreatörer, upplevelser och kunder — förenade på en plattform.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="mb-4 text-sm font-semibold">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-[var(--usha-border)] pt-8 sm:flex-row">
          <p className="font-mono text-xs text-[var(--usha-muted)]">
            © 2026 Usha AB. Alla rättigheter förbehållna.
          </p>
          <p className="text-xs text-[var(--usha-muted)]">
            Byggd med kärlek i Sverige
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────── PAGE ─────────────── */
export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Ecosystem />
      <Pricing />
      <CTA />
      <Footer />
      <InstallPrompt />
    </main>
  );
}
