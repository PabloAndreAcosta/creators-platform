import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BETA_MODE } from "@/lib/beta";
import { userIsPremium } from "@/lib/matching/access";

/**
 * Avtal: regler och uppslag som API:t och sidorna delar.
 *
 * Vem får göra vad:
 * - SKRIVA avtal: Premium (eller betan). Det är en Premium-funktion.
 * - SIGNERA: båda parter måste ha BankID-verifierat konto — det är vad som
 *   gör den enkla e-signaturen värd något. Motparten behöver inte Premium.
 * - ÄNDRA: bara utkast, bara den som skrev det.
 *
 * Innehållet låses med ett sha256-fingeravtryck när avtalet skickas. Samma
 * fingeravtryck räknas om vid signering; stämmer det inte har texten ändrats
 * och signeringen nekas.
 */
import { TEMPLATE_KEYS, fillTemplate, type TemplateKey } from "./templates";
export { TEMPLATE_KEYS, fillTemplate, type TemplateKey };

export type AgreementStatus = "draft" | "sent" | "signed" | "declined" | "withdrawn";

export interface AgreementRow {
  id: string;
  created_by: string;
  counterparty_id: string;
  listing_id: string | null;
  template_key: TemplateKey;
  title: string;
  body: string;
  status: AgreementStatus;
  content_hash: string | null;
  sent_at: string | null;
  creator_signed_at: string | null;
  creator_sign_name: string | null;
  counterparty_signed_at: string | null;
  counterparty_sign_name: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartyProfile {
  id: string;
  full_name: string | null;
  bankid_name: string | null;
  bankid_verified: boolean | null;
  email: string | null;
  locale: string | null;
  avatar_url: string | null;
}

export const PARTY_COLUMNS = "id, full_name, bankid_name, bankid_verified, email, locale, avatar_url";

export const TITLE_MAX = 120;
export const BODY_MAX = 20000;

export function contentHash(title: string, body: string): string {
  return createHash("sha256").update(`${title.trim()}\n${body.trim()}`, "utf8").digest("hex");
}

/** Namnet som står under signaturen: BankID-namnet, annars profilnamnet. */
export function signatureName(p: PartyProfile | null | undefined): string {
  return (p?.bankid_name || p?.full_name || "").trim();
}

/**
 * Får signera: BankID-verifierat konto OCH ett BankID-namn. Profilnamnet är
 * fritt redigerbart och duger därför inte som signatur – då vore beviset
 * svagare än sidan påstår.
 */
export function canSign(p: PartyProfile | null | undefined): boolean {
  return !!p?.bankid_verified && !!p?.bankid_name?.trim();
}

export async function canWriteAgreements(admin: SupabaseClient, userId: string): Promise<boolean> {
  if (BETA_MODE) return true;
  return userIsPremium(admin, userId);
}

export function isParty(a: Pick<AgreementRow, "created_by" | "counterparty_id">, userId: string): boolean {
  return a.created_by === userId || a.counterparty_id === userId;
}

export async function loadParties(
  admin: SupabaseClient,
  a: Pick<AgreementRow, "created_by" | "counterparty_id">
): Promise<{ creator: PartyProfile | null; counterparty: PartyProfile | null }> {
  const { data } = await admin.from("profiles").select(PARTY_COLUMNS).in("id", [a.created_by, a.counterparty_id]);
  const rows = (data ?? []) as PartyProfile[];
  return {
    creator: rows.find((p) => p.id === a.created_by) ?? null,
    counterparty: rows.find((p) => p.id === a.counterparty_id) ?? null,
  };
}

export async function logEvent(
  admin: SupabaseClient,
  agreementId: string,
  actorId: string | null,
  kind: "created" | "edited" | "sent" | "signed" | "declined" | "withdrawn" | "viewed",
  detail: Record<string, unknown> = {}
): Promise<void> {
  await admin.from("agreement_events").insert({ agreement_id: agreementId, actor_id: actorId, kind, detail });
}
