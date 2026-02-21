"use client";

import { useState } from "react";
import { InstallPrompt } from "@/components/install-prompt";
import {
  Menu,
  X,
  ArrowRight,
  Instagram,
  Twitter,
  Youtube,
  Mail,
  UserPlus,
  ListPlus,
  Search,
  CalendarCheck,
  CreditCard,
  Star,
  TrendingUp,
  Repeat,
  Palette,
  BarChart3,
  Sparkles,
  Shield,
  Music,
  Camera,
  Dumbbell,
  Figma,
  Video,
  Heart,
  ChevronRight,
  Zap,
  Globe,
  Users,
  UtensilsCrossed,
  Ticket,
  PartyPopper,
  Waves,
  TreePine,
  Building2,
  Store,
} from "lucide-react";

/* ─────────────── NAV ─────────────── */
function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "#ecosystem", label: "Ekosystemet" },
    { href: "#creators", label: "För kreatörer" },
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
            className="ml-1 rounded-lg p-2 text-[var(--usha-muted)] transition hover:text-white md:hidden"
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
            <a
              href="/app"
              onClick={() => setMobileOpen(false)}
              className="py-2 text-sm font-semibold text-[var(--usha-gold)] transition hover:text-white sm:hidden"
            >
              Öppna appen
            </a>
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
      <div className="pointer-events-none absolute bottom-1/4 right-1/4">
        <div className="h-[400px] w-[500px] rounded-full bg-[var(--usha-accent)] opacity-[0.04] blur-[150px]" />
      </div>
      <div className="pointer-events-none absolute top-1/2 left-1/4">
        <div className="h-[300px] w-[300px] rounded-full bg-[var(--usha-gold)] opacity-[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        {/* Badge */}
        <div className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-5 py-2 text-xs">
          <Zap size={12} className="text-[var(--usha-accent)]" />
          <span className="text-[var(--usha-muted)]">Framtidens kreativa plattform</span>
          <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 font-mono text-[10px] text-[var(--usha-gold)]">BETA</span>
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-up delay-100 mb-6 text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl"
          style={{ opacity: 0 }}
        >
          Hela kretsloppet för{" "}
          <br className="hidden sm:block" />
          <span className="text-gradient">kreativitet & upplevelser</span>
        </h1>

        <p
          className="animate-fade-up delay-200 mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-[var(--usha-muted)] sm:text-xl"
          style={{ opacity: 0 }}
        >
          Usha förenar kreatörer, upplevelser och kunder i ett ekosystem.
          Dansinstruktörer, fotografer, restauranger, konserthus och SPA
          — alla bygger sin närvaro, alla hittas av rätt kund. Profil.
          Marketplace. Bokning. Betalning. Allt på ett ställe.
        </p>

        {/* CTAs */}
        <div
          className="animate-fade-up delay-300 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          style={{ opacity: 0 }}
        >
          <a
            href="/app"
            className="glow-gold inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black transition hover:scale-[1.02] hover:opacity-90"
          >
            Utforska plattformen
            <ArrowRight size={16} />
          </a>
          <a
            href="#ecosystem"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-8 py-4 text-base font-medium text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/30 hover:text-white"
          >
            Se hur det fungerar
          </a>
        </div>

        {/* Stats bar */}
        <div
          className="animate-fade-up delay-400 mt-20 inline-flex flex-wrap items-center justify-center gap-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-10 py-6 sm:gap-12"
          style={{ opacity: 0 }}
        >
          {[
            { value: "500+", label: "Kreatörer", icon: Palette },
            { value: "200+", label: "Upplevelser", icon: Sparkles },
            { value: "10k+", label: "Bokningar", icon: CalendarCheck },
            { value: "4.9", label: "Snittbetyg", icon: Star },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <stat.icon size={18} className="text-[var(--usha-gold)]" />
              <div className="text-left">
                <div className="text-lg font-bold sm:text-xl">{stat.value}</div>
                <div className="text-xs text-[var(--usha-muted)]">{stat.label}</div>
              </div>
            </div>
          ))}
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

