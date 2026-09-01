import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isVenueRole } from "@/lib/roles";
import { VENUE_CAPABILITIES, VENUE_PRESETS } from "@/lib/venues/members";
import VenueTeamContent from "./venue-team-content";

/**
 * Lokalens team.
 *
 * Ägaren är lokalen, så sidan handlar alltid om den inloggades egen lokal.
 * Medlemmar hamnar inte här — de har ingenting att dela ut.
 */
export default async function VenueTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // role är kolumn-låst för authenticated; service-role för uppslaget.
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isVenueRole(profile?.role)) redirect("/app");

  const t = await getTranslations("venueTeam");
  const tc = await getTranslations("venueTeam.capabilities");
  const tp = await getTranslations("venueTeam.presets");

  return (
    <VenueTeamContent
      appUrl={process.env.NEXT_PUBLIC_APP_URL || "https://usha.se"}
      capabilities={VENUE_CAPABILITIES.map((c) => ({
        key: c,
        label: tc(`${c}.label`),
        hint: tc(`${c}.hint`),
      }))}
      presets={Object.keys(VENUE_PRESETS).map((p) => ({
        key: p,
        label: tp(`${p}.label`),
        hint: tp(`${p}.hint`),
      }))}
      labels={{
        heading: t("heading"),
        intro: t("intro"),
        ownerNote: t("ownerNote"),
        empty: t("empty"),
        invite: t("invite"),
        inviteEmail: t("inviteEmail"),
        inviteSubmit: t("inviteSubmit"),
        pending: t("pending"),
        copyLink: t("copyLink"),
        copied: t("copied"),
        remove: t("remove"),
        save: t("save"),
        saved: t("saved"),
        failed: t("failed"),
        customPreset: t("customPreset"),
      }}
    />
  );
}
