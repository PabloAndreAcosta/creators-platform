"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Clock,
  Edit2,
  Trash2,
  Plus,
  MoreVertical,
  Ticket,
  TrendingUp,
  Calendar,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toaster";
import { deleteEvent, toggleEventActive } from "./actions";
import { EVENT_CATEGORY_LABELS } from "./constants";
import { FacebookConnect } from "@/components/facebook/FacebookConnect";
import { FacebookSyncButton } from "@/components/facebook/FacebookSyncButton";

const EVENT_IMAGES = [
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=250&fit=crop",
];

const FB_ERROR_MESSAGES: Record<string, string> = {
  denied: "Du nekade åtkomst till Facebook.",
  token: "Kunde inte hämta Facebook-token. Försök igen.",
  pages: "Kunde inte hämta dina Facebook-sidor.",
  no_pages: "Inga Facebook-sidor hittades. Du behöver administrera en sida för att kunna synka event.",
};

interface ListingData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  facebook_event_id: string | null;
  image_url: string | null;
}

interface EventsContentProps {
  listings: ListingData[];
  facebookPageId: string | null;
  facebookPageName: string | null;
  fbConnected?: boolean;
  fbError?: string;
}

export function EventsContent({
  listings,
  facebookPageId,
  facebookPageName,
  fbConnected,
  fbError,
}: EventsContentProps) {
  const { toast } = useToast();
  const activeCount = listings.filter((l) => l.is_active).length;

  useEffect(() => {
    if (fbConnected) {
      toast.success("Facebook-sida ansluten!", "Du kan nu synka evenemang med Facebook.");
    }
    if (fbError && FB_ERROR_MESSAGES[fbError]) {
      toast.error("Facebook-anslutning misslyckades", FB_ERROR_MESSAGES[fbError]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mina Evenemang</h1>
        <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
          {activeCount} aktiva
        </span>
      </div>

      {/* Facebook connect panel */}
      <FacebookConnect pageName={facebookPageName} pageId={facebookPageId} />

      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16">
          <Calendar size={40} className="mb-4 text-[var(--usha-muted)]" />
          <p className="text-base font-medium text-[var(--usha-muted)]">Inga evenemang ännu</p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            Skapa ditt första evenemang för att komma igång
          </p>
        </div>
      ) : (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4">
              <Ticket size={16} className="mb-1 text-[var(--usha-gold)]" />
              <p className="text-xl font-bold">{listings.length}</p>
              <p className="text-[11px] text-[var(--usha-muted)]">Totalt evenemang</p>
            </div>
            <div className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4">
              <TrendingUp size={16} className="mb-1 text-[var(--usha-gold)]" />
              <p className="text-xl font-bold">{activeCount}</p>
              <p className="text-[11px] text-[var(--usha-muted)]">Aktiva</p>
            </div>
          </div>

          {/* Event list */}
          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
            {listings.map((listing, i) => (
              <EventCard
                key={listing.id}
                listing={listing}
                index={i}
                hasPageConnected={!!facebookPageId}
              />
            ))}
          </div>
        </>
      )}

      {/* Add new event */}
      <Link
        href="/app/events/new"
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
      >
        <Plus size={18} />
        Skapa nytt evenemang
      </Link>
    </div>
  );
}

function EventCard({
  listing,
  index,
  hasPageConnected,
}: {
  listing: ListingData;
  index: number;
  hasPageConnected: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isActive, setIsActive] = useState(listing.is_active);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const categoryLabel = EVENT_CATEGORY_LABELS[listing.category] ?? listing.category;
  const image = listing.image_url || EVENT_IMAGES[index % EVENT_IMAGES.length];
  const price = listing.price ? `${listing.price} kr` : "Gratis";
  const duration = listing.duration_minutes ? `${listing.duration_minutes} min` : null;

  function handleToggle() {
    setShowMenu(false);
    const newActive = !isActive;
    setIsActive(newActive);
    startTransition(async () => {
      const result = await toggleEventActive(listing.id, newActive);
      if (result?.error) {
        setIsActive(!newActive);
        toast.error("Fel", result.error);
      }
    });
  }

  function handleDelete() {
    setShowMenu(false);
    if (!confirm(`Ta bort "${listing.title}"? Det går inte att ångra.`)) return;
    startTransition(async () => {
      const result = await deleteEvent(listing.id);
      if (result?.error) {
        toast.error("Fel", result.error);
      } else {
        toast.success("Evenemang borttaget");
        router.refresh();
      }
    });
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-[var(--usha-card)] transition-opacity ${
        isActive ? "border-[var(--usha-border)]" : "border-[var(--usha-border)] opacity-60"
      } ${isPending ? "pointer-events-none opacity-50" : ""}`}
    >
      {/* Image */}
      <div className="relative h-36">
        <img src={image} alt={listing.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            isActive ? "bg-green-500/90 text-white" : "bg-[var(--usha-muted)]/80 text-white"
          }`}
        >
          {isActive ? "Aktiv" : "Utkast"}
        </span>

        <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          {categoryLabel}
        </span>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-base font-bold text-white">{listing.title}</h3>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-4 text-xs text-[var(--usha-muted)]">
          {duration && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {duration}
            </span>
          )}
          {listing.description && (
            <span className="line-clamp-1 flex-1">{listing.description}</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--usha-gold)]">
            {price}
          </span>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-2 text-[var(--usha-muted)] hover:bg-[var(--usha-card-hover)] hover:text-white"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute bottom-full right-0 z-20 mb-1 min-w-[160px] rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] py-1 shadow-xl">
                  <Link
                    href={`/app/events/${listing.id}/edit`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                    onClick={() => setShowMenu(false)}
                  >
                    <Edit2 size={12} />
                    Redigera
                  </Link>
                  <button
                    onClick={handleToggle}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                  >
                    {isActive ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
                    {isActive ? "Avaktivera" : "Aktivera"}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-[var(--usha-card-hover)]"
                  >
                    <Trash2 size={12} />
                    Ta bort
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Facebook sync */}
        <FacebookSyncButton
          listingId={listing.id}
          facebookEventId={listing.facebook_event_id}
          hasPageConnected={hasPageConnected}
        />
      </div>
    </div>
  );
}
