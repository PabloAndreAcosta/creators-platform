import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BroadcastForm } from "./broadcast-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mejla väntelistan – Usha Platform" };

export default async function BroadcastPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, title, slug, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!listing || listing.user_id !== user.id) notFound();

  const [{ count: activeCount }, { data: past }] = await Promise.all([
    admin
      .from("event_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", id)
      .is("unsubscribed_at", null),
    admin
      .from("email_broadcasts")
      .select("subject, recipient_count, status, created_at")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recipientCount = activeCount ?? 0;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 text-[var(--usha-white)]">
      <Link
        href={`/app/events/${id}/waitlist`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
      >
        <ChevronLeft className="h-4 w-4" /> Tillbaka till väntelistan
      </Link>

      <h1 className="text-2xl font-bold">Mejla väntelistan</h1>
      <p className="mt-1 text-sm text-[var(--usha-muted)]">
        {listing.title} · <span className="text-[var(--usha-gold)]">{recipientCount}</span> aktiva mottagare
      </p>

      <div className="mt-6">
        <BroadcastForm listingId={id} recipientCount={recipientCount} />
      </div>

      {past && past.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-[var(--usha-muted)]">Tidigare utskick</h2>
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
                  {b.recipient_count} st · {new Date(b.created_at).toLocaleDateString("sv-SE")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
