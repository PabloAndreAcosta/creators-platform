import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createGig } from "../actions";
import { GigForm } from "./gig-form";

export default async function NewGigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile as { role?: string | null } | null)?.role !== "experience") {
    redirect("/dashboard");
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard/gigs"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <h1 className="text-3xl font-bold">Nytt gig</h1>
        <p className="mt-1 text-[var(--usha-muted)]">
          Posta ett event så taxidansare kan ansöka. Du väljer sedan en av sökandena och
          betalar via plattformen efter acceptans.
        </p>
      </div>

      <GigForm action={createGig} />
    </>
  );
}
