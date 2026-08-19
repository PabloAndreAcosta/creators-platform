import { getTranslations } from "next-intl/server";
import { KeyRound, Search, ShieldCheck, Check, X } from "lucide-react";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_CAPABILITIES, isAdminCapability, type AdminCapability } from "@/lib/admin/capabilities";
import { ADMIN_DESTINATIONS, adminDestinationsFor } from "@/lib/navigation/registry";
import { AdminNav } from "@/components/admin/admin-nav";
import { setAdminCapability } from "./actions";

export const dynamic = "force-dynamic";

/** The label a capability borrows from the tool it unlocks. */
const LABEL_KEY: Record<AdminCapability, string> = Object.fromEntries(
  ADMIN_DESTINATIONS.filter((d) => isAdminCapability(d.requires)).map((d) => [d.requires, d.labelKey])
) as Record<AdminCapability, string>;

/**
 * Grant a partner one slice of the admin surface without handing over the rest.
 *
 * Full admin only, and deliberately not delegable — see the action.
 */
export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; status?: string }>;
}) {
  const { email, status } = await searchParams;
  const access = await requireAdmin("full");

  const t = await getTranslations("adminAccess");
  const tTools = await getTranslations("adminPage");

  const query = (email ?? "").trim().toLowerCase();
  const admin = createAdminClient();

  let profile: { id: string; full_name: string | null; email: string; is_admin: boolean | null } | null = null;
  let held: AdminCapability[] = [];

  if (query) {
    const { data } = await admin
      .from("profiles")
      .select("id, full_name, email, is_admin")
      .eq("email", query)
      .maybeSingle();
    profile = data ?? null;

    if (profile) {
      const { data: rows } = await admin
        .from("admin_capabilities")
        .select("capability")
        .eq("user_id", profile.id);
      held = (rows ?? []).map((r) => r.capability).filter(isAdminCapability);
    }
  }

  const notices: Record<string, { text: string; tone: "ok" | "bad" }> = {
    granted: { text: t("noticeGranted"), tone: "ok" },
    revoked: { text: t("noticeRevoked"), tone: "ok" },
    already_full: { text: t("noticeAlreadyFull"), tone: "bad" },
    invalid: { text: t("noticeInvalid"), tone: "bad" },
    error: { text: t("noticeError"), tone: "bad" },
  };
  const notice = status ? notices[status] : undefined;

  return (
    <>
      <AdminNav paths={adminDestinationsFor(access).map((d) => d.path)} />

      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <KeyRound size={24} className="text-[var(--usha-gold)]" />
          {t("title")}
        </h1>
        <p className="mt-1 text-[var(--usha-muted)]">{t("intro")}</p>
      </div>

      {notice && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${
            notice.tone === "ok"
              ? "border-green-500/20 bg-green-500/10 text-green-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}
        >
          {notice.text}
        </div>
      )}

      <form method="GET" className="mb-8 flex gap-2">
        <input
          type="email"
          name="email"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          className="w-full max-w-sm rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--usha-gold)]/40"
        />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
        >
          <Search size={16} />
          {t("searchButton")}
        </button>
      </form>

      {query && !profile && (
        <p className="text-sm text-[var(--usha-muted)]">{t("noMatch", { query })}</p>
      )}

      {profile && (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
          <div className="mb-5">
            <p className="font-semibold">{profile.full_name || t("noName")}</p>
            <p className="text-sm text-[var(--usha-muted)]">{profile.email}</p>
          </div>

          {profile.is_admin ? (
            <p className="flex items-center gap-2 text-sm text-[var(--usha-gold)]">
              <ShieldCheck size={16} />
              {t("isFullAdmin")}
            </p>
          ) : (
            <div className="space-y-2">
              {ADMIN_CAPABILITIES.map((capability) => {
                const granted = held.includes(capability);
                return (
                  <form
                    key={capability}
                    action={setAdminCapability}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[var(--usha-border)] px-4 py-3"
                  >
                    <input type="hidden" name="userId" value={profile.id} />
                    <input type="hidden" name="email" value={profile.email} />
                    <input type="hidden" name="capability" value={capability} />
                    <input type="hidden" name="grant" value={granted ? "false" : "true"} />

                    <span className="flex items-center gap-2 text-sm">
                      {granted ? (
                        <Check size={15} className="text-green-400" />
                      ) : (
                        <X size={15} className="text-[var(--usha-muted)]" />
                      )}
                      {tTools(LABEL_KEY[capability])}
                    </span>

                    <button
                      type="submit"
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        granted
                          ? "border border-[var(--usha-border)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
                          : "bg-[var(--usha-gold)] text-black hover:opacity-90"
                      }`}
                    >
                      {granted ? t("revoke") : t("grant")}
                    </button>
                  </form>
                );
              })}
              <p className="pt-2 text-xs text-[var(--usha-muted)]">{t("footnote")}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
