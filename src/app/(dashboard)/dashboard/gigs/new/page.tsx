import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

  if ((profile as { role?: string | null } | null)?.role !== "venue") {
    redirect("/dashboard");
  }

  const t = await getTranslations("gigForm");

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard/gigs"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </Link>
        <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
        <p className="mt-1 text-[var(--usha-muted)]">{t("pageIntro")}</p>
      </div>

      <GigForm action={createGig} />
    </>
  );
}