/* ─────────────── THE ECOSYSTEM ─────────────── */
const CYCLE_STEPS = [
  {
    icon: UserPlus,
    title: "Bygg din profil",
    desc: "Skapa ett professionellt skyltfönster med bio, portfolio, priser och tillgänglighet.",
    color: "from-[var(--usha-gold)] to-amber-600",
  },
  {
    icon: ListPlus,
    title: "Publicera tjänster",
    desc: "Lägg till dina tjänster med beskrivning, pris och tidsåtgång. Bli synlig direkt.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Search,
    title: "Bli upptäckt",
    desc: "Kunder söker och filtrerar på marketplace. Din profil matchar rätt kund.",
    color: "from-orange-500 to-[var(--usha-accent)]",
  },
  {
    icon: CalendarCheck,
    title: "Ta emot bokningar",
    desc: "Kunder bokar direkt med datum och tid. Du bekräftar eller föreslår nytt.",
    color: "from-[var(--usha-accent)] to-rose-500",
  },
  {
    icon: CreditCard,
    title: "Få betalt säkert",
    desc: "Stripe hanterar betalningen. Automatisk fakturering och direkt utbetalning.",
    color: "from-rose-500 to-purple-500",
  },
  {
    icon: Star,
    title: "Bygg rykte",
    desc: "Varje lyckad bokning stärker din profil. Bättre rykte ger fler kunder.",
    color: "from-purple-500 to-[var(--usha-gold)]",
  },
];

