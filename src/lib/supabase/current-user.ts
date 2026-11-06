import { cache } from "react";
import { createClient } from "./server";

/**
 * Inloggad användare, memoiserad per request.
 *
 * Layouten under /app och varje sida där anropade `auth.getUser()` var för
 * sig — två turer till auth-servern för samma svar, på varje sidvisning.
 * React's cache() lever i Nexts server-build och nollställs mellan requests,
 * så det här är ingen cachning mellan besökare: bara ett svar per request.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
