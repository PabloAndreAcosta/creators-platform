import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, HeartHandshake, ShieldCheck, Utensils } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadEvening, loadShifts, loadStrikeFacts } from "@/lib/taxi/data";
import { canCheckIn, dancerEligibility, isLateCancel, strikeStatus, taxiEveningFull, STRIKE_LIMIT, TAXI_MAX_PER_EVENING, type DancerEligibility } from "@/lib/taxi/rules";
import { BankIdVerifyButton } from "@/app/(dashboard)/dashboard/profile/bankid-verify-button";
import { signUpForShifts, cancelShift, checkIn, redeemVoucher } from "../actions";

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
  }[] = [];
  let strikes = 0;
  let suspendedUntil: string | null = null;
  let voucherAt: string | null = null;
  let eligibility: DancerEligibility = "bankid";
  let role: "creator" | "venue" | "customer" = "customer";
  if (user) {
    const shiftIds = shifts.map((s) => s.id);
    const [{ data: rows }, facts, { data: voucher }, { data: profile }] = await Promise.all([
      shiftIds.length
        ? db.from("taxi_signups").select("id, shift_id, status, checked_in_at").eq("dancer_id", user.id).in("shift_id", shiftIds)
        : Promise.resolve({ data: [] }),
      loadStrikeFacts(user.id, evening),
      db.from("taxi_vouchers").select("redeemed_at").eq("listing_id", id).eq("dancer_id", user.id).maybeSingle(),
      db.from("profiles").select("role, bankid_verified_at, bankid_birth_date").eq("id", user.id).single(),
    ]);
    mine = rows ?? [];
    const st = strikeStatus(facts, now);
    strikes = st.active;
    suspendedUntil = st.suspendedUntil;
    voucherAt = voucher?.redeemed_at ?? null;
    eligibility = dancerEligibility(
      { bankid_verified_at: profile?.bankid_verified_at ?? null, bankid_birth_date: profile?.bankid_birth_date ?? null },
      evening.event_date,
    );
    if (profile?.role === "creator" || profile?.role === "venue") role = profile.role;
  }
  const booked = mine.filter((m) => m.status === "booked");
  const bookedIds = new Set(booked.map((m) => m.shift_id));
  const blocked = suspendedUntil !== null;
  // Kvällens taxitak: när fyra olika taxidansare är anmälda döljs
  // taxidansarpassen för nya. Den som redan är en av dem får ta fler pass.
  const taxiShiftIds = shifts.filter((s) => s.role === "taxi_dancer").map((s) => s.id);
  const { data: taxiBooked } = taxiShiftIds.length
    ? await db.from("taxi_signups").select("dancer_id").eq("status", "booked").in("shift_id", taxiShiftIds)
    : { data: [] as { dancer_id: string }[] };
  const taxiFull = taxiEveningFull(new Set((taxiBooked ?? []).map((r) => r.dancer_id)), user?.id ?? "");
  const open = shifts.filter(
    (s) =>
      Date.parse(s.starts_at) > now.getTime() &&
      s.booked < s.capacity &&
      !bookedIds.has(s.id) &&
      !(s.role === "taxi_dancer" && taxiFull),
  );
  const anyCheckedIn = booked.some((m) => m.checked_in_at);
  const late = isLateCancel(evening.event_date, now);

  const notices = [
    "signedUp", "cancelled", "cancelledLate", "checkedIn", "voucherRedeemed", "noShift", "mustAccept",
    "notFound", "overlap", "eveningFull", "bankid", "bankidAgain", "age", "blocked", "closed", "full", "checkInClosed", "voucherNeedsCheckIn",
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
                    <p className="font-medium">{t(`roles.${s.role}`)} · {time(s.starts_at)}–{time(s.ends_at)}</p>
                    <p className="text-xs text-[var(--usha-muted)]">
                      {m.checked_in_at ? t("checkedInAt", { time: time(m.checked_in_at) }) : t("notCheckedIn")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!m.checked_in_at && canCheckIn(s, now) && (
                      <form action={checkIn}><input type="hidden" name="signupId" value={m.id} /><button className={gold}>{t("checkIn")}</button></form>
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
        ) : eligibility === "bankid" || eligibility === "bankidAgain" ? (
          <div className="rounded-xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={16} className="text-[var(--usha-gold)]" />
              {t("bankidTitle")}
            </p>
            <p className="mt-1 mb-3 text-[var(--usha-muted)]">{t(eligibility === "bankid" ? "bankidBody" : "bankidAgainBody")}</p>
            <BankIdVerifyButton role={role} label={t("bankidButton")} className={`${gold} inline-flex items-center gap-2`} next={`/app/taxi/${id}`} />
          </div>
        ) : eligibility === "age" ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{t("notice_age")}</p>
        ) : blocked ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {t("blockedBody", { date: suspendedUntil!.slice(0, 10) })}
          </p>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-[var(--usha-muted)]">{t("noShifts")}</p>
        ) : open.length === 0 ? (
          <p className="text-sm text-[var(--usha-muted)]">{t("noOpenShifts")}</p>
        ) : (
          <form action={signUpForShifts} className="space-y-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
            <input type="hidden" name="listingId" value={id} />
            <fieldset className="space-y-2">
              {taxiFull && taxiShiftIds.length > 0 && (
                <p className="mb-2 text-xs text-[var(--usha-muted)]">{t("taxiEveningFullNote", { n: TAXI_MAX_PER_EVENING })}</p>
              )}
              <legend className="mb-1 font-medium">{t("chooseShifts")}</legend>
              {open.map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input type="checkbox" name="shiftId" value={s.id} />
                  <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs text-[var(--usha-gold)]">{t(`roles.${s.role}`)}</span>
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
            </div>
            <button className={gold}>{t("signUp")}</button>
          </form>
        )}
      </section>
    </div>
  );
}
