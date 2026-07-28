export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrainingBuddiesContent } from "./training-buddies-content";

export const metadata = {
  title: "Träningsvänner · Usha Platform",
  description: "Hitta träningspartner för dans.",
};

export default async function TrainingBuddiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/training-buddies");
  return <TrainingBuddiesContent />;
}
