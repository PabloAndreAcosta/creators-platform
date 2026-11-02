import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * usha.se/undervisa — länken i instruktörsfilmen och inläggen.
 *
 * Appens layout skickar utloggade till /login utan väg tillbaka, så länken kan
 * inte peka direkt på /app/events/open. Här avgörs det innan layouten körs:
 * utan konto → Skapa konto som kreatör, tillbaka till Öppna event efteråt
 * (inloggning för befintligt konto finns på samma sida och behåller vägen).
 * Med konto → rakt till Öppna event. UTM-parametrarna fångas av middlewaren
 * på den här requesten, före omdirigeringen.
 */
export default async function UndervisaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/app/events/open" : "/signup?role=creator&next=%2Fapp%2Fevents%2Fopen");
}
