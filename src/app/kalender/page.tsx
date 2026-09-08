export const revalidate = 60; // ISR: kalendern behöver inte vara sekundfärsk

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Calendar, Clock, MapPin, Repeat, ArrowRight } from "lucide-react";
import { stockholmDay } from "@/lib/tickets/event-day";
import { fetchUpcomingListings } from "@/lib/calendar/visibility";
import { bucketFor, groupUpcoming, type CalendarBucket, type CalendarEntry } from "@/lib/calendar/upcoming";

// Publik kalender. Ingen filtrering, ingen sortering att välja — bara vad som
// händer, i tidsordning, med serier hopslagna till en rad. Sidan nås alltid
// på sin adress; menylänken styrs av utbudet (lib/calendar/visibility.ts).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://usha.se"}/kalender`,
    },
  };
}

const BUCKETS: CalendarBucket[] = ["today", "thisWeek", "nextWeek", "later"];
const TZ = "Europe/Stockholm";

function noon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

function hhmm(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

export default async function KalenderPage() {
  const [t, locale, listings] = await Promise.all([
    getTranslations("calendar"),
    getLocale(),
    fetchUpcomingListings(),
  ]);
  const today = stockholmDay(new Date());
  const entries = groupUpcoming(listings, today);

  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: TZ });
  const nextFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: TZ });
  // Veckodagsnamn via ett känt datum med rätt veckodag (2026-09-06 är en söndag).
  const weekdayName = (wd: number) => weekdayFmt.format(noon(`2026-09-${String(6 + wd).padStart(2, "0")}`));

  const grouped = new Map<CalendarBucket, CalendarEntry[]>();
  for (const e of entries) {
    const b = bucketFor(e.date, today);
    grouped.set(b, [...(grouped.get(b) ?? []), e]);
  }

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <header className="sticky top-0 z-30 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-gradient">Usha Platform</Link>
          <nav className="flex items-center gap-4">
            <Link href="/flode" className="text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]">{t("navFeed")}</Link>
            <Link href="/upplevelser" className="text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]">{t("navExperiences")}</Link>
            <Link href="/signup" className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--usha-muted)] hover:text-[var(--usha-white)]">{t("navCreateProfile")}</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <Calendar size={24} className="text-[var(--usha-gold)]" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("intro", { count: entries.length })}</p>

        {entries.length === 0 && (
          <p className="mt-10 rounded-xl border border-[var(--usha-border)] p-6 text-center text-sm text-[var(--usha-muted)]">
            {t("empty")}
          </p>
        )}

        {BUCKETS.map((bucket) => {
          const items = grouped.get(bucket);
          if (!items?.length) return null;
          return (
            <section key={bucket} className="mt-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--usha-muted)]">{t(bucket)}</h2>
              <ul className="flex flex-col gap-3">
                {items.map((e) => {
                  const start = hhmm(e.time);
                  const end = hhmm(e.endTime);
                  return (
                    <li key={e.key}>
                      <Link
                        href={e.href}
                        className="group flex gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 transition hover:border-[var(--usha-gold)]/40"
                      >
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--usha-border)]">
                          {e.imageUrl ? (
                            <Image src={e.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[var(--usha-muted)]">
                              <Calendar size={20} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-[var(--usha-gold)]">
                            <span className="font-semibold">{dayFmt.format(noon(e.date))}</span>
                            {start && (
                              <span className="flex items-center gap-1 text-[var(--usha-muted)]">
                                <Clock size={11} />
                                {start}{end ? `–${end}` : ""}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-0.5 truncate font-semibold text-[var(--usha-white)]">{e.title}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--usha-muted)]">
                            {e.location && (
                              <span className="flex items-center gap-1"><MapPin size={11} />{e.location}</span>
                            )}
                            {e.occurrences > 1 && (
                              <span className="flex items-center gap-1">
                                <Repeat size={11} />
                                {e.recurringWeekday !== null
                                  ? t("every", { weekday: weekdayName(e.recurringWeekday) })
                                  : t("occurrences", { count: e.occurrences })}
                                {e.recurringWeekday !== null && ` · ${t("occurrences", { count: e.occurrences })}`}
                              </span>
                            )}
                            <span>{e.price ? t("price", { price: e.price }) : t("free")}</span>
                          </div>
                          {e.occurrences > 1 && (
                            <p className="mt-1 text-[11px] text-[var(--usha-muted)]">{t("next", { date: nextFmt.format(noon(e.date)) })}</p>
                          )}
                        </div>
                        <ArrowRight size={16} className="mt-1 shrink-0 self-start text-[var(--usha-muted)] transition group-hover:text-[var(--usha-gold)]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
