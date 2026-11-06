import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScanLine, Lock, Play, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOperateEntrance } from "@/lib/scan-access";
import { kioskAccessForOwner, type KioskAccess } from "@/lib/tickets/kiosk-access";
import { stockholmDay } from "@/lib/tickets/event-day";

export const dynamic = "force-dynamic";

/**
 * Självinsläpp — hubben under Mer.
 *
 * Här finns allt den som ska ställa upp plattan behöver: startknappen för
 * kvällens evenemang, och guiden för första gångerna. Själva kiosken ligger
 * på /dorr/<id>, utanför appen, så att flikraden inte syns på plattan.
 *
 * Premium-funktion: grinden går på värdens nivå (kiosk-access.ts). En crew-
 * medlem ser samma lås men kan inte uppgradera åt arrangören — därför två
 * olika texter.
 */
export default async function DoorHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/dorr");
  const t = await getTranslations("dorrPage");

  const admin = createAdminClient();
  const today = stockholmDay(new Date());
  const { data: listings } = await admin
    .from("listings")
    .select("id, user_id, title, event_date")
    .eq("listing_type", "event")
    .is("archived_at", null)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(30);

  const mine: { id: string; title: string; date: string; owner: string; access: KioskAccess }[] = [];
  const accessByOwner = new Map<string, KioskAccess>();
  for (const l of listings ?? []) {
    if (mine.length >= 6) break;
    if (!(await canOperateEntrance(admin, user.id, l))) continue;
    let access = accessByOwner.get(l.user_id);
    if (!access) {
      access = await kioskAccessForOwner(admin, l.user_id);
      accessByOwner.set(l.user_id, access);
    }
    mine.push({ id: l.id, title: l.title, date: l.event_date, owner: l.user_id, access });
  }
  // Starta-knappen tar bara KVÄLLENS evenemang. Annars valdes närmaste
  // kommande kväll av sig själv, och en fredag hamnade plattan på
  // tisdagens zouk när det var torsdagens The Lab som skulle köras –
  // två olika arrangemang på samma konto. Ingen kväll i dag: välj själv.
  const primary = mine[0]?.date === today ? mine[0] : null;
  const rest = primary ? mine.slice(1) : mine;

  const fmtDate = (d: string) =>
    d === today ? t("tonight") : new Date(d + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-2 flex items-center gap-2">
        <ScanLine size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <span className="ml-auto rounded-full border border-[var(--usha-gold)]/50 px-2.5 py-0.5 text-xs font-semibold text-[var(--usha-gold)]">
          {t("premiumBadge")}
        </span>
      </div>
      <p className="mb-6 text-sm text-[var(--usha-muted)]">{t("lead")}</p>

      {/* Starta */}
      <section className="mb-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        {!primary ? (
          <p className="text-sm text-[var(--usha-muted)]">{mine.length > 0 ? t("noEventTonight") : t("noEvents")}</p>
        ) : primary.access.allowed ? (
          <>
            <p className="mb-1 text-base font-bold first-letter:uppercase">{fmtDate(primary.date)}</p>
            <p className="mb-4 text-lg font-bold text-[var(--usha-gold)]">{primary.title}</p>
            <Link
              href={`/sjalvinslapp/${primary.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--usha-gold)] py-4 text-lg font-bold text-black transition hover:opacity-90"
            >
              <Play size={20} /> {t("start")}
            </Link>
            {primary.access.beta && <p className="mt-2 text-center text-xs text-[var(--usha-muted)]">{t("betaBadge")}</p>}
          </>
        ) : (
          <>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{fmtDate(primary.date)}</p>
            <p className="mb-3 text-lg font-semibold">{primary.title}</p>
            <div className="flex items-start gap-3 rounded-xl border border-[var(--usha-border)] p-4">
              <Lock size={18} className="mt-0.5 shrink-0 text-[var(--usha-gold)]" />
              <div>
                <p className="text-sm">{primary.owner === user.id ? t("lockedOwner") : t("lockedCrew")}</p>
                {primary.owner === user.id && (
                  <Link href="/dashboard/billing" className="mt-2 inline-block text-sm font-semibold text-[var(--usha-gold)]">
                    {t("upgrade")} →
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
        {rest.length > 0 && (
          <div className={primary ? "mt-4 border-t border-[var(--usha-border)] pt-3" : "mt-3"}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{primary ? t("otherNights") : t("chooseNight")}</p>
            {/* Varje kväll som en tydlig rad: datumet stort, evenemanget i
                Usha-guld och fetstil – så att The Lab (torsdag) och zouken
                (tisdag) inte går att blanda ihop när man väljer. */}
            <ul className="space-y-2">
              {rest.map((e) => {
                const row = (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-base font-bold text-[var(--usha-white)] first-letter:uppercase">{fmtDate(e.date)}</span>
                      <span className={`text-lg font-bold leading-snug ${e.access.allowed ? "text-[var(--usha-gold)]" : "text-[var(--usha-muted)]"}`}>
                        {e.title}
                      </span>
                    </span>
                    {!e.access.allowed && <Lock size={14} className="shrink-0 text-[var(--usha-muted)]" />}
                  </>
                );
                return (
                  <li key={e.id}>
                    {e.access.allowed ? (
                      <Link
                        href={`/sjalvinslapp/${e.id}`}
                        className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] px-4 py-3 transition hover:border-[var(--usha-gold)]/60 hover:bg-[var(--usha-gold)]/5"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] px-4 py-3 opacity-70">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Guide */}
      <Guide heading={t("howHeading")} items={[t("how1"), t("how2"), t("how3")]} />
      <Guide heading={t("firstHeading")} numbered items={[t("first1"), t("first2"), t("first3"), t("first4"), t("first5"), t("first6")]} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{t("duringHeading")}</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-3 rounded-xl bg-green-600/15 px-4 py-3">
            <CheckCircle2 size={18} className="shrink-0 text-green-500" /> {t("duringGreen")}
          </li>
          <li className="flex items-center gap-3 rounded-xl bg-yellow-500/15 px-4 py-3">
            <AlertCircle size={18} className="shrink-0 text-yellow-500" /> {t("duringYellow")}
          </li>
          <li className="flex items-center gap-3 rounded-xl bg-red-600/15 px-4 py-3">
            <XCircle size={18} className="shrink-0 text-red-500" /> {t("duringRed")}
          </li>
        </ul>
        <p className="mt-3 text-sm text-[var(--usha-muted)]">{t("duringCrew")}</p>
      </section>

      <Guide heading={t("tipsHeading")} items={[t("tip1"), t("tip2"), t("tip3")]} />

      <p className="text-xs text-[var(--usha-muted)]">{t("shortLink")}</p>
    </div>
  );
}

function Guide({ heading, items, numbered }: { heading: string; items: string[]; numbered?: boolean }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{heading}</h2>
      <ol className="space-y-2 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3">
            <span className="shrink-0 font-bold text-[var(--usha-gold)]">{numbered ? i + 1 : "•"}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
