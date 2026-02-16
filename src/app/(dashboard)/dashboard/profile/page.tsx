import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, bio, website, category, location, hourly_rate, is_public")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/dashboard");
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <h1 className="text-3xl font-bold">Redigera profil</h1>
        <p className="mt-1 text-[var(--usha-muted)]">
          Uppdatera din information och gör din profil synlig för kunder.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
        <ProfileForm profile={profile} />
      </div>
    </>
  );
}
