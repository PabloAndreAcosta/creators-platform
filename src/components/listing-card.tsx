import Link from "next/link";
import { MapPin, Calendar, Flame, Star } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/categories";

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    price: number | null;
    event_date: string | null;
    event_location: string | null;
    category: string | null;
    image_url: string | null;
  };
  bookingCount?: number;
  isPromoted?: boolean;
}

export function ListingCard({ listing, bookingCount = 0, isPromoted }: ListingCardProps) {
  const isPopular = bookingCount >= 3;
  const isHot = bookingCount >= 8;

  return (
    <Link
      href={`/listing/${listing.id}`}
      className={`group relative overflow-hidden rounded-xl border bg-[var(--usha-card)] transition hover:border-[var(--usha-gold)]/30 ${isPromoted ? "border-[var(--usha-gold)]/20 ring-1 ring-[var(--usha-gold)]/10" : "border-[var(--usha-border)]"}`}
    >
      {/* Badges — top-left overlay */}
      {(isPromoted || isHot || isPopular) && (
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {isPromoted && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--usha-gold)] px-2 py-0.5 text-[9px] font-bold uppercase text-black shadow-sm">
              <Star size={8} /> Framhävd
            </span>
          )}
          {isHot && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[9px] font-bold uppercase text-white shadow-sm">
              <Flame size={8} /> Populär
            </span>
          )}
          {isPopular && !isHot && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-white shadow-sm backdrop-blur-sm">
              {bookingCount} bokningar
            </span>
          )}
        </div>
      )}

      {/* Image */}
      {listing.image_url ? (
        <div className="aspect-video overflow-hidden">
          <img
            src={listing.image_url}
            alt={listing.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-[var(--usha-gold)]/5">
          <Calendar size={24} className="text-[var(--usha-gold)]/30" />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <p className="truncate text-sm font-semibold">{listing.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--usha-muted)]">
          {listing.event_date && (
            <span className="flex items-center gap-0.5">
              <Calendar size={10} />
              {new Date(listing.event_date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
            </span>
          )}
          {listing.event_location && (
            <span className="flex items-center gap-0.5">
              <MapPin size={10} />
              {listing.event_location.split(",")[0]}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--usha-gold)]">
            {listing.price ? `${listing.price} kr` : "Gratis"}
          </span>
          {listing.category && (
            <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] text-[var(--usha-gold)]">
              {CATEGORY_LABELS[listing.category] || listing.category}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
