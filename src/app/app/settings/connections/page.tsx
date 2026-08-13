import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isVenueRole } from "@/lib/roles";
import { getConnectionState } from "@/lib/social/connection-state";
import { ConnectionsList, type ConnectionView } from "./connections-list";

// Kanonisk plats för alla externa kopplingar. Låg tidigare utspritt: Instagram,
// Facebook och TikTok i botten av /dashboard/profile, plus en andra
// Facebook-yta i /app/events. Featureytor får fortsatt visa en inline-knapp,
// men statusen bor här.
export default async function ConnectionsSettingsPage() {
  const t = await getTranslations("connections");
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

  const isCreator = profile?.role === "creator" || isVenueRole(profile?.role);

  const { data: conn } = await supabase
    .from("social_connections")
    // Måste vara en enda strängliteral — konkatenering gör att Supabase inte
    // kan härleda radtypen och allt faller tillbaka till GenericStringError.
    .select("instagram_username, instagram_access_token, instagram_token_expires_at, facebook_page_name, facebook_page_access_token, facebook_token_expires_at, tiktok_username, tiktok_access_token, tiktok_token_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const now = new Date();

  const connections: ConnectionView[] = [
    {
      provider: "instagram",
      name: "Instagram",
      accountLabel: conn?.instagram_username ? `@${conn.instagram_username}` : null,
      purpose: t("instagramPurpose"),
      ...getConnectionState(
        {
          hasToken: !!conn?.instagram_access_token,
          expiresAt: conn?.instagram_token_expires_at ?? null,
        },
        now
      ),
    },
    {
      provider: "facebook",
      name: "Facebook",
      accountLabel: conn?.facebook_page_name ?? null,
      purpose: t("facebookPurpose"),
      ...getConnectionState(
        {
          hasToken: !!conn?.facebook_page_access_token,
          expiresAt: conn?.facebook_token_expires_at ?? null,
        },
        now
      ),
    },
    {
      provider: "tiktok",
      name: "TikTok",
      accountLabel: conn?.tiktok_username ? `@${conn.tiktok_username}` : null,
      purpose: t("tiktokPurpose"),
      ...getConnectionState(
        {
          hasToken: !!conn?.tiktok_access_token,
          expiresAt: conn?.tiktok_token_expires_at ?? null,
        },
        now
      ),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-[var(--usha-muted)] mt-1">{t("subtitle")}</p>
      </div>

      {isCreator ? (
        <ConnectionsList connections={connections} />
      ) : (
        <p className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-sm text-[var(--usha-muted)]">
          {t("creatorOnly")}
        </p>
      )}
    </div>
  );
}
