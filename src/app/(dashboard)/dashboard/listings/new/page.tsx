import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import ListingForm from "../listing-form";
import { createListing } from "../actions";
import { getSubscriptionStatus } from "@/lib/subscription/check";

export default async function NewListingPage() {
  // Server-side guard: redirect gratis users
  const { tier } = await getSubscriptionStatus();
  if (tier === "gratis") {
    redirect("/dashboard/billing");
  }

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
        <h1 className="text-3xl font-bold">Ny tjänst</h1>
        <p className="mt-1 text-[var(--usha-muted)]">
          Skapa en ny tjänst som kunder kan hitta och boka.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
        <ListingForm action={createListing} />
      </div>
    </>
  );
}
