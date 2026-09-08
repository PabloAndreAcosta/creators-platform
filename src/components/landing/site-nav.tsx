import { Nav } from "./nav";
import { calendarIsVisible } from "@/lib/calendar/visibility";

/**
 * Toppmenyn för de publika sidorna. Servern avgör vilka länkar som finns
 * (kalendern visas först när utbudet räcker), klienten sköter resten.
 */
export async function SiteNav() {
  const showCalendar = await calendarIsVisible();
  return <Nav showCalendar={showCalendar} />;
}
