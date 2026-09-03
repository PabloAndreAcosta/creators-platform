"use client";

import TimeSelect from "@/components/time-select";
import { useState, useTransition, useEffect, useRef } from "react";
import {
  Clock,
  Edit2,
  Trash2,
  Plus,
  MoreVertical,
  Ticket,
  TrendingUp,
  Calendar,
  MapPin,
  ToggleLeft,
  ToggleRight,
  Radio,
  ScanLine,
  BarChart3,
  Copy,
  Users,
  X as XIcon,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toaster";
import { deleteEvent, toggleEventActive, duplicateEvent } from "./actions";
import { trackEvent } from "@/lib/analytics";
import { EVENT_CATEGORY_LABELS } from "./constants";
import { FacebookConnect } from "@/components/facebook/FacebookConnect";
import { FacebookSyncButton } from "@/components/facebook/FacebookSyncButton";
import { SocialShareButton } from "@/components/social-share-button";
import { eventShareUrl } from "@/lib/events/share";

const EVENT_IMAGES = [
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=250&fit=crop",
];

const FB_ERROR_KEYS: Record<string, string> = {
  denied: "fbErrorDenied",
  token: "fbErrorToken",
  pages: "fbErrorPages",
  no_pages: "fbErrorNoPages",
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
  fb_auto_post: boolean | null;
  fb_reminder_posted_at: string | null;
  image_url: string | null;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
  user_id: string;
  slug: string | null;
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
  const t = useTranslations("myEvents");
  const activeCount = listings.filter((l) => l.is_active).length;

  useEffect(() => {
    if (fbConnected) {
      toast.success(t("fbConnectedTitle"), t("fbConnectedBody"));
      trackEvent("fb_connect");
    }
    if (fbError && FB_ERROR_KEYS[fbError]) {
      toast.error(t("fbConnectFailedTitle"), t(FB_ERROR_KEYS[fbError]));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/app/events/insights"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--usha-gold)] underline-offset-2 hover:underline"
          >
            <BarChart3 size={13} />
            {t("statistics")}
          </Link>
          <Link
            href="/app/events/open"
            className="text-xs font-medium text-[var(--usha-gold)] underline-offset-2 hover:underline"
          >
            {t("openEvents")}
          </Link>
          <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
            {t("activeCount", { count: activeCount })}
          </span>
        </div>
      </div>

      {/* Facebook connect panel */}
      <FacebookConnect pageName={facebookPageName} pageId={facebookPageId} />

      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16">
          <Calendar size={40} className="mb-4 text-[var(--usha-muted)]" />
          <p className="text-base font-medium text-[var(--usha-muted)]">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {t("emptyBody")}
          </p>
        </div>
      ) : (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4">
              <Ticket size={16} className="mb-1 text-[var(--usha-gold)]" />
              <p className="text-xl font-bold">{listings.length}</p>
              <p className="text-[11px] text-[var(--usha-muted)]">{t("statTotal")}</p>
            </div>
            <div className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4">
              <TrendingUp size={16} className="mb-1 text-[var(--usha-gold)]" />
              <p className="text-xl font-bold">{activeCount}</p>
              <p className="text-[11px] text-[var(--usha-muted)]">{t("statActive")}</p>
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
        {t("createNew")}
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
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [isActive, setIsActive] = useState(listing.is_active);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const t = useTranslations("myEvents");
  const ta = useTranslations("a11y");
  const router = useRouter();

  const categoryLabel = EVENT_CATEGORY_LABELS[listing.category] ?? listing.category;
  const image = listing.image_url || EVENT_IMAGES[index % EVENT_IMAGES.length];
  const price = listing.price ? `${listing.price} kr` : t("free");
  const duration = listing.duration_minutes ? `${listing.duration_minutes} min` : null;

  function handleToggle() {
    setShowMenu(false);
    const newActive = !isActive;
    setIsActive(newActive);
    startTransition(async () => {
      const result = await toggleEventActive(listing.id, newActive);
      if (result?.error) {
        setIsActive(!newActive);
        toast.error(t("errorTitle"), result.error);
      }
    });
  }

  function handleDelete() {
    setShowMenu(false);
    if (!confirm(t("deleteConfirm", { title: listing.title }))) return;
    startTransition(async () => {
      const result = await deleteEvent(listing.id);
      if (result?.error) {
        toast.error(t("errorTitle"), result.error);
      } else {
        toast.success(t("deleteSuccess"));
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
      <Link href={`/app/events/${listing.id}/edit`} className="relative block aspect-[1.91/1]">
        <img src={image} alt={listing.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            isActive ? "bg-green-500/90 text-white" : "bg-[var(--usha-muted)]/80 text-white"
          }`}
        >
          {isActive ? t("statusActive") : t("statusDraft")}
        </span>

        <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          {categoryLabel}
        </span>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-base font-bold text-white">{listing.title}</h3>
        </div>
      </Link>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div className="space-y-1.5 text-xs text-[var(--usha-muted)]">
          <div className="flex items-center gap-4">
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
          {(listing.event_date || listing.event_time || listing.event_location) && (
            <div className="flex flex-wrap items-center gap-3">
              {listing.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(listing.event_date + "T00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
              {listing.event_time && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {listing.event_time.slice(0, 5)}
                </span>
              )}
              {listing.event_location && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {listing.event_location}
                </span>
              )}
            </div>
          )}
          {listing.fb_auto_post && (
            listing.facebook_event_id ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-400">
                <CheckCircle2 size={12} />
                {t("fbPostPublished")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--usha-gold)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--usha-gold)]">
                <CalendarClock size={12} />
                {t("fbAutoPost")}
              </span>
            )
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--usha-gold)]">
            {price}
          </span>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              aria-label={ta("openMenu")}
              className="rounded-lg p-2 text-[var(--usha-muted)] hover:bg-[var(--usha-card-hover)] hover:text-[var(--usha-white)]"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute bottom-full right-0 z-20 mb-1 min-w-[160px] rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] py-1 shadow-xl">
                  <Link
                    href="/app/scan"
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--usha-gold)] hover:bg-[var(--usha-card-hover)]"
                    onClick={() => setShowMenu(false)}
                  >
                    <ScanLine size={12} />
                    {t("scanTickets")}
                  </Link>
                  {/* Bokningar först: det är hit man går för att se vem som
                      köpt och för att betala tillbaka. Återbetalning låg
                      tidigare bara i live-vyn, där ingen letade efter den. */}
                  <Link
                    href={`/app/events/${listing.id}/bookings`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                    onClick={() => setShowMenu(false)}
                  >
                    <Users size={12} />
                    {t("eventBookings")}
                  </Link>
                  <Link
                    href={`/app/events/${listing.id}/live`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs text-green-400 hover:bg-[var(--usha-card-hover)]"
                    onClick={() => setShowMenu(false)}
                  >
                    <Radio size={12} />
                    {t("liveDashboard")}
                  </Link>
                  <Link
                    href={`/app/events/${listing.id}/stats`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                    onClick={() => setShowMenu(false)}
                  >
                    <BarChart3 size={12} />
                    {t("statistics")}
                  </Link>
                  <Link
                    href={`/app/events/${listing.id}/edit`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                    onClick={() => setShowMenu(false)}
                  >
                    <Edit2 size={12} />
                    {t("edit")}
                  </Link>
                  <Link
                    href={`/app/events/${listing.id}/crew`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                    onClick={() => setShowMenu(false)}
                  >
                    <Users size={12} />
                    {t("crew")}
                  </Link>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowCloneModal(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                  >
                    <Copy size={12} />
                    {t("duplicateWithNewDate")}
                  </button>
                  <Link
                    href={`/app/events/new?from=${listing.id}`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                    onClick={() => setShowMenu(false)}
                  >
                    <Copy size={12} />
                    {t("duplicateAndEdit")}
                  </Link>
                  <button
                    onClick={handleToggle}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                  >
                    {isActive ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
                    {isActive ? t("deactivate") : t("activate")}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-[var(--usha-card-hover)]"
                  >
                    <Trash2 size={12} />
                    {t("delete")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Social sharing */}
        <div className="flex items-center gap-2">
          <SocialShareButton
            title={listing.title}
            url={eventShareUrl(
              listing,
              typeof window !== "undefined" ? window.location.origin : null
            )}
            eventDate={listing.event_date}
            eventTime={listing.event_time}
            eventLocation={listing.event_location}
            price={listing.price}
          />
          <FacebookSyncButton
            listingId={listing.id}
            facebookEventId={listing.facebook_event_id}
            hasPageConnected={hasPageConnected}
          />
        </div>
      </div>

      {showCloneModal && (
        <CloneModal
          listing={listing}
          onClose={() => setShowCloneModal(false)}
        />
      )}
    </div>
  );
}

function CloneModal({
  listing,
  onClose,
}: {
  listing: ListingData;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const t = useTranslations("myEvents");
  const ta = useTranslations("a11y");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState(listing.event_time?.slice(0, 5) ?? "");
  const [newEndTime, setNewEndTime] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate) {
      toast.error(t("dateRequired"));
      return;
    }
    startTransition(async () => {
      const result = await duplicateEvent(
        listing.id,
        newDate,
        newTime || null,
        newEndTime || null
      );
      if (result?.error) {
        toast.error(t("duplicateFailedTitle"), result.error);
      } else {
        toast.success(t("duplicateSuccessTitle"), t("duplicateSuccessBody", { title: listing.title }));
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-modal-title"
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="clone-modal-title" className="text-base font-bold">{t("cloneModalTitle")}</h3>
          <button
            onClick={onClose}
            aria-label={ta("close")}
            className="rounded-lg p-1 text-[var(--usha-muted)] hover:bg-[var(--usha-card-hover)] hover:text-[var(--usha-white)]"
            type="button"
          >
            <XIcon size={16} />
          </button>
        </div>
        <p className="mb-4 text-xs text-[var(--usha-muted)]">
          {t("cloneModalBody", { title: listing.title })}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--usha-muted)]">
              {t("newDate")} <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              required
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--usha-gold)]/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--usha-muted)]">{t("startTime")}</label>
              <TimeSelect compact value={newTime} onChange={setNewTime} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--usha-muted)]">{t("endTime")}</label>
              <TimeSelect compact value={newEndTime} onChange={setNewEndTime} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--usha-border)] py-2 text-sm hover:bg-[var(--usha-card-hover)]"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-[var(--usha-gold)] py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {isPending ? t("duplicating") : t("duplicate")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
