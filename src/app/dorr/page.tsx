import { redirect } from "next/navigation";

/**
 * usha.se/dorr — kortlänken till självinsläppet.
 *
 * Leder till hubben under Mer (/app/dorr) som har guiden, kvällens evenemang
 * och startknappen. Är man utloggad skickar /app-layouten till inloggningen
 * och tillbaka hit efteråt.
 */
export default function DoorShortcutPage() {
  redirect("/app/dorr");
}
