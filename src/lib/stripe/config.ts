import type { MemberRole } from "@/types/database";

export type PlanKey =
  | "publik_guld"
  | "publik_premium"
  | "kreator_guld"
  | "kreator_premium"
  | "upplevelse_guld"
  | "upplevelse_premium";

interface Plan {
  name: string;
  role: MemberRole;
  tier: "guld" | "premium";
  price: number;
  currency: string;
  interval: "month";
  description: string;
  popular?: boolean;
  features: string[];
  stripePriceId: string;
  /**
   * Avvecklad nivå. Visas inte i prislistan och går inte att teckna, men
   * ligger kvar så att befintliga prenumerationer och webhooken fortfarande
   * känner igen sitt plan-id. Att radera nyckeln hade gjort gamla rader
   * oläsbara.
   */
  retired?: boolean;
}

export const PLANS: Record<PlanKey, Plan> = {
  // AVVECKLAD 2026-09-29. Samma skäl som venue-nivåerna, men tydligare.
  //
  // 22 personer har någonsin köpt en biljett. Snittet är 1,1 köp per person,
  // ingen har köpt tre gånger, och den bästa kunden har spenderat 500 kr under
  // plattformens hela livstid. Publik Guld kostade 199 kr I MÅNADEN — mer per
  // månad än den bästa kunden spenderat totalt.
  //
  // En prenumeration ber någon satsa på ett återkommande beteende de inte
  // etablerat. Klippkortet gör tvärtom: det köps i entusiasmen efter en bra
  // kväll, utan bindning, och förvandlar 1,1 köp till N.
  //
  // Av sex utlovade förmåner fungerade en (rabatten, avstängd under betan),
  // en var byggd men använd på 1 av 48 kvällar (förturen), och fyra fanns inte
  // alls: VIP utan kö, exklusivt innehåll, prioriterad support och
  // nivåkopplad kalendersync. Att sälja dem hade varit ett löfte vi inte kan
  // hålla.
  //
  // Kan komma tillbaka den dag någon köper tio gånger om året. Då som årskort,
  // inte månadsprenumeration.
  publik_guld: {
    retired: true,
    name: "Guld",
    role: "customer",
    tier: "guld",
    price: 0,
    currency: "SEK",
    interval: "month",
    description: "Rabatter och tidig tillgång",
    features: [
      "10% rabatt på bokningar",
      "Tidig tillgång 48h före alla andra",
    ],
    stripePriceId: process.env.STRIPE_PUBLIK_GULD_PRICE_ID || "",
  },
  publik_premium: {
    retired: true,
    name: "Premium",
    role: "customer",
    tier: "premium",
    price: 0,
    currency: "SEK",
    interval: "month",
    popular: true,
    description: "VIP-upplevelse utan köer",
    features: [
      "20% rabatt på bokningar",
      "Tidig tillgång 72h före alla andra",
    ],
    stripePriceId: process.env.STRIPE_PUBLIK_PREMIUM_PRICE_ID || "",
  },
  kreator_guld: {
    name: "Guld",
    role: "creator",
    tier: "guld",
    price: 299,
    currency: "SEK",
    interval: "month",
    description: "Väx din verksamhet",
    popular: true,
    features: [
      "Upp till 15 tjänster",
      "5% kommission (istället för 8%)",
      "Egen profiladress (usha.se/dittnamn)",
      "Sälj digitalt material",
      "Skapa events",
      "Avancerad statistik",
      "Prioriterad synlighet",
    ],
    stripePriceId: process.env.STRIPE_KREATOR_GULD_PRICE_ID || "",
  },
  kreator_premium: {
    name: "Premium",
    role: "creator",
    tier: "premium",
    price: 599,
    currency: "SEK",
    interval: "month",
    description: "Full kontroll och maximal synlighet",
    features: [
      "Obegränsade tjänster",
      "3% kommission (istället för 8%)",
      "White label — egen logga & branding",
      "Egen profiladress (usha.se/dittnamn)",
      "Toppsynlighet + utvalda",
      "Facebook-sync",
      "Kalender läs + skriv",
      "Dedikerad support",
      "Statistikexport",
    ],
    stripePriceId: process.env.STRIPE_KREATOR_PREMIUM_PRICE_ID || "",
  },
  // AVVECKLAD 2026-09-29. En lokal är en avtalspart, inte en abonnent.
  //
  // Den enda riktiga lokalen på plattformen — Bacchi Syre, 31 kvällar — låg på
  // gratisnivån hela tiden och tar 50 % av kvällen via intäktsdelning. Nivån
  // har aldrig dragit in en krona, och att ta 299 i månaden av en lokal för att
  // få lägga in sina kvällar är att ta betalt för leverans.
  //
  // Villkoren för en lokal bor i event_revenue_shares, inte i en prisstege.
  // Se docs/lokalmodeller.md.
  upplevelse_guld: {
    retired: true,
    name: "Guld",
    role: "venue",
    tier: "guld",
    price: 0,
    currency: "SEK",
    interval: "month",
    description: "Väx din verksamhet",
    features: [
      "Upp till 15 events",
      "5% kommission (istället för 8%)",
      "Egen profiladress (usha.se/dittnamn)",
      "Boka kreatörer",
      "Sälj digitalt material",
      "Skapa events",
      "Avancerad statistik",
    ],
    stripePriceId: process.env.STRIPE_UPPLEVELSE_GULD_PRICE_ID || "",
  },
  upplevelse_premium: {
    retired: true,
    name: "Premium",
    role: "venue",
    tier: "premium",
    price: 0,
    currency: "SEK",
    interval: "month",
    description: "Full kontroll och maximal synlighet",
    features: [
      "Obegränsade events",
      "3% kommission (istället för 8%)",
      "White label — egen logga & branding",
      "Egen profiladress (usha.se/dittnamn)",
      "Toppsynlighet + utvalda",
      "Facebook-sync",
      "Boka kreatörer + analys",
      "Dedikerad support",
    ],
    stripePriceId: process.env.STRIPE_UPPLEVELSE_PREMIUM_PRICE_ID || "",
  },
} as const;

