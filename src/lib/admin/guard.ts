import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { adminAccessFor, hasCapability, hasAnyAdminAccess, type AdminAccess, type AdminRequirement } from "./capabilities";

/**
 * The gate every admin page and action goes through.
 *
 * Menus hide what you may not open, but hiding is tidying, not protection —
 * the URL is still typeable. This runs on the server and is the thing that
 * actually decides.
 *
 * Returns the caller's full access, so a page can hand it to the tool row
 * without asking again.
 */
export async function requireAdmin(required: AdminRequirement): Promise<AdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await adminAccessFor(user?.id);
  if (!hasCapability(access, required)) {
    redirect("/dashboard");
  }
  return access;
}

/** For the hub, which is worth opening if any one tool is. */
export async function requireAnyAdmin(): Promise<AdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await adminAccessFor(user?.id);
  if (!hasAnyAdminAccess(access)) {
    redirect("/dashboard");
  }
  return access;
}

/**
 * Same check for server actions, which must throw rather than redirect —
 * a redirect from an action is a navigation, not a refusal.
 */
export async function assertAdmin(required: AdminRequirement): Promise<AdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await adminAccessFor(user?.id);
  if (!hasCapability(access, required)) {
    throw new Error("Unauthorized");
  }
  return access;
}
