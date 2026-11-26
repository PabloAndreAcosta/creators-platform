import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { checkIn } from "@/app/app/taxi/actions";
import { canCheckIn, CHECKIN_EARLY_MINUTES } from "@/lib/taxi/rules";
import { shiftRoleName } from "@/lib/taxi/roles";
import type { Journey } from "@/lib/taxi/journey";
import type { MyShift } from "@/lib/taxi/data";

/**
 * Vägledning för volontären: "Så funkar det" (1 Ansök, 2 Välj pass,
 * 3 Checka in), nästa steg för just den inloggade och de egna passen med
 * incheckningsknappen. Byggt efter The Lab 26 nov, då ingen hittade vare sig
 * passvalet efter godkännandet eller incheckningen.
 */

const time = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const goldBig =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-base font-bold text-black transition hover:opacity-90 sm:w-auto";

const STEP_KEYS = ["apply", "choose", "checkin"] as const;

/** Tre numrerade steg. Utan journey visas de som en allmän förklaring. */
export async function VolunteerSteps({ journey, withHelp = false }: { journey?: Journey; withHelp?: boolean }) {
  const t = await getTranslations("taxiPass");
  return (
    <section aria-label={t("howTitle")} className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <h2 className="mb-3 text-sm font-semibold">{t("howTitle")}</h2>
      <ol className={withHelp ? "space-y-3" : "grid grid-cols-3 gap-2"}>
        {STEP_KEYS.map((k, i) => {
          const state = journey?.steps.find((s) => s.key === k)?.state ?? "todo";
          const circle =
            state === "done"
              ? "bg-green-500/20 text-green-400"
              : state === "current"
                ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black"
                : "bg-[var(--usha-border)] text-[var(--usha-muted)]";
          return (
            <li key={k} className={withHelp ? "flex gap-3" : "flex flex-col items-center gap-1 text-center"} aria-current={state === "current" ? "step" : undefined}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${circle}`}>
                {state === "done" ? <Check size={16} aria-label={t("stepDone")} /> : i + 1}
              </span>
              <span>
                <span className={`block text-sm ${state === "current" ? "font-bold" : "font-medium"}`}>{t(`step_${k}`)}</span>
                {withHelp && <span className="block text-sm text-[var(--usha-muted)]">{t(`stepHelp_${k}`)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Nästa steg för den inloggade på en kvälls sida, med en stor knapp när det finns något att trycka på. */
export async function NextStepCard({ journey, listingId }: { journey: Journey; listingId: string }) {
  const t = await getTranslations("taxiPass");
  const n = journey.next;
  const toForm = "#valj-pass";

  let text: string;
  let action: React.ReactNode = null;
  switch (n.kind) {
    case "account":
      text = t("next_account");
      action = <Link href={`/login?next=/app/taxi/${listingId}`} className={goldBig}>{t("next_accountButton")}</Link>;
      break;
    case "bankid":
      text = t("next_bankid");
      action = <a href={toForm} className={goldBig}>{t("next_bankidButton")}</a>;
      break;
    case "apply":
      text = t("next_apply");
      action = <a href={toForm} className={goldBig}>{t("next_applyButton")}</a>;
      break;
    case "choose":
      text = t("next_choose");
      action = <a href={toForm} className={goldBig}>{t("next_chooseButton")}</a>;
      break;
    case "checkInNow":
      text = t("next_checkInNow", { from: time(n.shift.starts_at), to: time(n.shift.ends_at) });
      action = (
        <form action={checkIn}>
          <input type="hidden" name="signupId" value={n.shift.signupId} />
          <button className={goldBig}>{t("next_checkInNowButton")}</button>
        </form>
      );
      break;
    case "checkInLater":
      text = t("next_checkInLater", { from: time(n.shift.starts_at), to: time(n.shift.ends_at), opens: time(n.opensAt) });
      break;
    default:
      text = t(`next_${n.kind}`);
  }

  const strong = n.kind === "checkInNow" || n.kind === "choose";
  return (
    <section
      className={`rounded-2xl border p-4 ${strong ? "border-[var(--usha-gold)] bg-[var(--usha-gold)]/10" : "border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5"}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--usha-gold)]">{t("nextTitle")}</p>
      <p className="mt-1 text-sm">{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </section>
  );
}

/** De egna kommande passen med incheckningsknapp, för /taxi och /app/taxi. */
export async function MyUpcomingShifts({ shifts, now = new Date() }: { shifts: MyShift[]; now?: Date }) {
  if (shifts.length === 0) return null;
  const t = await getTranslations("taxiPass");
  return (
    <section className="rounded-2xl border border-[var(--usha-gold)]/40 bg-[var(--usha-gold)]/5 p-4">
      <h2 className="mb-3 text-lg font-semibold">{t("myShifts")}</h2>
      <div className="space-y-3">
        {shifts.map((s) => {
          const open = !s.checked_in_at && canCheckIn(s, now);
          const opens = new Date(Date.parse(s.starts_at) - CHECKIN_EARLY_MINUTES * 60_000).toISOString();
          return (
            <div key={s.signupId} className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-sm">
              <Link href={`/app/taxi/${s.listing_id}`} className="font-semibold hover:underline">
                {s.title}
              </Link>
              <p className="text-[var(--usha-muted)]">
                {s.event_date} · {shiftRoleName(s, t)} {time(s.starts_at)}–{time(s.ends_at)}
              </p>
              {s.checked_in_at ? (
                <p className="mt-1 text-xs font-semibold text-green-400">{t("checkedInAt", { time: time(s.checked_in_at) })}</p>
              ) : open ? (
                <form action={checkIn} className="mt-2">
                  <input type="hidden" name="signupId" value={s.signupId} />
                  <button className={goldBig}>{t("next_checkInNowButton")}</button>
                </form>
              ) : (
                <p className="mt-1 text-xs text-[var(--usha-muted)]">{t("checkInOpensAt", { time: time(opens) })}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
