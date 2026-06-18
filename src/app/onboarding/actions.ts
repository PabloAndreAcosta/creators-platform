"use server";

/**
 * Onboarding persistence — wires the router to the real ob_* tables.
 *
 * Behind the §9 gate: these actions persist ONBOARDING DATA only (BankID flag,
 * chosen track, profile fields). They never move money — real payments stay off
 * (config.PAYMENTS_LIVE = false) until the §9 legal sign-off. BankID is still
 * mocked at this stage. All writes go through the authenticated server client,
 * so RLS confines every row to the logged-in user.
 */

import { createClient } from "@/lib/supabase/server";
import { mockBankId, mockFskatt } from "@/lib/onboarding/adapters";
import { checkBankIdGate, switchTrack } from "@/lib/onboarding/guards";
import { isCreatorTrack, isVenueTrack, type Track } from "@/lib/onboarding/types";

export interface OnboardingFields {
  org_no?: string;
  bank_account?: string;
}

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/** Mock BankID verification, persisted to ob_users (G1 is satisfied by this). */
export async function verifyBankId(): Promise<ActionResult<{ name: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du måste vara inloggad för att spara." };

  const id = await mockBankId.authenticate(); // MOCK — real BankID gated to §9 era
  const { error } = await supabase.from("ob_users").upsert({
    id: user.id,
    bankid_verified: true,
    name: id.name,
    personal_no: id.personalNo,
    email: user.email,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { name: id.name } };
}

/** Persists the resolved track + fields. Enforces G1 (BankID) and G5 (track switch). */
export async function completeOnboarding(input: {
  track: Track;
  fields: OnboardingFields;
}): Promise<ActionResult<{ track: Track; fskatt_status?: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du måste vara inloggad för att spara." };

  // G1 — no profile without a verified BankID.
  const { data: obUser } = await supabase
    .from("ob_users")
    .select("bankid_verified")
    .eq("id", user.id)
    .maybeSingle();
  const g1 = checkBankIdGate({ bankid_verified: !!obUser?.bankid_verified });
  if (!g1.allowed) return { ok: false, error: g1.reason ?? "BankID krävs." };

  const { track, fields } = input;

  if (isCreatorTrack(track)) {
    // G5 — record a track switch (history preserved).
    const { data: existing } = await supabase
      .from("ob_creator_profiles")
      .select("track")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      const { change } = switchTrack(existing.track as Track, track, new Date().toISOString());
      if (change) {
        await supabase.from("ob_track_changes").insert({
          user_id: user.id,
          from_track: change.from,
          to_track: change.to,
        });
      }
    }

    // C1 — verify F-skatt at onboarding (mock). G2 will re-check before payout.
    let fskatt_status = "unknown";
    let fskatt_checked_at: string | null = null;
    if (track === "C1" && fields.org_no) {
      const res = await mockFskatt.check(fields.org_no);
      fskatt_status = res.status;
      fskatt_checked_at = res.checkedAt;
    }

    const { error } = await supabase.from("ob_creator_profiles").upsert({
      user_id: user.id,
      track,
      org_no: fields.org_no || null,
      fskatt_status,
      fskatt_checked_at,
      bank_account: fields.bank_account || null,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { track, fskatt_status } };
  }

  if (isVenueTrack(track)) {
    if (!fields.org_no) return { ok: false, error: "Organisationsnummer krävs för venue." };
    const { data: existing } = await supabase
      .from("ob_venue_profiles")
      .select("type")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      const { change } = switchTrack(existing.type as Track, track, new Date().toISOString());
      if (change) {
        await supabase.from("ob_track_changes").insert({
          user_id: user.id,
          from_track: change.from,
          to_track: change.to,
        });
      }
    }
    const { error } = await supabase.from("ob_venue_profiles").upsert({
      user_id: user.id,
      type: track,
      org_no: fields.org_no,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { track } };
  }

  return { ok: false, error: "Ogiltigt spår." };
}
