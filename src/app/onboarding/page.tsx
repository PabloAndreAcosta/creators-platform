import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = {
  title: "Onboarding — Usha Platform",
  robots: { index: false, follow: false },
};

/**
 * Onboarding-router demo wired to the real ob_* tables. BankID is mocked and no
 * real payments run (§9 gate). When the visitor is logged in, their progress is
 * persisted to their account; otherwise the flow runs as an unsaved demo.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-[var(--usha-black)] px-4 py-10 text-[var(--usha-white)]">
      <OnboardingFlow isLoggedIn={!!user} />
    </main>
  );
}
