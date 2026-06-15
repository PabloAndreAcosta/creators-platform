// "Nycklar" — tokens that unlock creator tools (alternative to the subscription
// tiers). Packages are platform revenue (one-time Stripe charge, no Connect).
// Prices are tentative — easy to tune.

export const TOKEN_NAME = { one: "nyckel", many: "nycklar" } as const;

export interface NyckelPackage {
  id: string;
  tokens: number;
  priceSek: number;
}

export const NYCKEL_PACKAGES: NyckelPackage[] = [
  { id: "starter", tokens: 5, priceSek: 99 },
  { id: "standard", tokens: 15, priceSek: 249 },
  { id: "stor", tokens: 40, priceSek: 549 },
];

export function getPackage(id: string): NyckelPackage | undefined {
  return NYCKEL_PACKAGES.find((p) => p.id === id);
}
