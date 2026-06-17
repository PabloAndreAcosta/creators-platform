import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CrewManager } from "./crew-manager";
import type { GageView } from "@/components/gage-panel";
import { canDelegateScan, canReceiveScan } from "@/lib/scan-access";

export const dynamic = "force-dynamic";

export const metadata = { title: "Crew – Usha Platform" };

export default async function CrewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: listing } = await admin
    .from("listings")
    .select("id, title, slug, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!listing || listing.user_id !== user.id) notFound();

  const [{ data: collabs }, { data: invites }] = await Promise.all([
    admin
      .from("listing_collaborators")
      .select("user_id, role, status, accepted_at, can_scan")
      .eq("listing_id", params.id)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: true }),
    admin
      .from("collaborator_invites")
      .select("id, role, invited_email, invited_phone, token, expires_at")
      .eq("listing_id", params.id)
      .is("accepted_user_id", null)
      .order("created_at", { ascending: false }),
  ]);

  const ids = (collabs ?? []).map((c) => c.user_id);
  const profilesById = new Map<string, any>();
  if (ids.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url, stripe_account_id, role, tier")
      .in("id", ids);
    for (const p of profiles ?? []) profilesById.set(p.id, p);
  }

  // Only Gold/Premium hosts may delegate scanning.
  const { data: hostProfile } = await admin
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle();
  const hostCanDelegateScan = canDelegateScan(hostProfile?.tier);

  // Most relevant gage per collaborator: an active one (proposed/agreed) if any,
  // otherwise the latest (e.g. paid) for display.
  const { data: gages } = await admin
    .from("gage_agreements")
    .select("id, collaborator_user_id, amount_ore, status, proposed_by, note, created_at")
    .eq("listing_id", params.id)
    .order("created_at", { ascending: false });
  const gageByUser = new Map<string, any>();
  for (const g of gages ?? []) {
    const existing = gageByUser.get(g.collaborator_user_id);
    const isActive = g.status === "proposed" || g.status === "agreed";
    if (!existing || (isActive && existing.status !== "proposed" && existing.status !== "agreed")) {
      gageByUser.set(g.collaborator_user_id, g);
    }
  }

  const collaborators = (collabs ?? []).map((c) => ({
    user_id: c.user_id,
    role: c.role as string,
    full_name: profilesById.get(c.user_id)?.full_name ?? null,
    avatar_url: profilesById.get(c.user_id)?.avatar_url ?? null,
    can_scan: !!(c as { can_scan?: boolean }).can_scan,
    scan_eligible: canReceiveScan(
      profilesById.get(c.user_id)?.role,
      profilesById.get(c.user_id)?.tier
    ),
    payee_connected: !!profilesById.get(c.user_id)?.stripe_account_id,
    gage: gageByUser.get(c.user_id)
      ? ({
          id: gageByUser.get(c.user_id).id,
          amount_ore: gageByUser.get(c.user_id).amount_ore,
          status: gageByUser.get(c.user_id).status,
          proposed_by: gageByUser.get(c.user_id).proposed_by,
          note: gageByUser.get(c.user_id).note,
        } as GageView)
      : null,
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usha.se";
  const pendingInvites = (invites ?? []).map((i) => ({
    id: i.id as string,
    role: i.role as string,
    invited_email: i.invited_email as string | null,
    invited_phone: i.invited_phone as string | null,
    invite_url: `${appUrl}/app/invites/${i.token}`,
    expires_at: i.expires_at as string,
  }));

  return (
    <div className="px-4 py-6">
      <Link
        href="/app/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
      >
        <ChevronLeft size={16} />
        Evenemang
      </Link>
      <h1 className="text-2xl font-bold">Crew</h1>
      <p className="mt-1 text-sm text-[var(--usha-muted)]">{listing.title}</p>

      <CrewManager
        listingId={listing.id}
        initialCollaborators={collaborators}
        initialPendingInvites={pendingInvites}
        canDelegateScan={hostCanDelegateScan}
      />
    </div>
  );
}
