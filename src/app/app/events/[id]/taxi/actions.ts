"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminById } from "@/lib/admin/check";
import { loadEvening } from "@/lib/taxi/data";
import { validateShift } from "@/lib/taxi/rules";

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
  const v = validateShift({
    eventDate: evening.event_date,
    startTime: String(formData.get("start") ?? ""),
    endTime: String(formData.get("end") ?? ""),
    capacity: Number(formData.get("capacity")),
  });
  if (!v.ok) page(listingId, `shift_${v.error}`);
  if (v.ok) {
    const { error } = await createAdminClient().from("taxi_shifts").insert({
      listing_id: listingId,
      starts_at: v.startsAt,
      ends_at: v.endsAt,
      capacity: Number(formData.get("capacity")),
      created_by: user.id,
    });
    if (error) throw error;
  }
  revalidatePath(`/app/events/${listingId}/taxi`);
  page(listingId, "shiftCreated");
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
