import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import JoinContent from "./join-content";

/**
 * Sidan där en inbjuden säger ja.
 *
 * Behörigheten börjar gälla här, inte när ägaren skickade inbjudan — man ska
 * inte kunna göras ansvarig för någon annans lokal utan att ha sagt ja.
 */
export default async function JoinVenuePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/app/venue-team/join/${encodeURIComponent(token)}`);

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("venue_members")
    .select("capabilities, accepted_at, removed_at, expires_at, profiles!venue_profile_id(full_name, company_name)")
    .eq("token", token)
    .maybeSingle();

  const venue = Array.isArray(invite?.profiles) ? invite.profiles[0] : invite?.profiles;
  const venueName = (venue?.company_name || venue?.full_name || "").trim() || null;

  const t = await getTranslations("venueJoin");
  const tc = await getTranslations("venueTeam.capabilities");

  const gone =
    !invite ||
    !!invite.removed_at ||
    !!invite.accepted_at ||
    new Date(invite.expires_at).getTime() < Date.now();

  return (
    <JoinContent
      token={token}
      gone={gone}
      venueName={venueName}
      capabilities={(invite?.capabilities ?? []).map((c: string) => tc(`${c}.label`))}
      labels={{
        heading: venueName ? t("heading", { venue: venueName }) : t("headingGeneric"),
        intro: t("intro"),
        goneTitle: t("goneTitle"),
        goneBody: t("goneBody"),
        accept: t("accept"),
        accepted: t("accepted"),
        failed: t("failed"),
        nothing: t("nothing"),
      }}
    />
  );
}
