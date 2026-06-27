import { cookies } from "next/headers";
import type Stripe from "stripe";
import { LOCALE_COOKIE_NAME } from "@/i18n/config";

// Map the visitor's chosen app language (usha-locale cookie) to a Stripe
// Checkout locale, so the hosted payment page matches the rest of the UI
// instead of guessing from the browser. Defaults to Swedish (platform default).
export async function getStripeLocale(): Promise<Stripe.Checkout.SessionCreateParams.Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  return value === "en" ? "en" : "sv";
}
