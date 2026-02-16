import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ListingForm from "../../listing-form";
import { updateListing } from "../../actions";

export default async function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, description, category, price, duration_minutes")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!listing) notFound();

  const updateWithId = updateListing.bind(null, listing.id);

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard/listings"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <h1 className="text-3xl font-bold">Redigera tjänst</h1>
      </div>

      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
        <ListingForm listing={listing} action={updateWithId} />
      </div>
    </>
  );
}
