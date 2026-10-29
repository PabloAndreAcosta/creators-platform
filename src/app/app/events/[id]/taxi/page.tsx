import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, HeartHandshake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_VOUCHER_MAX_ORE, voucherScopeId } from "@/lib/taxi/voucher";
import { approvalScopeKey } from "@/lib/taxi/approvals";
import { rankWishes, DJ_WISH_GOAL } from "@/lib/taxi/dj-wishes";
import { loadDjWishes } from "@/lib/taxi/dj-wishes-data";
import { isAdminById } from "@/lib/admin/check";
import { loadEvening, loadShifts, loadStrikeFacts } from "@/lib/taxi/data";
import { isStrike, strikeStatus, TAXI_WINDOW, STRIKE_LIMIT, type StrikeStatus, TAXI_MAX_PER_EVENING } from "@/lib/taxi/rules";
import { DEFAULT_CAPACITY, ROLE_LABEL_MAX, VOLUNTEER_ROLES, shiftRoleName } from "@/lib/taxi/roles";
import { createShift, deleteShift, organiserCheck, setVoucherSettings, decideApplication, setDjWishStatus } from "./actions";

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
    db.from("taxi_vouchers").select("dancer_id, redeemed_at, amount_ore").eq("listing_id", id),
  ]);
  const dancerIds = [...new Set((signups ?? []).map((s) => s.dancer_id))];
  const { data: profiles } = dancerIds.length
    ? await db.from("profiles").select("id, full_name").in("id", dancerIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name || "–"]));
  const voucherOf = new Map((vouchers ?? []).map((v) => [v.dancer_id, v.redeemed_at]));
  const { data: voucherSettings } = await db
    .from("volunteer_voucher_settings")
    .select("code, max_ore")
    .eq("scope_id", voucherScopeId(evening))
    .maybeSingle();
  // Ansökningar i kvällens avgränsning (serien eller arrangören).
  const { data: applications } = await db
    .from("volunteer_approvals")
    .select("id, role, status, message, created_at, volunteer:profiles!volunteer_id(full_name)")
    .eq("scope_key", approvalScopeKey(evening))
    .order("created_at");
  type App = { id: string; role: string; status: string; message: string | null; volunteer: { full_name: string | null } | { full_name: string | null }[] | null };
  const appName = (a: App) => (Array.isArray(a.volunteer) ? a.volunteer[0] : a.volunteer)?.full_name || "–";
  const pendingApps = ((applications ?? []) as App[]).filter((a) => a.status === "pending");
  const approvedCount = new Map<string, number>();
  for (const a of (applications ?? []) as App[]) if (a.status === "approved") approvedCount.set(a.role, (approvedCount.get(a.role) ?? 0) + 1);
  const djWishes = evening.is_practica
    ? rankWishes((await loadDjWishes(approvalScopeKey(evening), null)).wishes)
    : [];
  const voucherTotalOre = (vouchers ?? []).reduce((a, v) => a + (v.amount_ore ?? 0), 0);
  const now = new Date();
  const strikesOf = new Map<string, StrikeStatus>();
  await Promise.all(
    dancerIds.map(async (d) => strikesOf.set(d, strikeStatus(await loadStrikeFacts(d, evening), now))),
  );

  const notices = [
    "shiftCreated", "shiftsCreatedSeries", "shiftExists", "shift_role", "shift_taxiCapacity", "voucherSaved", "djWishUpdated", "shift_djPractica", "shift_payInvalid", "applicationApproved", "applicationDeclinedOrg", "voucherCodeInvalid", "voucherMaxInvalid", "shiftDeleted", "shiftHasSignups", "checkedIn", "notFound",
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

      {/* Ansökningar: vem som helst får inte ta pass. Godkänn per roll. */}
      <section className="mt-6 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
        <p className="font-semibold">{t("applicationsTitle", { n: pendingApps.length })}</p>
        <p className="mt-1 text-xs text-[var(--usha-muted)]">
          {approvedCount.size === 0
            ? t("approvedNone")
            : [...approvedCount.entries()].map(([r, n]) => `${t(`roles.${r}`)}: ${n}`).join(" · ")}
        </p>
        {pendingApps.length > 0 && (
          <ul className="mt-3 space-y-2">
            {pendingApps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-[var(--usha-border)] pt-2">
                <div className="min-w-0">
                  <p className="font-medium">{appName(a)} <span className="font-normal text-[var(--usha-muted)]">· {t(`roles.${a.role}`)}</span></p>
                  {a.message && <p className="mt-0.5 text-xs italic text-[var(--usha-muted)]">&ldquo;{a.message}&rdquo;</p>}
                </div>
                <div className="flex gap-2">
                  {(["approve", "decline"] as const).map((d) => (
                    <form key={d} action={decideApplication}>
                      <input type="hidden" name="listingId" value={id} />
                      <input type="hidden" name="approvalId" value={a.id} />
                      <input type="hidden" name="decision" value={d} />
                      <button
                        className={
                          d === "approve"
                            ? "rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-1 text-xs font-bold text-black"
                            : "rounded-lg border border-[var(--usha-border)] px-3 py-1 text-xs"
                        }
                      >
                        {t(d === "approve" ? "approve" : "decline")}
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {evening.is_practica && (
        <section className="mt-6 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
          <p className="font-semibold">{t("djWishesOrgTitle")}</p>
          <p className="mt-1 text-xs text-[var(--usha-muted)]">{t("djWishesOrgBody", { goal: DJ_WISH_GOAL })}</p>
          {djWishes.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--usha-muted)]">{t("djWishesNone")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {djWishes.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--usha-border)] pt-2">
                  <span>
                    <span className="font-medium">{w.name}</span>{" "}
                    <span className="text-xs text-[var(--usha-muted)]">
                      {w.votes} / {DJ_WISH_GOAL} · {t(`djStatus_${w.status}`)}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    {(["booking", "booked", "hidden"] as const)
                      .filter((st) => st !== w.status)
                      .map((st) => (
                        <form key={st} action={setDjWishStatus}>
                          <input type="hidden" name="listingId" value={id} />
                          <input type="hidden" name="wishId" value={w.id} />
                          <input type="hidden" name="status" value={st} />
                          <button className="rounded-lg border border-[var(--usha-border)] px-2 py-0.5 text-[11px]">{t(`djAction_${st}`)}</button>
                        </form>
                      ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Matkupongen: restaurangkoden och taket, och kvällens summa att stämma
          av mot restaurangens nota. */}
      <section className="mt-6 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
        <p className="font-semibold">{t("voucherOrgTitle")}</p>
        <p className="mt-1 text-xs text-[var(--usha-muted)]">{t("voucherOrgBody")}</p>
        <form action={setVoucherSettings} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="listingId" value={id} />
          <label className="flex flex-col gap-1">
            {t("voucherOrgCode")}
            <input name="code" inputMode="numeric" pattern="[0-9]{4,6}" required defaultValue={voucherSettings?.code ?? ""} className={`${input} w-28 font-mono`} />
          </label>
          <label className="flex flex-col gap-1">
            {t("voucherOrgMax")}
            <input name="maxKr" inputMode="decimal" required defaultValue={Math.round((voucherSettings?.max_ore ?? DEFAULT_VOUCHER_MAX_ORE) / 100)} className={`${input} w-24`} />
          </label>
          <button className="rounded-lg border border-[var(--usha-border)] px-4 py-2 text-xs font-semibold hover:border-[var(--usha-gold)]/40">{t("voucherOrgSave")}</button>
        </form>
        {!voucherSettings && <p className="mt-2 text-xs text-red-400">{t("voucherOrgMissing")}</p>}
        <p className="mt-3 text-xs">
          {t("voucherOrgSummary", { n: (vouchers ?? []).length, total: Math.round(voucherTotalOre / 100) })}
        </p>
      </section>

      <form action={createShift} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
        <input type="hidden" name="listingId" value={id} />
        {/* En rad per roll: kryssa i de roller passet gäller och antal platser
            för var och en. Samma tider för alla — taxidansare, värd, kassa. */}
        <fieldset className="w-full">
          <legend className="mb-1">{t("rolesLegend")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {VOLUNTEER_ROLES.map((r) => (
              <label key={r} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--usha-border)] px-3 py-2">
                <span className="flex items-center gap-2">
                  <input type="checkbox" name="role" value={r} defaultChecked={r === "taxi_dancer"} />
                  {t(`roles.${r}`)}
                </span>
                <span className="flex items-center gap-1 text-xs text-[var(--usha-muted)]">
                  <input
                    type="number"
                    name={`capacity_${r}`}
                    min={1}
                    max={r === "taxi_dancer" ? 2 : 50}
                    defaultValue={DEFAULT_CAPACITY[r]}
                    className={`${input} w-16`}
                    aria-label={t("capacityFor", { role: t(`roles.${r}`) })}
                  />
                  {t("spotsShort")}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1">
          {t("payLabel")}
          <input type="number" name="payKr" min={0} max={10000} step={50} defaultValue={0} className={`${input} w-32`} />
          <span className="text-[11px] text-[var(--usha-muted)]">{t("payHint")}</span>
        </label>
        <label className="flex flex-col gap-1">
          {t("roleLabel")}
          <input type="text" name="roleLabel" maxLength={ROLE_LABEL_MAX} placeholder={t("roleLabelPlaceholder")} className={input} />
          <span className="text-[11px] text-[var(--usha-muted)]">{t("roleLabelHint")}</span>
        </label>
        <label className="flex flex-col gap-1">
          {t("start")}
          <input type="time" name="start" step={900} min={TAXI_WINDOW.from} max={TAXI_WINDOW.to} defaultValue="17:00" required className={input} />
        </label>
        <label className="flex flex-col gap-1">
          {t("end")}
          <input type="time" name="end" step={900} min={TAXI_WINDOW.from} max={TAXI_WINDOW.to} defaultValue="19:00" required className={input} />
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
                  {s.pay_ore > 0 && <span className="ml-2 text-xs text-[var(--usha-gold)]">{t("paidShiftOrg", { pay: Math.round(s.pay_ore / 100) })}</span>}
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
