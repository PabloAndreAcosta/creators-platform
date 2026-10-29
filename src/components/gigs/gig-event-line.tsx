import Link from "next/link";
import { parsePassType } from "@/lib/gigs/pass-types";
import type { LinkedEvent } from "@/lib/gigs/linked-events";

/** Passtyp och kvällen uppdraget hör till, på en rad under rubriken. */
export function GigEventLine({
  passType,
  event,
  t,
}: {
  passType: string | null | undefined;
  event: LinkedEvent | undefined;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const type = parsePassType(passType);
  if (!type && !event) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      {type && (
        <span className="rounded-full bg-[var(--usha-gold)]/10 px-2.5 py-0.5 font-medium text-[var(--usha-gold)]">
          {t(`passType.${type}`)}
        </span>
      )}
      {event &&
        (event.slug ? (
          <Link href={`/event/${event.slug}`} className="text-[var(--usha-muted)] underline-offset-2 hover:underline">
            {t("linkedEvent", { title: event.title })}
          </Link>
        ) : (
          <span className="text-[var(--usha-muted)]">{t("linkedEvent", { title: event.title })}</span>
        ))}
    </div>
  );
}
