"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/admin/guard";
import { isAdminCapability } from "@/lib/admin/capabilities";
import { isAdminById } from "@/lib/admin/check";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const PAGE = "/dashboard/admin/access";

/**
 * Grant or revoke one slice of the admin surface.
 *
 * Requires full admin, never a capability: someone who can widen their own
 * grant is not actually limited by it. `assertAdmin("full")` is what enforces
 * that — the menu merely doesn't show the tool.
 */
export async function setAdminCapability(formData: FormData) {
  await assertAdmin("full");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = (formData.get("userId") as string)?.trim();
  const capability = (formData.get("capability") as string)?.trim();
  const grant = formData.get("grant") === "true";
  const email = (formData.get("email") as string)?.trim() ?? "";

  const back = (status: string) =>
    redirect(`${PAGE}?email=${encodeURIComponent(email)}&status=${status}`);

  if (!userId || !isAdminCapability(capability)) {
    back("invalid");
    return;
  }

  // A full admin already holds everything; a row for them would be a lie the
  // next reader has to decode. Say so instead of writing it.
  if (await isAdminById(userId)) {
    back("already_full");
    return;
  }

  const admin = createAdminClient();
  const { error } = grant
    ? await admin
        .from("admin_capabilities")
        .upsert(
          { user_id: userId, capability, granted_by: user?.id ?? null },
          { onConflict: "user_id,capability" }
        )
    : await admin
        .from("admin_capabilities")
        .delete()
        .eq("user_id", userId)
        .eq("capability", capability);

  if (error) {
    console.error("setAdminCapability failed:", error);
    back("error");
    return;
  }

  revalidatePath(PAGE);
  back(grant ? "granted" : "revoked");
}
