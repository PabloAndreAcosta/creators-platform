import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, Users } from "lucide-react";
import { collabRoleLabel } from "@/lib/collaborators";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mina samarbeten – Usch-Ja!" };

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T12:00:00+02:00`);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  });
}

export default async function MyCollaborationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // RLS allows self-select on listing_collaborators.
  const { data: collabs } = await supabase
    .from("listing_collaborators")
    .select("listing_id, role, accepted_at")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false });

  // Pending invites targeted directly at this user (RLS on collaborator_invites
  // is host-scoped, so the invitee reads their own via the service role).
  const nowIso = new Date().toISOString();
  const { data: rawInvites } = await admin
    .from("collaborator_invites")
    .select("id, listing_id, role, token, expires_at")
    .eq("invited_user_id", user.id)
    .is("accepted_user_id", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });

  const ids = [
    ...(collabs ?? []).map((c) => c.listing_id),
    ...(rawInvites ?? []).map((i) => i.listing_id),
  ];

  // Read listing details with the service role, scoped strictly to listings this
  // user collaborates on / is invited to — so past/deactivated events stay
  // visible (RLS would otherwise hide is_active = false from a non-host).
  const listingsById = new Map<string, any>();
  if (ids.length) {
    const { data: listings } = await admin
      .from("listings")
      .select("id, title, slug, image_url, event_date, event_location")
      .in("id", ids);
    for (const l of listings ?? []) listingsById.set(l.id, l);
  }

  const invites = (rawInvites ?? [])
    .map((i) => ({ ...i, listing: listingsById.get(i.listing_id) }))
    .filter((i) => i.listing);

  const items = (collabs ?? [])
    .map((c) => ({ ...c, listing: listingsById.get(c.listing_id) }))
    .filter((c) => c.listing);

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Users size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-2xl font-bold">Mina samarbeten</h1>
      </div>

      {invites.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-gold)]">
            Inbjudningar ({invites.length})
          </h2>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-[var(--usha-white)]">
                    {inv.listing.title}
                  </p>
                  <p className="text-[11px] text-[var(--usha-muted)]">
                    Inbjuden som {collabRoleLabel(inv.role).toLowerCase()}
                  </p>
                </div>
                <Link
                  href={`/app/invites/${inv.token}`}
                  className="shrink-0 rounded-full bg-[var(--usha-gold)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90"
                >
                  Visa & acceptera
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8 text-center">
          <p className="text-sm font-medium text-[var(--usha-white)]">Inga samarbeten än</p>
          <p className="mt-2 text-sm text-[var(--usha-muted)]">
            När en värd bjuder in dig till en produktion och du tackar ja dyker den upp här.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const l = c.listing;
            const dateLabel = formatDate(l.event_date);
            const href = l.slug ? `/event/${l.slug}` : `/listing/${l.id}`;
            return (
              <Link
                key={`${c.listing_id}-${c.role}`}
                href={href}
                className="flex items-center gap-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 transition hover:border-[var(--usha-gold)]/50"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
                  {l.image_url ? (
                    <Image
                      src={l.image_url}
                      alt={l.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[var(--usha-muted)]">
                      Usha
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-[var(--usha-white)]">{l.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--usha-muted)]">
                    {dateLabel && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} />
                        {dateLabel}
                      </span>
                    )}
                    {l.event_location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} />
                        {l.event_location}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--usha-gold)]/15 px-3 py-1 text-[11px] font-medium text-[var(--usha-gold)]">
                  {collabRoleLabel(c.role)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
