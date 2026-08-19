"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/admin/guard";
import { canChangeAdminLevel, isAdminCapability } from "@/lib/admin/capabilities";
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

/**
 * Move someone between full admin and limited admin.
 *
 * Without this the page could only ever say "this account is a full admin" and
 * stop — the only way to actually limit them was hand-written SQL, which is the
 * friction this tool exists to remove.
 *
 * You cannot do it to yourself. A full admin who demotes themselves may be the
 * last one, and then nobody can grant anything ever again; the recovery is a
 * database console, which is not a place a mis-click should send you.
 */
export async function setAdminFull(formData: FormData) {
  await assertAdmin("full");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = (formData.get("userId") as string)?.trim();
  const full = formData.get("full") === "true";
  const email = (formData.get("email") as string)?.trim() ?? "";

  const back = (status: string) =>
    redirect(`${PAGE}?email=${encodeURIComponent(email)}&status=${status}`);

  if (!userId) {
    back("invalid");
    return;
  }
  if (!canChangeAdminLevel(user?.id, userId)) {
    back("not_yourself");
    return;
  }

  const admin = createAdminClient();
  // Service role: is_admin is a protected column and user-context updates to it
  // are reverted by protect_profile_privileged_columns.
  const { error } = await admin.from("profiles").update({ is_admin: full }).eq("id", userId);

  if (error) {
    console.error("setAdminFull failed:", error);
    back("error");
    return;
  }

  // Going full makes any capability rows redundant — a full admin holds
  // everything — and leaving them behind would misread as a limit next time.
  if (full) {
    await admin.from("admin_capabilities").delete().eq("user_id", userId);
  }

  revalidatePath(PAGE);
  back(full ? "made_full" : "made_limited");
}
