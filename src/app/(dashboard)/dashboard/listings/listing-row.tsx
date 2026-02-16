"use client";

import { useTransition } from "react";
import { deleteListing, toggleListingActive } from "./actions";
import { useToast } from "@/components/ui/toaster";
import Link from "next/link";
import { Clock, Pencil, Trash2 } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/categories";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

export default function ListingRow({ listing }: { listing: Listing }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleListingActive(listing.id, !listing.is_active);
      if (result.error) {
        toast({ title: "Fel", description: result.error, variant: "error" });
      }
    });
  }

  function handleDelete() {
    if (!confirm("Är du säker på att du vill ta bort denna tjänst?")) return;
    startTransition(async () => {
      const result = await deleteListing(listing.id);
      if (result.error) {
        toast({ title: "Fel", description: result.error, variant: "error" });
      } else {
        toast({ title: "Tjänst borttagen" });
      }
    });
  }

  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-5 transition-colors ${
        listing.is_active
          ? "border-[var(--usha-border)] bg-[var(--usha-card)]"
          : "border-[var(--usha-border)] bg-[var(--usha-card)] opacity-60"
      } ${isPending ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-3">
          <h3 className="truncate font-semibold">{listing.title}</h3>
          <span className="shrink-0 rounded-full border border-[var(--usha-border)] px-2.5 py-0.5 text-xs text-[var(--usha-muted)]">
            {CATEGORY_LABELS[listing.category] || listing.category}
          </span>
          {!listing.is_active && (
            <span className="shrink-0 rounded-full bg-[var(--usha-border)] px-2.5 py-0.5 text-xs text-[var(--usha-muted)]">
              Inaktiv
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--usha-muted)]">
          {listing.price != null && <span>{listing.price} SEK</span>}
          {listing.duration_minutes != null && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {listing.duration_minutes} min
            </span>
          )}
        </div>
      </div>

      <div className="ml-4 flex shrink-0 items-center gap-2">
        <button
          onClick={handleToggle}
          className="rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--usha-card-hover)]"
        >
          {listing.is_active ? "Inaktivera" : "Aktivera"}
        </button>
        <Link
          href={`/dashboard/listings/${listing.id}/edit`}
          className="rounded-lg p-2 text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card-hover)] hover:text-white"
        >
          <Pencil size={14} />
        </Link>
        <button
          onClick={handleDelete}
          className="rounded-lg p-2 text-[var(--usha-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