export { type PlanKey as StripePlanKey };

/** Free tier definition (not a Stripe plan).
 * The default features are creator/experience-oriented (mention commission etc.).
 * For role-specific feature lists, use getGratisPlan(role) instead.
 */
export const GRATIS_PLAN = {
  name: "Gratis",
  tier: "gratis" as const,
  price: 0,
  currency: "SEK",
  description: "Perfekt för att komma igång",
  features: [
    "Skapa profil + tjänster/events (upp till 3)",
    "Synlig på marknadsplatsen",
    "8% kommission på bokningar",
    "Grundläggande statistik",
  ],
};

/** Grundarpartnerns variant av gratisplanen.
 *
 * Statusen ges till tidiga kreatörer i regioner där vi inte finns ännu. De
 * betalar självkostnad — bara Stripes avgift — och har inget tak på antal
 * utbud. Texten måste säga samma sak som verkligheten: lovar prissidan tre
 * event medan kontot tillåter nio, är det texten som är buggen.
 */
export const GRUNDARPARTNER_PLAN = {
  ...GRATIS_PLAN,
  name: "Grundarpartner",
  description: "För dig som är först på din ort",
  features: [
    "Skapa profil + obegränsat antal tjänster/events",
    "Synlig på marknadsplatsen",
    "Ingen provision – du betalar bara Stripes avgift",
    "Grundläggande statistik",
  ],
};

/** Role-aware Gratis plan. Publik doesn't pay commission and doesn't
 * create listings, so the feature list is reframed for that role.
 *
 * `foundingPartner` byter ut planen helt för kreatörer och venues — se
 * lib/partners/founding.ts för vem som har statusen.
 */
export function getGratisPlan(role: MemberRole, foundingPartner = false) {
  if (foundingPartner && role !== "customer") {
    return GRUNDARPARTNER_PLAN;
  }
  if (role === "customer") {
    return {
      ...GRATIS_PLAN,
      description: "Upptäck och boka utan kostnad",
      features: [
        "Skapa profil och logga in",
        "Bläddra i marknadsplatsen",
        "Boka utan extra avgifter",
      ],
    };
  }
  // creator/experience use the default features
  return GRATIS_PLAN;
}

/** Client-safe plan list, optionally filtered by role */
/**
 * Planerna som går att teckna. Avvecklade nivåer filtreras bort här i stället
 * för att raderas, så att en befintlig prenumeration fortfarande kan läsas.
 */
export function getPlanList(role?: MemberRole) {
  const plans = (Object.keys(PLANS) as PlanKey[])
    .filter((key) => !PLANS[key].retired)
    .map((key) => ({
    key,
    name: PLANS[key].name,
    role: PLANS[key].role,
    tier: PLANS[key].tier,
    price: PLANS[key].price,
    description: PLANS[key].description,
    features: PLANS[key].features,
    popular: PLANS[key].popular ?? false,
  }));

  if (role) {
    return plans.filter((p) => p.role === role);
  }
  return plans;
}

/** Legacy alias for backwards compatibility */
export const PLAN_LIST = getPlanList();
