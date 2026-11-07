import { hashPersonalNumber } from "@/lib/signicat/crypto";

/**
 * E-legitimationer som Usha tar emot via Signicat.
 *
 *  - "sbid":  svenskt Mobilt BankID.
 *  - "freja": Freja eID. Svenskar har personnummer där också; den som saknar
 *             svenskt personnummer kan registrera sig med biometriskt pass
 *             (bl.a. Grekland). Byggt 2026-11-07 för kreatörer som bor utomlands.
 */
export type IdMethod = "sbid" | "freja";

export function parseIdMethod(value: unknown): IdMethod {
  return value === "freja" ? "freja" : "sbid";
}

/** Är Freja påslaget? Kräver att Freja är aktiverat i Signicat-kontot. */
export function frejaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FREJA_ENABLED === "true";
}

interface Subject {
  id?: string | null;
  nin?: { value?: string | null; issuingCountry?: string | null } | null;
}

/**
 * Nyckeln som binder en person till ett konto, lagrad hashad i
 * profiles.bankid_personal_number.
 *
 * Svenskt personnummer hashas som förut – samma person med BankID och Freja
 * hamnar därför på samma konto. Ett utländskt ID-nummer får landskoden
 * framför sig så att två länders nummer aldrig kan krocka. Saknas ID-nummer
 * helt (Freja med pass utan nationellt nummer) används Signicats stabila
 * användar-id för just den e-legitimationen.
 */
export function identityKey(subject: Subject, method: IdMethod): string | null {
  const value = subject.nin?.value?.trim();
  if (value) {
    const country = (subject.nin?.issuingCountry ?? "SE").toUpperCase();
    return country === "SE" ? hashPersonalNumber(value) : hashPersonalNumber(`${country}:${value}`);
  }
  const id = subject.id?.trim();
  if (id) return hashPersonalNumber(`${method}:${id}`);
  return null;
}
