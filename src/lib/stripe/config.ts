export const PLANS = {
  free: {
    name: "Gratis",
    price: 0,
    currency: "SEK",
    interval: "month" as const,
    description: "Kom igång utan kostnad",
    commission: 12,
    features: [
      "Skapa profil med bio och portfolio",
      "Upp till 3 aktiva listor",
      "Synas på marketplace",
      "Ta emot bokningar",
      "Grundläggande statistik",
      "12% plattformsavgift per bokning",
      "Email-support",
    ],
    stripePriceId: "",
  },
  premium: {
    name: "Premium",
    price: 199,
    currency: "SEK",
    interval: "month" as const,
    popular: true,
    description: "För den seriösa kreatören",
    commission: 8,
    features: [
      "Allt i Gratis",
      "Obegränsade listor",
      "Prioriterad visning på marketplace",
      "Lägre plattformsavgift (8%)",
      "Avancerad statistik och trender",
      "Kalendersynk och bokningssystem",
      "Verifierad-badge",
      "Prioriterad support (24h)",
    ],
    stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID || "",
  },
  enterprise: {
    name: "Enterprise",
    price: 499,
    currency: "SEK",
    interval: "month" as const,
    description: "För verksamheter med hög volym",
    commission: 5,
    features: [
      "Allt i Premium",
      "Lägst plattformsavgift (5%)",
      "Upp till 10 teammedlemmar",
      "API-tillgång",
      "Dedikerad account manager",
      "Custom integrationer",
      "SLA-garanti (99.9%)",
      "White-label alternativ",
    ],
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/** Client-safe plan data (no price IDs) */
export const PLAN_LIST = (Object.keys(PLANS) as PlanKey[]).map((key) => ({
  key,
  name: PLANS[key].name,
  price: PLANS[key].price,
  description: PLANS[key].description,
  features: PLANS[key].features,
  popular: key === "premium",
}));
