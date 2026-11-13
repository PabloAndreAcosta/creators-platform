import { NextResponse } from "next/server";

/**
 * Nycklar (tokens för att låsa upp verktyg per event) säljs inte längre.
 * Sedan en nivå (2026-11-13) ingår allt, så det finns inget att låsa upp.
 * Routen ligger kvar så att en gammal klient får ett tydligt svar i stället
 * för 404. Saldon i token_ledger rörs inte.
 */
export async function POST() {
  return NextResponse.json(
    { error: "tokens_retired", message: "Nycklar säljs inte längre – allt ingår." },
    { status: 410 },
  );
}
