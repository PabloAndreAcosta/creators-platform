import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HeartHandshake } from "lucide-react";
import { loadUpcomingEvenings } from "@/lib/taxi/data";
import { stockholmToday } from "@/lib/time";

export const dynamic = "force-dynamic";

const time = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Kommande kvällar som söker taxidansare. Länken i inläggen kan peka hit. */
export default async function TaxiEveningsPage() {
  const t = await getTranslations("taxiPass");
  const evenings = await loadUpcomingEvenings(stockholmToday());

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <HeartHandshake size={22} className="text-[var(--usha-gold)]" />
        {t("listTitle")}
      </h1>
      <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("listIntro")}</p>

      {evenings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-10 text-center text-sm text-[var(--usha-muted)]">
          {t("listEmpty")}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {evenings.map((e) => (
            <Link
              key={e.id}
              href={`/app/taxi/${e.id}`}
              className="block rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 hover:border-[var(--usha-gold)]/40"
            >
              <p className="font-semibold">{e.title}</p>
              <p className="text-sm text-[var(--usha-muted)]">{e.event_date}</p>
              <p className="mt-2 text-xs text-[var(--usha-muted)]">
                {e.shifts
                  .map((s) => `${time(s.starts_at)}–${time(s.ends_at)} ${t(`kind_${s.kind}`)} (${t("spotsLeft", { n: Math.max(0, s.capacity - s.booked) })})`)
                  .join(" · ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
