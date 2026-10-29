import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, HeartHandshake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminById } from "@/lib/admin/check";
import { loadEvening, loadShifts, loadStrikeFacts } from "@/lib/taxi/data";
import { isStrike, strikeStatus, TAXI_WINDOW, STRIKE_LIMIT, type StrikeStatus, TAXI_MAX_PER_EVENING } from "@/lib/taxi/rules";
import { ROLE_LABEL_MAX, VOLUNTEER_ROLES, shiftRoleName } from "@/lib/taxi/roles";
import { createShift, deleteShift, organiserCheck } from "./actions";

export const dynamic = "force-dynamic";

const time = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * Arrangörens vy av taxipassen en kväll: lägga upp pass, se vem som anmält
 * sig, vem som checkat in och ut, vem som fullföljt, samtycke till bilder,
 * matkupongen och varningar.
 */
export default async function EventTaxiPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await props.params;
  const { notice } = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/events/${id}/taxi`);
  const evening = await loadEvening(id);
  if (!evening) notFound();
  if (evening.user_id !== user.id && !(await isAdminById(user.id))) notFound();

  const t = await getTranslations("taxiPass");
  const db = createAdminClient();
  const shifts = await loadShifts(id);
  const shiftIds = shifts.map((s) => s.id);
  const [{ data: signups }, { data: vouchers }] = await Promise.all([
    shiftIds.length
      ? db
          .from("taxi_signups")
          .select("id, shift_id, dancer_id, status, late_cancel, cancelled_at, checked_in_at, photo_consent")
          .in("shift_id", shiftIds)
          .order("created_at")
      : Promise.resolve({ data: [] as never[] }),
    db.from("taxi_vouchers").select("dancer_id, redeemed_at").eq("listing_id", id),
  ]);
  const dancerIds = [...new Set((signups ?? []).map((s) => s.dancer_id))];
  const { data: profiles } = dancerIds.length
    ? await db.from("profiles").select("id, full_name").in("id", dancerIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name || "–"]));
  const voucherOf = new Map((vouchers ?? []).map((v) => [v.dancer_id, v.redeemed_at]));
  const now = new Date();
  const strikesOf = new Map<string, StrikeStatus>();
  await Promise.all(
    dancerIds.map(async (d) => strikesOf.set(d, strikeStatus(await loadStrikeFacts(d, evening), now))),
  );

  const notices = [
    "shiftCreated", "shiftsCreatedSeries", "shiftExists", "shift_role", "shift_taxiCapacity", "shiftDeleted", "shiftHasSignups", "checkedIn", "notFound",
    "shift_time", "shift_window", "shift_length", "shift_capacity",
  ];
  const btn = "rounded-lg px-2.5 py-1 text-xs font-semibold";
  const input = "rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-1.5 text-sm";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <Link href="/app/events" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]">
        <ChevronLeft size={14} />
        {t("backToEvents")}
      </Link>
      <h1 className="text-2xl font-bold">{t("organiserTitle", { title: evening.title })}</h1>
      <p className="mt-1 text-sm text-[var(--usha-muted)]">{evening.event_date}</p>

      {notice && notices.includes(notice) && (
        <div className="mt-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm font-medium">
          {t(`notice_${notice}`)}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <HeartHandshake size={16} className="text-[var(--usha-gold)]" />
          {t("organiserVolunteerTitle")}
        </p>
        <p className="mt-1 text-[var(--usha-muted)]">{t("organiserVolunteerBody")}</p>
        <p className="mt-2 text-[var(--usha-muted)]">
          {t("taxiEveningCount", {
            n: new Set(
              (signups ?? [])
                .filter((x) => x.status === "booked" && shifts.find((sh) => sh.id === x.shift_id)?.role === "taxi_dancer")
                .map((x) => x.dancer_id),
            ).size,
            max: TAXI_MAX_PER_EVENING,
          })}
        </p>
        <p className="mt-2 text-[var(--usha-muted)]">
          {t("shareLink")} <span className="font-mono text-[var(--usha-white)]">usha.se/app/taxi/{id}</span>
        </p>
      </div>

      <form action={createShift} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
        <input type="hidden" name="listingId" value={id} />
        <label className="flex flex-col gap-1">
          {t("role")}
          <select name="role" defaultValue="taxi_dancer" className={input}>
            {VOLUNTEER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t("roleLabel")}
          <input type="text" name="roleLabel" maxLength={ROLE_LABEL_MAX} placeholder={t("roleLabelPlaceholder")} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          {t("start")}
          <input type="time" name="start" step={900} min={TAXI_WINDOW.from} max={TAXI_WINDOW.to} defaultValue="17:00" required className={input} />
        </label>
        <label className="flex flex-col gap-1">
          {t("end")}
          <input type="time" name="end" step={900} min={TAXI_WINDOW.from} max={TAXI_WINDOW.to} defaultValue="19:00" required className={input} />
        </label>
        <label className="flex flex-col gap-1">
          {t("capacity")}
          <input type="number" name="capacity" min={1} max={50} defaultValue={4} required className={`${input} w-20`} />
        </label>
        <button className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black">
          {t("addShift")}
        </button>
        {evening.series_id && (
          <label className="flex w-full items-center gap-2 text-xs">
            <input type="checkbox" name="wholeSeries" defaultChecked />
            {t("wholeSeries")}
          </label>
        )}
        <p className="w-full text-xs text-[var(--usha-muted)]">{t("shiftHint")}</p>
      </form>

      <div className="mt-6 space-y-4">
        {shifts.length === 0 && <p className="text-sm text-[var(--usha-muted)]">{t("organiserNoShifts")}</p>}
        {shifts.map((s) => {
          const rows = (signups ?? []).filter((x) => x.shift_id === s.id);
          return (
            <section key={s.id} className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">
                  <span className="mr-2 rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs text-[var(--usha-gold)]">{shiftRoleName(s, t)}</span>
                  {time(s.starts_at)}–{time(s.ends_at)}
                  <span className="ml-2 font-normal text-[var(--usha-muted)]">{t("bookedOf", { n: s.booked, cap: s.capacity })}</span>
                </p>
                {s.booked === 0 && (
                  <form action={deleteShift}>
                    <input type="hidden" name="listingId" value={id} />
                    <input type="hidden" name="shiftId" value={s.id} />
                    <button className="text-xs text-red-400 underline">{t("deleteShift")}</button>
                  </form>
                )}
              </div>
              {rows.length === 0 ? (
                <p className="text-xs text-[var(--usha-muted)]">{t("noSignups")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left uppercase tracking-wider text-[var(--usha-muted)]">
                      <tr>
                        <th className="py-1 pr-3">{t("colDancer")}</th>
                        <th className="py-1 pr-3">{t("colIn")}</th>
                        <th className="py-1 pr-3">{t("colStatus")}</th>
                        <th className="py-1 pr-3">{t("colPhoto")}</th>
                        <th className="py-1 pr-3">{t("colVoucher")}</th>
                        <th className="py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const status =
                          r.status === "cancelled"
                            ? r.late_cancel ? t("stLateCancel") : t("stCancelled")
                            : isStrike({ ...r, status: "booked", ends_at: s.ends_at }, now)
                              ? t("stNoShow")
                              : r.checked_in_at ? t("stCheckedIn") : t("stBooked");
                        const st = strikesOf.get(r.dancer_id);
                        return (
                          <tr key={r.id} className="border-t border-[var(--usha-border)]">
                            <td className="py-1.5 pr-3">
                              {nameOf.get(r.dancer_id)}
                              {st?.suspendedUntil ? (
                                <span className="ml-1 text-red-400">({t("suspendedShort", { date: st.suspendedUntil.slice(0, 10) })})</span>
                              ) : st && st.active > 0 ? (
                                <span className="ml-1 text-red-400">({t("strikesShort", { n: st.active, limit: STRIKE_LIMIT })})</span>
                              ) : null}
                            </td>
                            <td className="py-1.5 pr-3 tabular-nums">{r.checked_in_at ? time(r.checked_in_at) : "–"}</td>
                            <td className="py-1.5 pr-3">{status}</td>
                            <td className="py-1.5 pr-3">{r.photo_consent ? t("photoOk") : t("photoNoShort")}</td>
                            <td className="py-1.5 pr-3">{voucherOf.get(r.dancer_id) ? time(voucherOf.get(r.dancer_id)!) : "–"}</td>
                            <td className="py-1.5 whitespace-nowrap text-right">
                              {r.status === "booked" && !r.checked_in_at && (
                                <form action={organiserCheck} className="inline">
                                  <input type="hidden" name="listingId" value={id} />
                                  <input type="hidden" name="signupId" value={r.id} />
                                  <button className={`${btn} border border-[var(--usha-border)]`}>{t("checkIn")}</button>
                                </form>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
