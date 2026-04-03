"use client";

import { useState, useEffect } from "react";
import { InstallPrompt } from "@/components/install-prompt";
import { createClient } from "@/lib/supabase/client";
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
  ShieldCheck,
  Ticket,
  Store,
  Heart,
  UserPlus,
  Fingerprint,
  Lock,
} from "lucide-react";

/* ─────────────── NAV ─────────────── */
function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  const navLinks = [
    { href: "#ecosystem", label: "Ekosystemet" },
    { href: "#pricing", label: "Priser" },
    { href: "/marketplace", label: "Marketplace" },
  ];

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  function handleInstallClick(e: React.MouseEvent) {
    if (isLoggedIn) {
      // Already logged in — go to app
      window.location.href = "/app";
      return;
    }
    if (isMobile) {
      // Mobile — go to app/signup
      window.location.href = "/app";
      return;
    }
    // Desktop + not logged in — show install instructions
    e.preventDefault();
    setShowInstallModal(true);
  }

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href={isLoggedIn ? "/app" : "#"} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
            <span className="text-sm font-bold text-black">U</span>
          </div>
          <span className="text-lg font-bold tracking-tight">Usha</span>
        </a>

        <div className="hidden items-center gap-8 text-sm text-[var(--usha-muted)] md:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-white">
              {l.label}
            </a>
          ))}
          <button
            onClick={handleInstallClick}
            className="transition hover:text-white"
          >
            {isLoggedIn ? "Öppna appen" : "Ladda ner appen"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={isLoggedIn ? "/app" : "/signup"}
            className="hidden rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 sm:block"
          >
            {isLoggedIn ? "Öppna appen" : "Kom igång"}
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
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-sm text-[var(--usha-muted)] transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <a
              href="/app"
              onClick={() => setMobileOpen(false)}
              className="py-2 text-sm text-[var(--usha-muted)] transition hover:text-white"
            >
              {isLoggedIn ? "Öppna appen" : "Ladda ner appen"}
            </a>
          </div>
        </div>
      )}
    </nav>

    {/* Install modal — desktop */}
    {showInstallModal && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInstallModal(false)} />
        <div className="relative w-full max-w-md rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-black)] p-8 shadow-2xl">
          <button
            onClick={() => setShowInstallModal(false)}
            className="absolute right-4 top-4 rounded p-1 text-[var(--usha-muted)] transition hover:text-white"
          >
            <X size={16} />
          </button>

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
            <span className="text-xl font-bold text-black">U</span>
          </div>

          <h3 className="mb-2 text-xl font-bold">Installera Usha på din dator</h3>
          <p className="mb-6 text-sm leading-relaxed text-[var(--usha-muted)]">
            Usha fungerar som en app direkt i din webbläsare. Installera den för snabb åtkomst:
          </p>

          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
              <p className="mb-1 text-sm font-semibold">Chrome / Edge</p>
              <p className="text-xs text-[var(--usha-muted)]">
                Klicka på installationsikonen <span className="inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">⊕</span> i adressfältet → &ldquo;Installera&rdquo;
              </p>
            </div>

            <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
              <p className="mb-1 text-sm font-semibold">Safari (Mac)</p>
              <p className="text-xs text-[var(--usha-muted)]">
                Arkiv → Lägg till i Dock
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setShowInstallModal(false)}
              className="flex-1 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium text-[var(--usha-muted)] transition hover:text-white"
            >
              Stäng
            </button>
            <a
              href="/app"
              className="flex-1 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-center text-sm font-bold text-black transition hover:opacity-90"
            >
              Öppna i webbläsaren
            </a>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* ─────────────── HERO ─────────────── */
