import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, HeartHandshake, Utensils } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadEvening, loadShifts, loadStrikeFacts } from "@/lib/taxi/data";
import { canCheckIn, canCheckOut, isLateCancel, strikeCount, STRIKE_LIMIT, ageOn } from "@/lib/taxi/rules";
import { signUpForShifts, cancelShift, checkIn, checkOut, redeemVoucher } from "../actions";

export const dynamic = "force-dynamic";

const time = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * Taxipass för en kväll, sett av dansaren: villkoren, anmälan, egna pass med
 * in- och utcheckning, och matkupongen. Hit leder länken i inläggen.
 */
export default async function TaxiEveningPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await props.params;
  const { notice } = await props.searchParams;
  const t = await getTranslations("taxiPass");
  const evening = await loadEvening(id);
  if (!evening) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const shifts = await loadShifts(id);
  const now = new Date();
  const db = createAdminClient();

  let mine: {
    id: string;
    shift_id: string;
    status: string;
    checked_in_at: string | null;
    checked_out_at: string | null;
  }[] = [];
  let strikes = 0;
  let voucherAt: string | null = null;
  let needsAgeConfirm = true;
  if (user) {
    const shiftIds = shifts.map((s) => s.id);
    const [{ data: rows }, facts, { data: voucher }, { data: profile }] = await Promise.all([
      shiftIds.length
        ? db.from("taxi_signups").select("id, shift_id, status, checked_in_at, checked_out_at").eq("dancer_id", user.id).in("shift_id", shiftIds)
        : Promise.resolve({ data: [] }),
      loadStrikeFacts(user.id, evening),
      db.from("taxi_vouchers").select("redeemed_at").eq("listing_id", id).eq("dancer_id", user.id).maybeSingle(),
      db.from("profiles").select("bankid_personal_number").eq("id", user.id).single(),
    ]);
    mine = rows ?? [];
    strikes = strikeCount(facts, now);
    voucherAt = voucher?.redeemed_at ?? null;
    needsAgeConfirm = ageOn(profile?.bankid_personal_number, evening.event_date) === null;
  }
  const booked = mine.filter((m) => m.status === "booked");
  const bookedIds = new Set(booked.map((m) => m.shift_id));
  const blocked = strikes >= STRIKE_LIMIT;
  const open = shifts.filter((s) => Date.parse(s.starts_at) > now.getTime() && s.booked < s.capacity && !bookedIds.has(s.id));
  const anyCheckedIn = booked.some((m) => m.checked_in_at);
  const late = isLateCancel(evening.event_date, now);

  const notices = [
    "signedUp", "cancelled", "cancelledLate", "checkedIn", "checkedOut", "voucherRedeemed", "noShift", "mustAccept",
    "notFound", "bankid", "age", "blocked", "closed", "full", "checkInClosed", "checkOutClosed", "voucherNeedsCheckIn",
  ];
  const btn = "rounded-lg px-3 py-1.5 text-xs font-bold";
  const gold = `${btn} bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      <Link href="/app/taxi" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]">
        <ChevronLeft size={14} />
        {t("allEvenings")}
      </Link>
      <h1 className="text-2xl font-bold">{t("eveningTitle", { title: evening.title })}</h1>
      <p className="mt-1 text-sm text-[var(--usha-muted)]">{evening.event_date}</p>

      {notice && notices.includes(notice) && (
        <div className="mt-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm font-medium">
          {t(`notice_${notice}`)}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <HeartHandshake size={16} className="text-[var(--usha-gold)]" />
          {t("volunteerTitle")}
        </p>
        <p className="mt-1 text-[var(--usha-muted)]">{t("volunteerBody")}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--usha-muted)]">
          {["ruleAge", "ruleAlcohol", "ruleLength", "ruleCancel", "ruleCheck", "ruleDecline"].map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </div>

      {user && booked.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">{t("myShifts")}</h2>
          <div className="space-y-2">
            {booked.map((m) => {
              const s = shifts.find((x) => x.id === m.shift_id)!;
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-sm">
                  <div>
                    <p className="font-medium">{time(s.starts_at)}–{time(s.ends_at)}</p>
                    <p className="text-xs text-[var(--usha-muted)]">
                      {m.checked_in_at ? t("checkedInAt", { time: time(m.checked_in_at) }) : t("notCheckedIn")}
                      {m.checked_out_at ? ` · ${t("checkedOutAt", { time: time(m.checked_out_at) })}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!m.checked_in_at && canCheckIn(s, now) && (
                      <form action={checkIn}><input type="hidden" name="signupId" value={m.id} /><button className={gold}>{t("checkIn")}</button></form>
                    )}
                    {canCheckOut(m, s, now) && (
                      <form action={checkOut}><input type="hidden" name="signupId" value={m.id} /><button className={gold}>{t("checkOut")}</button></form>
                    )}
                    {!m.checked_in_at && Date.parse(s.starts_at) > now.getTime() && (
                      <form action={cancelShift}>
                        <input type="hidden" name="signupId" value={m.id} />
                        <button className={`${btn} border border-[var(--usha-border)] text-[var(--usha-muted)]`}>
                          {late ? t("cancelLate") : t("cancel")}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {user && anyCheckedIn && (
        <section className="mt-6 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Utensils size={16} className="text-[var(--usha-gold)]" />
            {t("voucherTitle")}
          </p>
          {voucherAt ? (
            <p className="mt-1 text-[var(--usha-muted)]">{t("voucherRedeemedAt", { time: time(voucherAt) })}</p>
          ) : (
            <form action={redeemVoucher} className="mt-2">
              <input type="hidden" name="listingId" value={id} />
              <p className="mb-2 text-[var(--usha-muted)]">{t("voucherHint")}</p>
              <button className={gold}>{t("voucherRedeem")}</button>
            </form>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">{t("signUpTitle")}</h2>
        {user && strikes > 0 && (
          <p className="mb-3 text-sm text-[var(--usha-muted)]">{t("strikes", { n: strikes, limit: STRIKE_LIMIT })}</p>
        )}
        {!user ? (
          <Link href={`/login?next=/app/taxi/${id}`} className={gold}>
            {t("loginToSignUp")}
          </Link>
        ) : blocked ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{t("blockedBody")}</p>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-[var(--usha-muted)]">{t("noShifts")}</p>
        ) : open.length === 0 ? (
          <p className="text-sm text-[var(--usha-muted)]">{t("noOpenShifts")}</p>
        ) : (
          <form action={signUpForShifts} className="space-y-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
            <input type="hidden" name="listingId" value={id} />
            <fieldset className="space-y-2">
              <legend className="mb-1 font-medium">{t("chooseShifts")}</legend>
              {open.map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input type="checkbox" name="shiftId" value={s.id} />
                  {time(s.starts_at)}–{time(s.ends_at)}
                  <span className="text-xs text-[var(--usha-muted)]">{t("spotsLeft", { n: s.capacity - s.booked })}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-1">
              <legend className="mb-1 font-medium">{t("photoQuestion")}</legend>
              <label className="flex items-center gap-2"><input type="radio" name="photo" value="yes" required /> {t("photoYes")}</label>
              <label className="flex items-center gap-2"><input type="radio" name="photo" value="no" required /> {t("photoNo")}</label>
            </fieldset>
            <div className="space-y-2">
              <label className="flex items-start gap-2"><input type="checkbox" name="volunteer" required className="mt-1" /> {t("ackVolunteer")}</label>
              <label className="flex items-start gap-2"><input type="checkbox" name="rules" required className="mt-1" /> {t("ackRules")}</label>
              {needsAgeConfirm && (
                <label className="flex items-start gap-2"><input type="checkbox" name="age" required className="mt-1" /> {t("ackAge")}</label>
              )}
            </div>
            <button className={gold}>{t("signUp")}</button>
          </form>
        )}
      </section>
    </div>
  );
}
