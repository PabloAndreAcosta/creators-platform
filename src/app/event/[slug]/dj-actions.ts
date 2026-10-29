"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { loadEvening } from "@/lib/taxi/data";
import { approvalScopeKey } from "@/lib/taxi/approvals";
import { cleanDjLink, cleanDjName } from "@/lib/taxi/dj-wishes";

async function viewerOr(next: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user!;
}

/** Önska en DJ till practicorna. Samma namn i serien blir samma önskemål. */
export async function addDjWish(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const back = String(formData.get("back") ?? "/");
  const user = await viewerOr(back);
  const evening = await loadEvening(listingId);
  if (!evening?.is_practica) redirect(back);
  if (!rateLimit(`djwish:${user.id}`, 5, 60 * 60_000).allowed) redirect(`${back}?dj=tooMany`);
  const name = cleanDjName(formData.get("name"));
  if (!name) redirect(`${back}?dj=badName`);
  const db = createAdminClient();
  const scope = approvalScopeKey(evening!);
  const { data: existing } = await db.from("dj_wishes").select("id").eq("scope_key", scope).ilike("name", name!).maybeSingle();
  let wishId = existing?.id as string | undefined;
  if (!wishId) {
    const { data, error } = await db
      .from("dj_wishes")
      .insert({ scope_key: scope, name: name!, link: cleanDjLink(formData.get("link")), created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    wishId = data.id;
  }
  // Den som önskar röstar också.
  await db.from("dj_wish_votes").upsert({ wish_id: wishId, voter_id: user.id }, { onConflict: "wish_id,voter_id", ignoreDuplicates: true });
  revalidatePath(back);
  redirect(`${back}?dj=added#dj`);
}

/** En röst per person och önskemål. */
export async function voteDjWish(formData: FormData) {
  const back = String(formData.get("back") ?? "/");
  const user = await viewerOr(back);
  const wishId = String(formData.get("wishId") ?? "");
  const db = createAdminClient();
  const { data: wish } = await db.from("dj_wishes").select("id, status").eq("id", wishId).maybeSingle();
  if (!wish || wish.status === "hidden") redirect(back);
  await db.from("dj_wish_votes").upsert({ wish_id: wishId, voter_id: user.id }, { onConflict: "wish_id,voter_id", ignoreDuplicates: true });
  revalidatePath(back);
  redirect(`${back}?dj=voted#dj`);
}
