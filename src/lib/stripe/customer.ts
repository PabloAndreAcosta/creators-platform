/**
 * Whether a stored customer id is a real Stripe customer.
 *
 * Comp subscriptions — lifetime access granted by hand — carry a placeholder
 * like "comp_owner" so the row has something in the column. Handing that to
 * Stripe's billing portal is a 500 and a toast saying nothing useful, which is
 * what a comp holder got every time they pressed Manage subscription.
 *
 * Stripe customer ids are always `cus_`-prefixed.
 */
export function isRealStripeCustomer(id: string | null | undefined): boolean {
  return typeof id === "string" && /^cus_[A-Za-z0-9]+$/.test(id);
}