function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-16 sm:px-6">
      {/* Background glows */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[600px] w-[900px] rounded-full bg-[var(--usha-gold)] opacity-[0.05] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <a
          href="/app"
          className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-5 py-2 text-xs transition hover:border-[var(--usha-gold)]/40 hover:bg-[var(--usha-card)]/80"
        >
          <Zap size={12} className="text-[var(--usha-accent)]" />
          <span className="text-[var(--usha-muted)]">Gratis under beta — ladda ner appen</span>
          <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 font-mono text-[10px] text-[var(--usha-gold)]">BETA</span>
        </a>

        {/* Headline */}
        <h1
          className="animate-fade-up delay-100 mb-6 text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ opacity: 0 }}
        >
          Kreativitet &{" "}
          <br className="hidden sm:block" />
          <span className="text-gradient">upplevelser, förenade</span>
        </h1>

        {/* Hero video */}
        <div
          className="animate-fade-up delay-150 mx-auto mb-8 max-w-3xl overflow-hidden rounded-xl border border-[var(--usha-border)] sm:mb-10 sm:rounded-2xl"
          style={{ opacity: 0 }}
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full max-h-[50vh] object-cover sm:max-h-none"
            suppressHydrationWarning
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
        </div>

        <p
          className="animate-fade-up delay-200 mx-auto mb-10 max-w-xl text-base leading-relaxed text-[var(--usha-muted)] sm:mb-12 sm:text-lg"
          style={{ opacity: 0 }}
        >
          Usha samlar kreatörer, upplevelser och kunder på en plattform.
          Profil, bokning och betalning — allt på ett ställe.
        </p>

        {/* CTA */}
        <div
          className="animate-fade-up delay-300 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"
          style={{ opacity: 0 }}
        >
          <a
            href="/signup"
            className="glow-gold inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3.5 text-sm font-bold text-black transition hover:scale-[1.02] hover:opacity-90 sm:w-auto sm:py-4 sm:text-base"
          >
            Kom igång gratis
            <ArrowRight size={16} />
          </a>
          <a
            href="/marketplace"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] px-8 py-3.5 text-sm font-medium text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/30 hover:text-white sm:w-auto sm:py-4 sm:text-base"
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
const ECOSYSTEM_PILLARS = [
  {
    icon: Palette,
    title: "Kreatörer",
    desc: "Dansinstruktörer, fotografer, musiker, designers — kreativa talanger som bygger sin verksamhet.",
    color: "from-[var(--usha-gold)] to-amber-600",
    details: [
      { icon: Palette, text: "Profil med portfolio, priser och kontaktinfo" },
      { icon: Ticket, text: "Publicera tjänster, kurser och events" },
      { icon: Globe, text: "Egen profiladress — usha.se/dittnamn" },
      { icon: BarChart3, text: "Statistik och intäktsrapporter" },
    ],
  },
  {
    icon: Store,
    title: "Upplevelser",
    desc: "Restauranger, konserthus, SPA, nattklubbar och retreat centers — platser som skapar oförglömliga stunder.",
    color: "from-[var(--usha-accent)] to-rose-500",
    details: [
      { icon: Ticket, text: "Skapa events och sälj biljetter med QR-kod" },
      { icon: Search, text: "Skanna biljetter och ha koll på deltagare" },
      { icon: Users, text: "Boka kreatörer direkt till dina events" },
      { icon: Globe, text: "Sprid events på sociala medier" },
    ],
  },
  {
    icon: Heart,
    title: "Kunder",
    desc: "Människor som vill upptäcka kreativa talanger och upplevelser — och boka dem direkt.",
    color: "from-sky-500 to-blue-500",
    details: [
      { icon: Search, text: "Sökbar marketplace med filter på kategori, plats och pris" },
      { icon: CalendarCheck, text: "Boka direkt med datum och tid" },
      { icon: CreditCard, text: "Säker betalning via Stripe" },
      { icon: Star, text: "Omdömen och betyg för att hitta rätt" },
    ],
  },
];

