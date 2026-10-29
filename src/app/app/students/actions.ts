"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Säljarens privata anteckning om en elev. Tom anteckning tas bort. */
export async function saveStudentNote(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const key = String(formData.get("studentKey") ?? "");
  if (!/^(customer|guest):.{1,310}$/.test(key)) return;
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);

  // Bara någon som faktiskt köpt av säljaren kan få en anteckning.
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  const sold = supabase.from("bookings").select("id", { count: "exact", head: true }).eq("creator_id", user.id);
  const { count } = await (kind === "customer" ? sold.eq("customer_id", id) : sold.ilike("guest_email", id));
  if (!count) return;

  if (note) {
    await supabase
      .from("student_notes")
      .upsert({ owner_id: user.id, student_key: key, note, updated_at: new Date().toISOString() });
  } else {
    await supabase.from("student_notes").delete().eq("owner_id", user.id).eq("student_key", key);
  }
  revalidatePath("/app/students");
}
