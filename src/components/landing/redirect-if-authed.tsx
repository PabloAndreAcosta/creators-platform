"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Non-blocking auth redirect for the landing page.
 *
 * Renders nothing. After hydration it checks the session and sends logged-in
 * users to /app. Because the redirect runs *after* render (not as a gate), the
 * full landing HTML is always server-rendered — anonymous visitors and crawlers
 * get complete, indexable content with no spinner in the initial response.
 *
 * Reuses the existing client getUser() call; adds no new external requests.
 */
export function RedirectIfAuthed() {
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) window.location.replace("/app");
      });
  }, []);

  return null;
}
