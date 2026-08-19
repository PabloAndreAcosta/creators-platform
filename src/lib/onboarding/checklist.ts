// Category-aware onboarding checklist (REAL profile state).
//
// NOTE: this is intentionally separate from the §9-legal-gated mock router in
// `router.ts` / `guards.ts` (which drives the theoretical ob_* flow). This module
// only computes which practical setup steps a user still needs, per category,
// from their real profile — and links to the existing dashboard pages/gates.
//
// Pure + dependency-light so it is cheap to unit-test.
import { normalizeRole, ROLES } from "@/lib/roles";

export interface OnboardingContext {
  role: string | null | undefined;
  isCompany?: boolean;
  // seller profile state
  bio?: string | null;
  avatarUrl?: string | null;
  bankidVerifiedAt?: string | null;
  companyVerifiedAt?: string | null;
  termsUrl?: string | null;
  servicesCount?: number;
  stripeAccountId?: string | null;
  stripeCardPaymentsEnabled?: boolean;
  isPublic?: boolean;
  // customer state
  customerLocation?: string | null;
  hasPreferences?: boolean;
}

export interface OnboardingStep {
  key: string;
  /** i18n key under the "onboarding" namespace. */
  labelKey: string;
  done: boolean;
  href: string;
  required: boolean;
}

const PROFILE = "/dashboard/profile";
const BILLING = "/dashboard/billing";
// The Stripe card sits below the plan grid, so the step links to it directly.
// Landing at the top of a page about subscriptions, when the task is about
// payouts, is how a finishable step comes to look impossible.
const BILLING_STRIPE = "/dashboard/billing#stripe";

/** Steps for a seller's Stripe connection, reflecting the two-flow MoR model. */
function stripeStep(ctx: OnboardingContext): OnboardingStep {
  if (!ctx.stripeAccountId) {
    return { key: "stripe", labelKey: "connectStripe", done: false, href: BILLING_STRIPE, required: true };
  }
  if (!ctx.stripeCardPaymentsEnabled) {
    // Connected but not yet merchant-of-record capable — must finish onboarding.
    return { key: "stripe", labelKey: "completeStripe", done: false, href: BILLING_STRIPE, required: true };
  }
  return { key: "stripe", labelKey: "connectStripe", done: true, href: BILLING_STRIPE, required: true };
}

/**
 * Build the ordered onboarding steps for a user's category. Company steps appear
 * for venues and for creators-with-company; the customer flow is light.
 */
export function buildOnboardingSteps(ctx: OnboardingContext): OnboardingStep[] {
  const role = normalizeRole(ctx.role);
  const services = ctx.servicesCount ?? 0;

  // ── Customer: light flow, no seller/payment gates ──
  if (role === ROLES.CUSTOMER || role === null) {
    return [
      {
        key: "customer_profile",
        labelKey: "customerCompleteProfile",
        done: !!ctx.customerLocation,
        href: PROFILE,
        required: true,
      },
      {
        key: "customer_preferences",
        labelKey: "customerSetPreferences",
        done: !!ctx.hasPreferences,
        href: "/app",
        required: false,
      },
    ];
  }

  const isVenue = role === ROLES.VENUE;
  const isCompany = isVenue || !!ctx.isCompany;
  const steps: OnboardingStep[] = [];

  // Profile (bio + avatar)
  steps.push({
    key: "profile",
    labelKey: "completeProfile",
    done: !!(ctx.bio && ctx.avatarUrl),
    href: PROFILE,
    required: true,
  });

  // BankID — required for creators; for venues an optional alternative to company
  // verification (marketplace visibility needs company OR bankid).
  if (!isVenue) {
    steps.push({
      key: "bankid",
      labelKey: "verifyBankid",
      done: !!ctx.bankidVerifiedAt,
      href: PROFILE,
      required: true,
    });
  } else if (!ctx.companyVerifiedAt) {
    steps.push({
      key: "bankid",
      labelKey: "verifyBankidOptional",
      done: !!ctx.bankidVerifiedAt,
      href: PROFILE,
      required: false,
    });
  }

  // Company verification (venue + creator-with-company) → org.nr on receipts + MoR.
  if (isCompany) {
    steps.push({
      key: "company",
      labelKey: "verifyCompany",
      done: !!ctx.companyVerifiedAt,
      href: PROFILE,
      required: true,
    });
    // Purchase terms — recommended for companies (shown at checkout).
    steps.push({
      key: "terms",
      labelKey: "addTerms",
      done: !!ctx.termsUrl,
      href: PROFILE,
      required: false,
    });
  }

  // First listing/event
  steps.push({
    key: "listing",
    labelKey: isVenue ? "createFirstEvent" : "createFirstService",
    done: services > 0,
    href: isVenue ? "/app/events/new" : "/dashboard/listings/new",
    required: true,
  });

  // Stripe payout / merchant-of-record
  steps.push(stripeStep(ctx));

  // Make profile public
  steps.push({
    key: "public",
    labelKey: "makeProfilePublic",
    done: !!ctx.isPublic,
    href: PROFILE,
    required: true,
  });

  return steps;
}

/** Convenience: how many steps are done vs total (for a progress bar). */
export function onboardingProgress(steps: OnboardingStep[]): { done: number; total: number } {
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}
