"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadEvening, loadShifts, loadStrikeFacts } from "@/lib/taxi/data";
import { canCheckIn, dancerEligibility, isLateCancel, overlaps, strikeStatus, taxiEveningFull } from "@/lib/taxi/rules";

const back = (listingId: string, notice: string) => redirect(`/app/taxi/${listingId}?notice=${notice}`);

async function viewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Anmälan till ett eller flera pass. Kräver Mobilt BankID och 18 år.
 * Volontärvillkoren och reglerna måste bekräftas; samtycke till bilder är ett
 * eget val.
 */
export async function signUpForShifts(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const user = await viewer();
  if (!user) redirect(`/login?next=/app/taxi/${listingId}`);

  const shiftIds = formData.getAll("shiftId").map(String).filter(Boolean);
  const volunteer = formData.get("volunteer") === "on";
  const rules = formData.get("rules") === "on";
  const photoConsent = formData.get("photo") === "yes";
  if (shiftIds.length === 0) back(listingId, "noShift");
  if (!volunteer || !rules) back(listingId, "mustAccept");

  const evening = await loadEvening(listingId);
  if (!evening) back(listingId, "notFound");

  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("bankid_verified_at, bankid_birth_date")
    .eq("id", user.id)
    .single();
  // Mobilt BankID och 18 år, ur BankID-födelsedatumet. Ingen egen försäkran.
  const eligibility = dancerEligibility(
    { bankid_verified_at: profile?.bankid_verified_at ?? null, bankid_birth_date: profile?.bankid_birth_date ?? null },
    evening!.event_date,
  );
  if (eligibility !== "ok") back(listingId, eligibility);

  if (strikeStatus(await loadStrikeFacts(user.id, evening!), new Date()).suspendedUntil) back(listingId, "blocked");

  const shifts = await loadShifts(listingId);
  const now = Date.now();
  for (const id of shiftIds) {
    const s = shifts.find((x) => x.id === id);
    if (!s || Date.parse(s.starts_at) <= now) back(listingId, "closed");
    if (s!.booked >= s!.capacity) back(listingId, "full");
  }

  // Kvällens taxitak: högst fyra olika taxidansare, oavsett pass.
  if (shifts.some((x) => shiftIds.includes(x.id) && x.kind === "taxi")) {
    const taxiIds = shifts.filter((x) => x.kind === "taxi").map((x) => x.id);
    const { data: taxiBooked } = await db
      .from("taxi_signups")
      .select("dancer_id")
      .eq("status", "booked")
      .in("shift_id", taxiIds);
    if (taxiEveningFull(new Set((taxiBooked ?? []).map((r) => r.dancer_id)), user.id)) back(listingId, "eveningFull");
  }

  // Ingen kan vara på två pass samtidigt — t.ex. taxi och instruktör 17–19.
  const { data: mineBooked } = await db
    .from("taxi_signups")
    .select("shift_id")
    .eq("dancer_id", user.id)
    .eq("status", "booked")
    .in("shift_id", shifts.map((x) => x.id));
  const chosen = shifts.filter((x) => shiftIds.includes(x.id) || (mineBooked ?? []).some((m) => m.shift_id === x.id));
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      if (overlaps(chosen[i], chosen[j])) back(listingId, "overlap");
    }
  }

  const ackAt = new Date().toISOString();
  for (const id of shiftIds) {
    // En tidigare avbokad anmälan till samma pass återupplivas i stället för
    // att krocka med unik-nyckeln. Varningen från en sen avbokning ligger kvar.
    const { data: existing } = await db
      .from("taxi_signups")
      .select("id, status")
      .eq("shift_id", id)
      .eq("dancer_id", user.id)
      .maybeSingle();
    if (existing?.status === "booked") continue;
    if (existing) {
      await db
        .from("taxi_signups")
        .update({ status: "booked", cancelled_at: null, photo_consent: photoConsent, volunteer_ack_at: ackAt })
        .eq("id", existing.id);
    } else {
      const { error } = await db.from("taxi_signups").insert({
        shift_id: id,
        dancer_id: user.id,
        photo_consent: photoConsent,
        volunteer_ack_at: ackAt,
      });
      if (error) throw error;
    }
  }
  revalidatePath(`/app/taxi/${listingId}`);
  back(listingId, "signedUp");
}

async function ownSignup(signupId: string, userId: string) {
  const { data } = await createAdminClient()
    .from("taxi_signups")
    .select("id, dancer_id, status, late_cancel, checked_in_at, shift:taxi_shifts(id, listing_id, starts_at, ends_at)")
    .eq("id", signupId)
    .maybeSingle();
  type Row = {
    id: string;
    dancer_id: string;
    status: string;
    checked_in_at: string | null;
    shift: { id: string; listing_id: string; starts_at: string; ends_at: string };
  };
  const row = data as unknown as Row | null;
  return row && row.dancer_id === userId ? row : null;
}

/** Avbokning. Efter kl. 10 samma dag blir den en varning. */
export async function cancelShift(formData: FormData) {
  const user = await viewer();
  if (!user) redirect("/login");
  const s = await ownSignup(String(formData.get("signupId")), user.id);
  if (!s || s.status !== "booked") redirect("/app/taxi");
  const evening = await loadEvening(s!.shift.listing_id);
  const late = isLateCancel(evening!.event_date, new Date());
  await createAdminClient()
    .from("taxi_signups")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), late_cancel: late })
    .eq("id", s!.id);
  revalidatePath(`/app/taxi/${s!.shift.listing_id}`);
  back(s!.shift.listing_id, late ? "cancelledLate" : "cancelled");
}

export async function checkIn(formData: FormData) {
  const user = await viewer();
  if (!user) redirect("/login");
  const s = await ownSignup(String(formData.get("signupId")), user.id);
  if (!s || s.status !== "booked" || s.checked_in_at) redirect("/app/taxi");
  if (!canCheckIn(s!.shift, new Date())) back(s!.shift.listing_id, "checkInClosed");
  await createAdminClient().from("taxi_signups").update({ checked_in_at: new Date().toISOString() }).eq("id", s!.id);
  revalidatePath(`/app/taxi/${s!.shift.listing_id}`);
  back(s!.shift.listing_id, "checkedIn");
}

/**
 * Matkupongen löses in i baren: dansaren visar skärmen, personalen trycker.
 * En per kväll, och bara för den som checkat in på något pass den kvällen.
 */
export async function redeemVoucher(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const user = await viewer();
  if (!user) redirect("/login");
  const db = createAdminClient();
  const { data: checkedIn } = await db
    .from("taxi_signups")
    .select("id, shift:taxi_shifts!inner(listing_id)")
    .eq("dancer_id", user.id)
    .eq("shift.listing_id", listingId)
    .not("checked_in_at", "is", null)
    .limit(1);
  if (!checkedIn?.length) back(listingId, "voucherNeedsCheckIn");
  const { error } = await db.from("taxi_vouchers").insert({ listing_id: listingId, dancer_id: user.id });
  if (error && error.code !== "23505") throw error;
  revalidatePath(`/app/taxi/${listingId}`);
  back(listingId, "voucherRedeemed");
}
