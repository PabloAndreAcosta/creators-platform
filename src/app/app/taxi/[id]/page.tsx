import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, HeartHandshake, ShieldCheck, Utensils } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_VOUCHER_MAX_ORE, voucherScopeId } from "@/lib/taxi/voucher";
import { approvalScopeKey, approvedRoles, type ApprovalStatus } from "@/lib/taxi/approvals";
import { loadEvening, loadShifts, loadStrikeFacts } from "@/lib/taxi/data";
import { canCheckIn, dancerEligibility, isLateCancel, strikeStatus, taxiEveningFull, STRIKE_LIMIT, TAXI_MAX_PER_EVENING, type DancerEligibility } from "@/lib/taxi/rules";
import { BankIdVerifyButton } from "@/app/(dashboard)/dashboard/profile/bankid-verify-button";
import { signUpForShifts, cancelShift, checkIn, redeemVoucher, applyForRole } from "../actions";
import { shiftRoleName } from "@/lib/taxi/roles";

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
  const { data: voucherSettings } = await createAdminClient()
    .from("volunteer_voucher_settings")
    .select("max_ore")
    .eq("scope_id", voucherScopeId(evening))
    .maybeSingle();
  const voucherMaxKr = Math.round((voucherSettings?.max_ore ?? DEFAULT_VOUCHER_MAX_ORE) / 100);
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
  // Ansökningar per roll i kvällens avgränsning (serien eller arrangören).
  const { data: approvalRows } = user
    ? await db
        .from("volunteer_approvals")
        .select("role, status")
        .eq("scope_key", approvalScopeKey(evening))
        .eq("volunteer_id", user.id)
    : { data: [] as { role: string; status: ApprovalStatus }[] };
  const statusOf = new Map((approvalRows ?? []).map((r) => [r.role, r.status as ApprovalStatus]));
  const approved = approvedRoles(approvalRows ?? []);
  const eveningRoles = [...new Set(shifts.map((s) => s.role))];
  const open = shifts.filter(
    (s) =>
      Date.parse(s.starts_at) > now.getTime() &&
      s.booked < s.capacity &&
      !bookedIds.has(s.id) &&
      approved.has(s.role) &&
      !(s.role === "taxi_dancer" && taxiFull),
  );
  const anyCheckedIn = booked.some((m) => m.checked_in_at);
  const late = isLateCancel(evening.event_date, now);

  const notices = [
    "signedUp", "cancelled", "cancelledLate", "checkedIn", "voucherRedeemed", "noShift", "mustAccept",
    "notFound", "overlap", "notApproved", "applicationSent", "applicationExists", "applicationDeclined", "eveningFull", "bankid", "bankidAgain", "age", "blocked", "closed", "full", "checkInClosed", "voucherNeedsCheckIn", "voucherNoCode", "voucherWrongCode", "voucherBadAmount", "voucherTooManyTries",
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
                    <p className="font-medium">{shiftRoleName(s, t)} · {time(s.starts_at)}–{time(s.ends_at)}</p>
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
            <form action={redeemVoucher} className="mt-2 space-y-2">
              <input type="hidden" name="listingId" value={id} />
              <p className="text-[var(--usha-muted)]">{t("voucherHint")}</p>
              {/* Fylls i av restaurangens personal, inte av volontären. */}
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-[var(--usha-muted)]">
                  {t("voucherAmountLabel", { max: voucherMaxKr })}
                  <input name="amount" inputMode="decimal" required defaultValue={voucherMaxKr} className="rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--usha-muted)]">
                  {t("voucherCodeLabel")}
                  <input name="code" type="password" inputMode="numeric" autoComplete="off" required maxLength={6} className="rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm" />
                </label>
              </div>
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
        ) : (
          <div className="space-y-4">
            {/* Roller kvällen har pass i. Man ansöker en gång per roll hos
                arrangören; först när ansökan är godkänd går passen att boka. */}
            <div className="space-y-2 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
              <p className="font-medium">{t("rolesTitle")}</p>
              {eveningRoles.map((r) => {
                const st = statusOf.get(r);
                return (
                  <div key={r} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--usha-border)] pt-2 first:border-t-0 first:pt-0">
                    <span>{t(`roles.${r}`)}</span>
                    {st === "approved" ? (
                      <span className="text-xs font-semibold text-green-400">{t("roleApproved")}</span>
                    ) : st === "pending" ? (
                      <span className="text-xs text-[var(--usha-muted)]">{t("rolePending")}</span>
                    ) : st === "declined" ? (
                      <span className="text-xs text-red-400">{t("roleDeclined")}</span>
                    ) : (
                      <form action={applyForRole} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <input type="hidden" name="listingId" value={id} />
                        <input type="hidden" name="role" value={r} />
                        <input
                          name="message"
                          maxLength={500}
                          placeholder={t("applyMessagePlaceholder")}
                          className="rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-1.5 text-xs"
                        />
                        <button className={`${btn} border border-[var(--usha-gold)]/50 text-[var(--usha-gold)]`}>{t("applyForRole")}</button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
            {open.length === 0 ? (
              <p className="text-sm text-[var(--usha-muted)]">{approved.size === 0 ? t("applyFirst") : t("noOpenShifts")}</p>
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
                  <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs text-[var(--usha-gold)]">{shiftRoleName(s, t)}</span>
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
          </div>
        )}
      </section>
    </div>
  );
}