function Ecosystem() {
  return (
    <section id="ecosystem" className="relative py-28 px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[500px] w-[700px] rounded-full bg-[var(--usha-gold)] opacity-[0.03] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-4 py-1.5 text-xs">
            <Repeat size={12} className="text-[var(--usha-gold)]" />
            <span className="text-[var(--usha-muted)]">Kretsloppet</span>
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Ett ekosystem som{" "}
            <span className="text-gradient">driver tillväxt</span>
          </h2>
          <p className="mx-auto max-w-2xl text-[var(--usha-muted)]">
            Usha är inte bara en plattform — det är ett kretslopp där kreatörer,
            upplevelser och kunder förstärker varandra. Från profil till bokning,
            allt hänger ihop.
          </p>
        </div>

        {/* Cycle visualization */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CYCLE_STEPS.map((step, i) => (
            <div key={step.title} className="group relative">
              <div className="h-full rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-all hover:border-[var(--usha-gold)]/20 hover:bg-[var(--usha-card-hover)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${step.color}`}>
                    <step.icon size={18} className="text-black" />
                  </div>
                  <span className="font-mono text-xs text-[var(--usha-muted)]">
                    Steg {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mb-2 font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--usha-muted)]">
                  {step.desc}
                </p>
              </div>
              {/* Arrow to next */}
              {i < CYCLE_STEPS.length - 1 && i !== 2 && (
                <div className="pointer-events-none absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-[var(--usha-border)] lg:block">
                  <ChevronRight size={16} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Loop indicator */}
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-[var(--usha-muted)]">
          <Repeat size={14} className="text-[var(--usha-gold)]" />
          <span>Cykeln upprepas — varje bokning stärker hela ekosystemet</span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── THREE PILLARS ─────────────── */
function ThreePillars() {
  const pillars = [
    {
      badge: "Kreatörer",
      badgeIcon: Palette,
      color: "gold" as const,
      title: "Ditt kreativa företag, superladdat",
      desc: "Sluta jaga kunder via sociala medier. Usha ger dig verktygen att bygga en professionell närvaro och ta emot bokningar automatiskt.",
      items: [
        { icon: Palette, text: "Professionell profil med allt en kund behöver veta" },
        { icon: Globe, text: "Synlighet på marketplace — bli hittad av rätt kunder" },
        { icon: CalendarCheck, text: "Bokningar direkt — inga mejlkedjor eller DM-förhandlingar" },
        { icon: CreditCard, text: "Automatiska betalningar och fakturering via Stripe" },
        { icon: TrendingUp, text: "Bättre rykte → fler kunder → mer intäkter" },
      ],
      cta: { label: "Bli kreatör", href: "/app", filled: true },
    },
    {
      badge: "Upplevelser",
      badgeIcon: Store,
      color: "accent" as const,
      title: "Fyll dina evenemang och bord",
      desc: "Restauranger, konserthus, nattklubbar, SPA och retreat centers — visa upp era upplevelser och låt kunder boka direkt.",
      items: [
        { icon: UtensilsCrossed, text: "Restauranger och matupplevelser med bordsbokningar" },
        { icon: Ticket, text: "Konserthus och event med biljetthantering" },
        { icon: PartyPopper, text: "Nattklubbar och nöjen med gästlistor" },
        { icon: Waves, text: "SPA och wellness med tidsbokning" },
        { icon: TreePine, text: "Retreat centers och resor med paketbokningar" },
      ],
      cta: { label: "Registrera verksamhet", href: "/app", filled: true },
    },
    {
      badge: "Kunder",
      badgeIcon: Search,
      color: "muted" as const,
      title: "Hitta, boka, upplev",
      desc: "Glöm Google-sökningar och osäkra DM:s. Bläddra bland verifierade kreatörer och upplevelser, jämför och boka direkt.",
      items: [
        { icon: Search, text: "Sök och filtrera på kategori, plats, pris och betyg" },
        { icon: Users, text: "Verifierade profiler med portfolios och omdömen" },
        { icon: CalendarCheck, text: "Boka direkt med datum och tid som passar dig" },
        { icon: Shield, text: "Säkra betalningar och trygga transaktioner" },
        { icon: Star, text: "Läs omdömen från andra kunder innan du bokar" },
      ],
      cta: { label: "Utforska marketplace", href: "/marketplace", filled: true },
    },
  ];

  const colorMap = {
    gold: {
      border: "border-[var(--usha-gold)]/20",
      badge: "bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]",
      icon: "bg-[var(--usha-gold)]/10",
      iconText: "text-[var(--usha-gold)]",
      ctaFilled: "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black hover:opacity-90",
      ctaOutline: "border border-[var(--usha-gold)]/30 text-[var(--usha-gold)] hover:bg-[var(--usha-gold)]/10",
    },
    accent: {
      border: "border-[var(--usha-accent)]/20",
      badge: "bg-[var(--usha-accent)]/10 text-[var(--usha-accent)]",
      icon: "bg-[var(--usha-accent)]/10",
      iconText: "text-[var(--usha-accent)]",
      ctaFilled: "bg-gradient-to-r from-[var(--usha-accent)] to-rose-500 text-white hover:opacity-90",
      ctaOutline: "border border-[var(--usha-accent)]/30 text-[var(--usha-accent)] hover:bg-[var(--usha-accent)]/10",
    },
    muted: {
      border: "border-sky-500/40",
      badge: "bg-sky-500/10 text-sky-400",
      icon: "bg-sky-500/10",
      iconText: "text-sky-400",
      ctaFilled: "bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:opacity-90",
      ctaOutline: "border border-sky-500/30 text-sky-400 hover:bg-sky-500/10",
    },
  };

  return (
    <section className="relative py-28 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Tre ben, <span className="text-gradient">ett kretslopp</span>
          </h2>
          <p className="mx-auto max-w-2xl text-[var(--usha-muted)]">
            Usha förenar kreativa talanger, upplevelseföretag och kunder i ett
            ekosystem där alla lyfter varandra.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {pillars.map((p) => {
            const c = colorMap[p.color];
            return (
              <div
                key={p.badge}
                className={`rounded-2xl border ${c.border} bg-[var(--usha-card)] p-7`}
              >
                <div
                  className={`mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ${c.badge}`}
                >
                  <p.badgeIcon size={12} />
                  {p.badge}
                </div>
                <h3 className="mb-3 text-xl font-bold">{p.title}</h3>
                <p className="mb-6 text-sm leading-relaxed text-[var(--usha-muted)]">
                  {p.desc}
                </p>
                <ul className="space-y-3">
                  {p.items.map((item) => (
                    <li key={item.text} className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${c.icon}`}
                      >
                        <item.icon size={13} className={c.iconText} />
                      </div>
                      <span className="text-sm text-[var(--usha-muted)]">
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
                <a
                  href={p.cta.href}
                  className={`mt-7 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition ${
                    p.cta.filled ? c.ctaFilled : c.ctaOutline
                  }`}
                >
                  {p.cta.label}
                  <ArrowRight size={14} />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── CATEGORIES ─────────────── */
const CREATOR_CATEGORIES = [
  { icon: Music, label: "Musiker", slug: "music", count: "120+", group: "Kreatörer" },
  { icon: Heart, label: "Dans", slug: "dance", count: "85+", group: "Kreatörer" },
  { icon: Camera, label: "Fotografer", slug: "photo", count: "95+", group: "Kreatörer" },
  { icon: Figma, label: "Designers", slug: "design", count: "75+", group: "Kreatörer" },
  { icon: Dumbbell, label: "Fitness & Yoga", slug: "fitness", count: "65+", group: "Kreatörer" },
  { icon: Video, label: "Videografer", slug: "video", count: "60+", group: "Kreatörer" },
];

const EXPERIENCE_CATEGORIES = [
  { icon: UtensilsCrossed, label: "Restauranger", slug: "restaurant", count: "80+" },
  { icon: Ticket, label: "Konserthus", slug: "concert", count: "35+" },
  { icon: PartyPopper, label: "Nattklubbar", slug: "nightclub", count: "45+" },
  { icon: Waves, label: "SPA & Wellness", slug: "spa", count: "50+" },
  { icon: TreePine, label: "Retreats", slug: "retreat", count: "25+" },
  { icon: Building2, label: "Eventlokaler", slug: "venue", count: "40+" },
];

function Categories() {
  return (
    <section id="creators" className="relative py-28 px-6">
      <div className="pointer-events-none absolute bottom-0 right-1/4">
        <div className="h-[300px] w-[500px] rounded-full bg-[var(--usha-accent)] opacity-[0.03] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="mb-3 font-mono text-sm uppercase tracking-widest text-[var(--usha-gold)]">
            Kategorier
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Talanger & upplevelser under{" "}
            <span className="text-gradient">ett tak</span>
          </h2>
          <p className="mx-auto max-w-2xl text-[var(--usha-muted)]">
            Från dansare till designers, från restauranger till retreats — Usha
            samlar hela den kreativa och upplevelsedrivna ekonomin.
          </p>
        </div>

        {/* Creators */}
        <div className="mb-4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--usha-gold)]">
            <Palette size={14} />
            Kreativa talanger
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CREATOR_CATEGORIES.map((cat) => (
              <a
                key={cat.slug}
                href={`/marketplace?category=${cat.slug}`}
                className="group flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 transition-all hover:border-[var(--usha-gold)]/30 hover:bg-[var(--usha-card-hover)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/10 to-[var(--usha-accent)]/10 transition-colors group-hover:from-[var(--usha-gold)]/20 group-hover:to-[var(--usha-accent)]/20">
                  <cat.icon
                    size={22}
                    className="text-[var(--usha-gold)] transition-colors group-hover:text-[var(--usha-gold-light)]"
                  />
                </div>
                <span className="text-sm font-medium">{cat.label}</span>
                <span className="font-mono text-xs text-[var(--usha-muted)]">
                  {cat.count}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Experiences */}
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--usha-accent)]">
            <Store size={14} />
            Upplevelser & verksamheter
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {EXPERIENCE_CATEGORIES.map((cat) => (
              <a
                key={cat.slug}
                href={`/marketplace?category=${cat.slug}`}
                className="group flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 transition-all hover:border-[var(--usha-accent)]/30 hover:bg-[var(--usha-card-hover)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-accent)]/10 to-rose-500/10 transition-colors group-hover:from-[var(--usha-accent)]/20 group-hover:to-rose-500/20">
                  <cat.icon
                    size={22}
                    className="text-[var(--usha-accent)] transition-colors group-hover:text-[var(--usha-accent-soft)]"
                  />
                </div>
                <span className="text-sm font-medium">{cat.label}</span>
                <span className="font-mono text-xs text-[var(--usha-muted)]">
                  {cat.count}
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/marketplace"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--usha-gold)] transition hover:text-[var(--usha-gold-light)]"
          >
            Visa alla på marketplace
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── PLATFORM PILLARS ─────────────── */
const PILLARS = [
  {
    icon: Palette,
    title: "Profil",
    desc: "Din digitala skyltfönster. Bio, portfolio, priser och kontaktinfo — allt en kund behöver.",
  },
  {
    icon: Globe,
    title: "Marketplace",
    desc: "Sökbar katalog med alla kreatörer. Filtrera, jämför och hitta rätt match på sekunder.",
  },
  {
    icon: CalendarCheck,
    title: "Bokningar",
    desc: "Integrerat bokningssystem med kalender. Kunder bokar direkt, du bekräftar med ett klick.",
  },
  {
    icon: CreditCard,
    title: "Betalningar",
    desc: "Stripe-driven betalning och fakturering. Säkert för båda parter med automatiska utbetalningar.",
  },
  {
    icon: BarChart3,
    title: "Insikter",
    desc: "Spåra visningar, bokningar och intäkter. Data-driven tillväxt för ditt kreativa företag.",
  },
  {
    icon: Shield,
    title: "Trygghet",
    desc: "Verifierade profiler, säkra betalningar och support. En plattform du kan lita på.",
  },
];

function Pillars() {
  return (
    <section className="relative py-28 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="mb-3 font-mono text-sm uppercase tracking-widest text-[var(--usha-gold)]">
            Plattformen
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Sex pelare som bär{" "}
            <span className="text-gradient">hela ekosystemet</span>
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="group rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-all hover:border-[var(--usha-gold)]/20 hover:bg-[var(--usha-card-hover)]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)]/10 to-[var(--usha-accent)]/10 transition-colors group-hover:from-[var(--usha-gold)]/20 group-hover:to-[var(--usha-accent)]/20">
                <p.icon size={20} className="text-[var(--usha-gold)]" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{p.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--usha-muted)]">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── TESTIMONIALS ─────────────── */
const TESTIMONIALS = [
  {
    name: "Sara Lindström",
    role: "Dansinstruktör",
    avatar: "S",
    quote:
      "Usha har förändrat hur jag driver min dansverksamhet. Jag får bokningar varje vecka utan att behöva jaga kunder.",
  },
  {
    name: "Erik Johansson",
    role: "Fotograf",
    avatar: "E",
    quote:
      "Äntligen en plattform som förstår kreativa yrken. Enkel att använda och mina kunder älskar bokningsflödet.",
  },
  {
    name: "Maria Nguyen",
    role: "Yogainstruktör",
    avatar: "M",
    quote:
      "Från noll till 30 bokningar i månaden. Usha gav mig synligheten jag behövde för att växa.",
  },
];

function Testimonials() {
  return (
    <section className="relative py-28 px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/4 -translate-y-1/2">
        <div className="h-[300px] w-[400px] rounded-full bg-[var(--usha-gold)] opacity-[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="mb-3 font-mono text-sm uppercase tracking-widest text-[var(--usha-gold)]">
            Community
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Kreatörer som redan{" "}
            <span className="text-gradient">är med på resan</span>
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/20"
            >
              <div className="mb-4 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className="fill-[var(--usha-gold)] text-[var(--usha-gold)]"
                  />
                ))}
              </div>
              <p className="mb-6 text-sm leading-relaxed text-[var(--usha-muted)]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                  <span className="text-sm font-bold text-[var(--usha-gold)]">
                    {t.avatar}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-[var(--usha-muted)]">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── PRICING ─────────────── */
const PLANS = [
  {
    name: "Basic",
    price: 99,
    desc: "Perfekt för att komma igång",
    features: [
      "Skapa din profil",
      "Visa upp dina tjänster",
      "Upp till 5 aktiva listor",
      "Grundläggande statistik",
      "Email-support",
    ],
    cta: "Starta Basic",
    popular: false,
  },
  {
    name: "Premium",
    price: 199,
    desc: "För den seriösa kreatören",
    features: [
      "Allt i Basic",
      "Obegränsade listor",
      "Prioriterad visning",
      "Avancerad statistik",
      "Direkt bokningssystem",
      "Prioriterad support",
    ],
    cta: "Starta Premium",
    popular: true,
  },
  {
    name: "Enterprise",
    price: 499,
    desc: "Full kontroll och support",
    features: [
      "Allt i Premium",
      "Anpassad profil-design",
      "API-tillgång",
      "Dedikerad account manager",
      "Custom integrationer",
      "SLA-garanti",
    ],
    cta: "Kontakta oss",
    popular: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="relative py-28 px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[600px] rounded-full bg-[var(--usha-accent)] opacity-[0.03] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="mb-3 font-mono text-sm uppercase tracking-widest text-[var(--usha-gold)]">
            Priser
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Investera i din <span className="text-gradient">tillväxt</span>
          </h2>
          <p className="mx-auto max-w-xl text-[var(--usha-muted)]">
            Alla planer inkluderar 14 dagars gratis provperiod. Uppgradera,
            nedgradera eller avsluta när du vill.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
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

              <div className="my-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">{plan.price}</span>
                <span className="text-[var(--usha-muted)]">SEK/mån</span>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-[var(--usha-gold)]">✓</span>
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

/* ─────────────── FAQ ─────────────── */
const FAQS = [
  {
    q: "Vad är Usha Platform?",
    a: "Usha är ett komplett ekosystem för kreativitet och upplevelser. Kreatörer och upplevelseföretag bygger sin profil, publicerar tjänster och tar emot bokningar — allt på ett ställe. Kunder hittar, jämför och bokar talanger och upplevelser direkt.",
  },
  {
    q: "Kostar det något att registrera sig?",
    a: "Alla planer har 14 dagars gratis provperiod. Basic börjar på 99 SEK/mån. Du betalar inget förrän provperioden är över.",
  },
  {
    q: "Hur fungerar betalningar?",
    a: "Vi använder Stripe för säkra betalningar. Kunder betalar via plattformen, och du får dina pengar direkt till ditt konto med automatisk fakturering.",
  },
  {
    q: "Kan jag byta plan senare?",
    a: "Absolut! Du kan uppgradera eller nedgradera din plan när som helst. Ändringen träder i kraft vid nästa faktureringsperiod.",
  },
  {
    q: "Vilka kan använda plattformen?",
    a: "Både individuella kreatörer och företag! Dansinstruktörer, musiker, fotografer, designers — men också restauranger, konserthus, nattklubbar, SPA och retreat centers. Om du erbjuder kreativa tjänster eller upplevelser passar Usha för dig.",
  },
  {
    q: "Hur skiljer sig Usha från andra plattformar?",
    a: "Usha är byggt specifikt för kreativitet och upplevelser i Sverige. Vi samlar tre ben — kreatörer, upplevelseföretag och kunder — i ett kretslopp med profil, marketplace, bokning och betalning, istället för att du ska behöva lappa ihop olika verktyg.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-28 px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 text-center">
          <p className="mb-3 font-mono text-sm uppercase tracking-widest text-[var(--usha-gold)]">
            FAQ
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Vanliga frågor
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] transition-colors hover:border-[var(--usha-gold)]/20"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between p-5 text-left"
              >
                <span className="font-medium">{faq.q}</span>
                <span
                  className="ml-4 shrink-0 text-lg text-[var(--usha-muted)] transition-transform duration-200"
                  style={{
                    transform: open === i ? "rotate(45deg)" : "rotate(0)",
                  }}
                >
                  +
                </span>
              </button>
              {open === i && (
                <div className="border-t border-[var(--usha-border)] px-5 py-4 text-sm leading-relaxed text-[var(--usha-muted)]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── VISION CTA ─────────────── */
function VisionCTA() {
  return (
    <section className="relative py-28 px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--usha-gold)] opacity-[0.06] blur-[150px]" />
        <div className="absolute top-1/3 right-1/3 h-[200px] w-[300px] rounded-full bg-[var(--usha-accent)] opacity-[0.04] blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-4 py-1.5 text-xs">
          <Sparkles size={12} className="text-[var(--usha-gold)]" />
          <span className="text-[var(--usha-muted)]">Vår vision</span>
        </div>

        <h2 className="mb-6 text-3xl font-bold sm:text-4xl lg:text-5xl">
          Vi bygger infrastrukturen för{" "}
          <span className="text-gradient">Sveriges kreativa ekonomi</span>
        </h2>
        <p className="mb-10 text-lg leading-relaxed text-[var(--usha-muted)]">
          Usha handlar om mer än bokningar. Det handlar om att ge kreatörer
          och upplevelseföretag verktygen att växa — och ge varje kund
          tillgång till fantastisk kreativ kompetens och oförglömliga
          upplevelser.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="/app"
            className="glow-gold inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black transition hover:scale-[1.02] hover:opacity-90"
          >
            Testa Usha nu
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
    </section>
  );
}

/* ─────────────── FOOTER ─────────────── */
const FOOTER_LINKS = {
  Plattform: [
    { label: "Marketplace", href: "/marketplace" },
    { label: "Funktioner", href: "#ecosystem" },
    { label: "Priser", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  Företag: [
    { label: "Om oss", href: "#" },
    { label: "Blogg", href: "#" },
    { label: "Karriär", href: "#" },
    { label: "Kontakt", href: "#" },
  ],
  Juridiskt: [
    { label: "Användarvillkor", href: "#" },
    { label: "Integritetspolicy", href: "#" },
    { label: "Cookies", href: "#" },
  ],
};

function Footer() {
  return (
    <footer className="border-t border-[var(--usha-border)] pt-16 pb-8 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                <span className="text-sm font-bold text-black">U</span>
              </div>
              <span className="text-lg font-bold tracking-tight">Usha</span>
            </div>
            <p className="mb-6 max-w-xs text-sm leading-relaxed text-[var(--usha-muted)]">
              Hela kretsloppet för kreativitet och upplevelser. Kreatörer,
              företag och kunder — förenade på en plattform.
            </p>
            <div className="flex items-center gap-3">
              {[
                { icon: Instagram, label: "Instagram" },
                { icon: Twitter, label: "Twitter" },
                { icon: Youtube, label: "YouTube" },
                { icon: Mail, label: "Email" },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--usha-border)] text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-white"
                  aria-label={s.label}
                >
                  <s.icon size={16} />
                </a>
              ))}
            </div>
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

        {/* Bottom bar */}
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
      <ThreePillars />
      <Categories />
      <Pillars />
      <Testimonials />
      <Pricing />
      <FAQ />
      <VisionCTA />
      <Footer />
      <InstallPrompt />
    </main>
  );
}