function Ecosystem() {
  const [openPillar, setOpenPillar] = useState<number | null>(null);

  return (
    <section id="ecosystem" className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[500px] w-[700px] rounded-full bg-[var(--usha-gold)] opacity-[0.03] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-10 text-center sm:mb-16">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:text-4xl">
            Tre ben, ett <span className="text-gradient">ekosystem</span>
          </h2>
          <p className="mx-auto max-w-xl text-[var(--usha-muted)]">
            Kreatörer skapar utbudet. Upplevelser erbjuder platserna. Kunder upptäcker och bokar. Alla förstärker varandra.
          </p>
        </div>

        <div className="space-y-4">
          {ECOSYSTEM_PILLARS.map((pillar, i) => {
            const isOpen = openPillar === i;
            return (
              <div key={pillar.title} className={`rounded-2xl border bg-[var(--usha-card)] transition-all ${isOpen ? "border-[var(--usha-gold)]/30" : "border-[var(--usha-border)] hover:border-[var(--usha-gold)]/20"}`}>
                <button
                  onClick={() => setOpenPillar(isOpen ? null : i)}
                  className="flex w-full items-center gap-4 p-6 text-left"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${pillar.color}`}>
                    <pillar.icon size={18} className="text-black" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{pillar.title}</h3>
                    <p className="mt-1 text-sm text-[var(--usha-muted)]">{pillar.desc}</p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[var(--usha-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--usha-border)] px-6 pb-6 pt-4">
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {pillar.details.map((detail) => (
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

        {/* Loop message */}
        <p className="mt-8 text-center text-sm text-[var(--usha-muted)]">
          Fler kreatörer lockar fler kunder. Fler kunder lockar fler upplevelser. Kretsloppet som driver tillväxt.
        </p>
      </div>
    </section>
  );
}

/* ─────────────── ONBOARDING ─────────────── */
const ONBOARDING_STEPS = [
  {
    icon: UserPlus,
    title: "Skapa konto",
    desc: "Registrera dig gratis på sekunder med Google, Facebook eller e-post.",
  },
  {
    icon: Palette,
    title: "Bygg din profil",
    desc: "Lägg till bio, portfolio, tjänster eller events. Bli synlig direkt på marketplace.",
  },
  {
    icon: CalendarCheck,
    title: "Börja ta emot bokningar",
    desc: "Kunder hittar dig, bokar och betalar. Du fokuserar på det du gör bäst.",
  },
];

function Onboarding() {
  return (
    <section className="relative py-16 px-4 sm:py-20 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center sm:mb-12">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl">
            Kom igång på <span className="text-gradient">3 steg</span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {ONBOARDING_STEPS.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                <step.icon size={20} className="text-black" />
              </div>
              <span className="mb-2 block font-mono text-xs text-[var(--usha-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-1 font-semibold">{step.title}</h3>
              <p className="text-sm text-[var(--usha-muted)]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── TRUST ─────────────── */
const TRUST_POINTS = [
  {
    icon: Fingerprint,
    title: "BankID-verifierade kreatörer",
    desc: "Alla kreatörer och upplevelser verifierar sin identitet med Mobilt BankID innan de skapar konto. Du vet alltid vem du bokar.",
  },
  {
    icon: Lock,
    title: "Säker betalning",
    desc: "Alla transaktioner hanteras av Stripe — din kortinfo delas aldrig med kreatörer eller upplevelser.",
  },
  {
    icon: ShieldCheck,
    title: "Skyddade bokningar",
    desc: "Varje bokning bekräftas digitalt med QR-kod. Inga falska biljetter, inga missförstånd.",
  },
];

function Trust() {
  return (
    <section className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[600px] rounded-full bg-[var(--usha-gold)] opacity-[0.03] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-10 text-center sm:mb-16">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-4 py-1.5 text-xs sm:mb-4">
            <Shield size={12} className="text-[var(--usha-gold)]" />
            <span className="text-[var(--usha-muted)]">Trygghet i varje steg</span>
          </div>
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:text-4xl">
            Boka med <span className="text-gradient">fullt förtroende</span>
          </h2>
          <p className="mx-auto max-w-xl text-[var(--usha-muted)]">
            Vi tar säkerhet på allvar. Alla som erbjuder tjänster och upplevelser på Usha är identitetsverifierade med svenskt BankID.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TRUST_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition hover:border-[var(--usha-gold)]/20"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                <point.icon size={20} className="text-[var(--usha-gold)]" />
              </div>
              <h3 className="mb-2 font-semibold">{point.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--usha-muted)]">{point.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── PRICING ─────────────── */
const ROLE_TABS = [
  { key: "publik" as const, label: "Användare" },
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
    <section id="pricing" className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[600px] rounded-full bg-[var(--usha-accent)] opacity-[0.03] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:text-4xl">
            Priser
          </h2>
          <p className="mx-auto max-w-xl text-sm text-[var(--usha-muted)] sm:text-base">
            En komplett lösning — skapa events, sprid dem på sociala medier, sälj och skanna biljetter, och ha koll på alla deltagare. Allt i en app.
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--usha-muted)]">
            Alla planer är <span className="font-semibold text-[var(--usha-gold)]">gratis under betaperioden</span> — på obestämd tid.
          </p>
        </div>

        {/* Role tabs */}
        <div className="mb-8 flex justify-center sm:mb-12">
          <div className="inline-flex rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-1">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveRole(tab.key)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition sm:px-6 sm:py-2.5 sm:text-sm ${
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
              className={`relative rounded-2xl border p-5 transition-all sm:p-8 ${
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
                href="/signup"
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
    <section className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--usha-gold)] opacity-[0.06] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-4 py-1.5 text-xs">
          <Sparkles size={12} className="text-[var(--usha-gold)]" />
          <span className="text-[var(--usha-muted)]">Helt gratis under beta</span>
        </div>

        <h2 className="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl md:text-4xl">
          Redo att testa?
        </h2>
        <p className="mb-8 text-base text-[var(--usha-muted)] sm:mb-10 sm:text-lg">
          Skapa konto på sekunder och utforska hela plattformen utan kostnad.
        </p>

        <a
          href="/signup"
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
    <footer className="border-t border-[var(--usha-border)] pt-12 pb-8 px-4 sm:pt-16 sm:px-6">
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
      <Onboarding />
      <Trust />
      <Pricing />
      <CTA />
      <Footer />
      <InstallPrompt />
    </main>
  );
}
