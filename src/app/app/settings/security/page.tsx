import { redirect } from "next/navigation";
import Link from "next/link";
import { Mail, AtSign, ChevronRight, Trash2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isVenueRole } from "@/lib/roles";
import { BankIdStatus } from "@/app/(dashboard)/dashboard/profile/bankid-status";
import { ChangeLoginEmail } from "./security-actions";

export default async function SecuritySettingsPage() {
  const t = await getTranslations("security");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, contact_email, bankid_verified_at, bankid_name")
    .eq("id", user.id)
    .single();

  const isVenue = isVenueRole(profile?.role);
  const isCreator = profile?.role === "creator" || isVenue;

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-[var(--usha-muted)] mt-1">{t("subtitle")}</p>
      </div>

      {/* Login email */}
      <section className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--usha-border)]">
            <Mail size={18} className="text-[var(--usha-gold)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t("loginEmail")}</h2>
            <p className="text-sm text-[var(--usha-muted)]">{t("loginEmailDesc")}</p>
          </div>
        </div>
        <ChangeLoginEmail currentEmail={user.email ?? ""} />
      </section>

      {/* BankID status — reuses the profile component */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("bankidSection")}</h2>
        <BankIdStatus
          verifiedAt={profile?.bankid_verified_at ?? null}
          bankidName={profile?.bankid_name ?? null}
          isCreatorRole={isCreator && !isVenue}
          profileRole={profile?.role ?? null}
        />
      </section>

      {/* Public contact email (separate from login email) */}
      <section className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--usha-border)]">
            <AtSign size={18} className="text-[var(--usha-muted)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">{t("publicContactEmail")}</h2>
            <p className="text-sm text-[var(--usha-muted)] truncate">
              {profile?.contact_email || t("noPublicEmail")}
            </p>
          </div>
        </div>
        <p className="text-xs text-[var(--usha-muted)]">{t("publicContactEmailHint")}</p>
        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-1 text-sm text-[var(--usha-gold)] hover:underline"
        >
          {t("editOnProfile")}
          <ChevronRight size={14} />
        </Link>
      </section>

      {/* Delete account — links to the dedicated destructive page */}
      <Link
        href="/app/settings/account"
        className="flex items-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 transition hover:border-red-500/40"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
          <Trash2 size={18} className="text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-400">{t("deleteAccount")}</p>
          <p className="text-xs text-[var(--usha-muted)]">{t("deleteAccountDesc")}</p>
        </div>
        <ChevronRight size={16} className="text-[var(--usha-muted)]" />
      </Link>
    </div>
  );
}
