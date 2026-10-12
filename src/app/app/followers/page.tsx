import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { BroadcastForm } from "@/components/broadcast-form";
import { activeEmailFollowers } from "@/lib/follows/email-follow";
import { mottagareAvFoljare } from "@/lib/email/follower-audience";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("followersPage");
  return { title: `${t("title")} – Usha Platform` };
}

/**
 * Skriv till dina egna följare.
 *
 * Utskicket fanns bara per evenemang: man kunde nå dem som ställt sig i kö till
 * en viss kväll, men inte dem som följer en. Det är bakvänt — följaren har sagt
 * ja till AVSÄNDAREN, väntelistan bara till en kväll. API:t fanns redan och var
 * färdigt; det som saknades var vägen in till det.
 *
 * Mottagarna räknas med exakt samma funktioner som utskicket självt använder,
 * så siffran på knappen är den som faktiskt får mejlet.
 */
export default async function FollowersPage() {
  const t = await getTranslations("followersPage");
  const locale = await getLocale();
  const dateFmt = locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : "sv-SE";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [rows, { data: past }] = await Promise.all([
    activeEmailFollowers(admin, user.id),
    admin
      .from("email_broadcasts")
      .select("subject, recipient_count, status, created_at")
      .eq("creator_id", user.id)
      .eq("audience", "followers")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const recipientCount = mottagareAvFoljare(rows).length;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 text-[var(--usha-white)]">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-[var(--usha-muted)]">
        <span className="text-[var(--usha-gold)]">{recipientCount}</span> {t("recipients")}
      </p>

      {recipientCount === 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
          <p className="text-sm font-medium">{t("emptyHeading")}</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--usha-muted)]">{t("emptyBody")}</p>
        </div>
      ) : (
        <div className="mt-6">
          <BroadcastForm endpoint="/api/creators/broadcast" recipientCount={recipientCount} />
        </div>
      )}

      <p className="mt-8 rounded-xl border border-[var(--usha-border)] px-4 py-3 text-[12px] leading-relaxed text-[var(--usha-muted)]">
        {t("consentNote")}
      </p>

      {past && past.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-[var(--usha-muted)]">{t("pastHeading")}</h2>
          <ul className="space-y-2">
            {past.map((b, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-2.5 text-sm"
              >
                <span className="truncate">
                  {b.status === "test" && (
                    <span className="mr-2 rounded bg-[var(--usha-border)] px-1.5 py-0.5 text-[10px] uppercase">test</span>
                  )}
                  {b.subject}
                </span>
                <span className="ml-3 shrink-0 text-[var(--usha-muted)]">
                  {t("recipientsShort", { count: b.recipient_count })} ·{" "}
                  {new Date(b.created_at).toLocaleDateString(dateFmt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
