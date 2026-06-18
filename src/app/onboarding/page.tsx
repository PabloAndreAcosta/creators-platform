import type { Metadata } from "next";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = {
  title: "Onboarding — Usha Platform",
  robots: { index: false, follow: false },
};

/**
 * Testable onboarding-router demo (Usha_byggspec_onboarding.md). BankID, Stripe,
 * EOR and Skatteverket are all mocked; no real payments. This is a standalone
 * module that does not touch the live profiles/bookings flows.
 */
export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[var(--usha-black)] px-4 py-10 text-[var(--usha-white)]">
      <OnboardingFlow />
    </main>
  );
}
