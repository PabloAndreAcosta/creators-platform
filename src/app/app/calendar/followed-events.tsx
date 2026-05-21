import Link from "next/link";
import Image from "next/image";
import { CalendarHeart, MapPin, Clock } from "lucide-react";

export interface FollowedEvent {
  id: string;
  title: string;
  eventDate: string; // YYYY-MM-DD
  eventTime?: string | null;
  location?: string | null;
  creatorName: string;
  creatorAvatar?: string | null;
  creatorHandle: string; // slug or id
}

export function FollowedEvents({ events }: { events: FollowedEvent[] }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <CalendarHeart size={18} className="text-[var(--usha-gold)]" />
        Från kreatörer du följer
      </h2>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-center">
          <p className="text-sm text-[var(--usha-muted)]">
            Följ kreatörer så dyker deras kommande event upp här.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const date = new Date(e.eventDate + "T00:00");
            return (
              <li key={e.id}>
                <Link
                  href={`/listing/${e.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/50"
                >
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
                    <span className="text-lg font-bold leading-none">{date.toLocaleDateString("sv-SE", { day: "numeric" })}</span>
                    <span className="text-[11px] uppercase">{date.toLocaleDateString("sv-SE", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{e.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--usha-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        {e.creatorAvatar ? (
                          <Image src={e.creatorAvatar} alt={e.creatorName} width={16} height={16} className="h-4 w-4 rounded-full object-cover" />
                        ) : null}
                        {e.creatorName}
                      </span>
                      {e.eventTime && <span className="inline-flex items-center gap-1"><Clock size={12} /> {e.eventTime.slice(0, 5)}</span>}
                      {e.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {e.location}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
