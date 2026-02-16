import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import ListingRow from "./listing-row";

export default async function ListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
          >
            <ArrowLeft size={14} />
            Tillbaka
          </Link>
          <h1 className="text-3xl font-bold">Mina tjänster</h1>
          <p className="mt-1 text-[var(--usha-muted)]">
            Hantera dina tjänster som visas i marketplace.
          </p>
        </div>
        <Link
          href="/dashboard/listings/new"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
        >
          <Plus size={16} />
          Ny tjänst
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--usha-border)] py-16 text-center">
          <p className="mb-1 text-[var(--usha-muted)]">Inga tjänster ännu.</p>
          <p className="text-sm text-[var(--usha-muted)]">
            <Link href="/dashboard/listings/new" className="text-[var(--usha-gold)] hover:underline">
              Skapa din första tjänst
            </Link>{" "}
            för att bli synlig i marketplace.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </>
  );
}
