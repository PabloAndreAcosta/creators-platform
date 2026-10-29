"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminById } from "@/lib/admin/check";
import { loadEvening } from "@/lib/taxi/data";
import { validateShift } from "@/lib/taxi/rules";
import { parseRoleLabel, parseVolunteerRole, type VolunteerRole } from "@/lib/taxi/roles";
import { isCancelled } from "@/lib/entrance/door-link";
import { stockholmToday } from "@/lib/time";

/** Arrangören (kvällens ägare) eller hel admin. */
async function assertOrganiser(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const evening = await loadEvening(listingId);
  if (!evening) redirect("/app/events");
  if (evening!.user_id !== user!.id && !(await isAdminById(user!.id))) redirect("/app/events");
  return { user: user!, evening: evening! };
}

const page = (listingId: string, notice: string) => redirect(`/app/events/${listingId}/taxi?notice=${notice}`);

export async function createShift(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const { user, evening } = await assertOrganiser(listingId);
  // Flera roller på samma tider i ett svep — taxidansare, värd och kassa får
  // samma pass. Varje roll har sitt eget antal platser.
  const roles = [...new Set(formData.getAll("role").map(parseVolunteerRole).filter((r): r is VolunteerRole => !!r))];
  if (roles.length === 0) page(listingId, "shift_role");
  // Eget namn gäller bara när ett pass för en enda roll läggs upp.
  const roleLabel = roles.length === 1 ? parseRoleLabel(formData.get("roleLabel")) : null;
  const startTime = String(formData.get("start") ?? "");
  const endTime = String(formData.get("end") ?? "");
  const capacityOf = (r: VolunteerRole) => Number(formData.get(`capacity_${r}`) ?? formData.get("capacity"));
  for (const r of roles) {
    const v = validateShift({ eventDate: evening.event_date, startTime, endTime, capacity: capacityOf(r), role: r });
    if (!v.ok) page(listingId, `shift_${v.error}`);
  }

  // Samma pass på seriens alla kommande kvällar, så The Lab inte behöver
  // läggas upp kväll för kväll. Bara kvällens ägares egna, ej inställda
  // kvällar, och en kväll som redan har exakt det passet hoppas över.
  const evenings: { id: string; event_date: string }[] = [{ id: listingId, event_date: evening.event_date }];
  const db = createAdminClient();
  if (formData.get("wholeSeries") === "on" && evening.series_id) {
    const { data: siblings } = await db
      .from("listings")
      .select("id, title, event_date")
      .eq("series_id", evening.series_id)
      .eq("user_id", evening.user_id)
      .neq("id", listingId)
      .gte("event_date", stockholmToday());
    for (const l of siblings ?? []) {
      if (l.event_date && !isCancelled(l.title)) evenings.push({ id: l.id, event_date: String(l.event_date).slice(0, 10) });
    }
  }

  const rows = [];
  for (const e of evenings) {
    for (const role of roles) {
      const capacity = capacityOf(role);
      const r = validateShift({ eventDate: e.event_date, startTime, endTime, capacity, role });
      if (!r.ok) continue;
      const dup = db
        .from("taxi_shifts")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", e.id)
        .eq("role", role)
        .eq("starts_at", r.startsAt)
        .eq("ends_at", r.endsAt);
      const { count } = await (roleLabel ? dup.eq("role_label", roleLabel) : dup.is("role_label", null));
      if ((count ?? 0) > 0) continue;
      rows.push({ listing_id: e.id, starts_at: r.startsAt, ends_at: r.endsAt, capacity, role, role_label: roleLabel, created_by: user.id });
    }
  }
  if (rows.length > 0) {
    const { error } = await db.from("taxi_shifts").insert(rows);
    if (error) throw error;
  }
  for (const e of evenings) revalidatePath(`/app/events/${e.id}/taxi`);
  revalidatePath("/app/taxi");
  page(listingId, rows.length > 1 ? "shiftsCreatedSeries" : rows.length === 1 ? "shiftCreated" : "shiftExists");
}

/** Ett pass med anmälningar tas inte bort — det vore att stryka någons åtagande tyst. */
export async function deleteShift(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  await assertOrganiser(listingId);
  const db = createAdminClient();
  const shiftId = String(formData.get("shiftId"));
  const { count } = await db
    .from("taxi_signups")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId)
    .eq("status", "booked");
  if ((count ?? 0) > 0) page(listingId, "shiftHasSignups");
  await db.from("taxi_shifts").delete().eq("id", shiftId).eq("listing_id", listingId);
  revalidatePath(`/app/events/${listingId}/taxi`);
  page(listingId, "shiftDeleted");
}

/** Arrangören kan checka in åt en dansare, t.ex. om telefonen dog. */
export async function organiserCheck(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  await assertOrganiser(listingId);
  const db = createAdminClient();
  const signupId = String(formData.get("signupId"));
  const { data: s } = await db
    .from("taxi_signups")
    .select("id, shift:taxi_shifts!inner(listing_id)")
    .eq("id", signupId)
    .eq("shift.listing_id", listingId)
    .maybeSingle();
  if (!s) page(listingId, "notFound");
  const now = new Date().toISOString();
  await db.from("taxi_signups").update({ checked_in_at: now }).eq("id", signupId).is("checked_in_at", null);
  revalidatePath(`/app/events/${listingId}/taxi`);
  page(listingId, "checkedIn");
}
