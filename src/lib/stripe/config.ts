export const PLANS = {
  basic: {
    name: "Basic",
    price: 99,
    currency: "SEK",
    interval: "month" as const,
    description: "Perfekt för att komma igång",
    features: [
      "Skapa din profil",
      "Visa upp dina tjänster",
      "Upp till 5 aktiva listor",
      "Grundläggande statistik",
      "Email-support",
    ],
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || "",
  },
  premium: {
    name: "Premium",
    price: 199,
    currency: "SEK",
    interval: "month" as const,
    popular: true,
    description: "För den seriösa kreatören",
    features: [
      "Allt i Basic",
      "Obegränsade listor",
      "Prioriterad visning",
      "Avancerad statistik",
      "Direkt bokningssystem",
      "Prioriterad support",
    ],
    stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID || "",
  },
  enterprise: {
    name: "Enterprise",
    price: 499,
    currency: "SEK",
    interval: "month" as const,
    description: "Full kontroll och support",
    features: [
      "Allt i Premium",
      "Anpassad profil-design",
      "API-tillgång",
      "Dedikerad account manager",
      "Custom integrationer",
      "SLA-garanti",
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
