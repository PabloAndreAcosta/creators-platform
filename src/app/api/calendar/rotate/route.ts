import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * POST /api/calendar/rotate
 * Rotates the calendar sync token for the authenticated user.
 * Old feed URLs stop working immediately.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const newToken = crypto.randomUUID();

    const { error } = await supabase
      .from("profiles")
      .update({ calendar_sync_token: newToken })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: "Could not rotate token" }, { status: 500 });
    }

    return NextResponse.json({ token: newToken });
  } catch (error) {
    console.error("Calendar rotate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
