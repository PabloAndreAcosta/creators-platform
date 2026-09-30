/**
 * Vilka som får ett utskick till en kreatörs egna följare.
 *
 * VARFÖR BARA MEJLFÖLJARE. Det finns två sorters följare. `email_follows` är
 * någon som skrivit in sin adress för att höra från just den här kreatören och
 * sedan bekräftat den i ett mejl — ett uttryckligt ja, till en namngiven
 * avsändare. `follows` är ett konto som tryckt följ i appen; det är ett ja till
 * att se saker i flödet och få notiser, inte ett ja till mejl.
 *
 * Att slå ihop dem hade gett fler mottagare och sämre samtycke. Tystnad är
 * inget ja, och ett följ-klick är inte en prenumeration på utskick. Kontot som
 * följer får sina notiser i appen som förut.
 *
 * Varje mottagare bär sin egen avregistreringslänk. Den som avregistrerat sig
 * eller aldrig bekräftat är aldrig med.
 */

export interface FollowerRow {
  email: string | null;
  locale?: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_token: string | null;
}

export interface Mottagare {
  email: string;
  locale: string | null;
  unsubscribeToken: string;
}

/**
 * Filtrerar och avdubblerar. Samma adress kan ha följt via flera vägar —
 * en kväll, en serie, en profil — och ska ändå få ett mejl.
 */
export function mottagareAvFoljare(rows: readonly FollowerRow[]): Mottagare[] {
  const byEmail = new Map<string, Mottagare>();
  for (const r of rows) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email) continue;
    if (!r.confirmed_at) continue; // aldrig bekräftat = inget ja
    if (r.unsubscribed_at) continue; // har sagt ifrån
    if (!r.unsubscribe_token) continue; // utan väg ut skickar vi inget
    if (!byEmail.has(email)) {
      byEmail.set(email, { email, locale: r.locale ?? null, unsubscribeToken: r.unsubscribe_token });
    }
  }
  return [...byEmail.values()];
}
