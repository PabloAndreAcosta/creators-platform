export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/mobile/app-shell";

export const metadata = {
  title: "Usha App",
  description: "Din kreativa plattform",
};

export default async function MobileAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userName = "Användare";

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      userName = profile?.full_name || user.email || "Användare";
    }
  } catch {
    // Continue without auth
  }

  return (
    <AppShell userName={userName}>
      {children}
    </AppShell>
  );
}
