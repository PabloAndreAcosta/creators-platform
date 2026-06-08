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

  // RLS allows self-select on listing_collaborators.
  const { data: collabs } = await supabase
    .from("listing_collaborators")
    .select("listing_id, role, accepted_at")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false });

  const ids = (collabs ?? []).map((c) => c.listing_id);

  // Read listing details with the service role, scoped strictly to listings this
  // user collaborates on — so past/deactivated events stay visible (RLS would
  // otherwise hide is_active = false from a non-host).
  const listingsById = new Map<string, any>();
  if (ids.length) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: listings } = await admin
      .from("listings")
      .select("id, title, slug, image_url, event_date, event_location")
      .in("id", ids);
    for (const l of listings ?? []) listingsById.set(l.id, l);
  }

  const items = (collabs ?? [])
    .map((c) => ({ ...c, listing: listingsById.get(c.listing_id) }))
    .filter((c) => c.listing);

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Users size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-2xl font-bold">Mina samarbeten</h1>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8 text-center">
          <p className="text-sm font-medium text-white/90">Inga samarbeten än</p>
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
                  <p className="line-clamp-1 text-sm font-semibold text-white">{l.title}</p>
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
