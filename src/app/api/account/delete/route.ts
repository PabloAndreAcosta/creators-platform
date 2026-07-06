import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Account deletion = soft-delete + anonymize + release identity.
//
// We intentionally do NOT hard-delete the auth user or cascade-delete their
// rows: the user is a counterparty on bookings/payments/payouts/reviews that
// must survive for accounting and legal retention. Instead we anonymize the
// profile (soft_delete_account RPC), free the login email + hashed personnummer
// so the person can register again, and ban the auth user so login is blocked
// while the row stays intact.
//
// The old flow required a password and verified it with signInWithPassword,
// which made deletion impossible for the ~24% of users with no password
// (Google OAuth, BankID-only, magic-link). The user is already authenticated
// here, so we gate on a typed confirmation instead — method-agnostic.

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Du måste vara inloggad för att radera ditt konto." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { confirm } = body as { confirm?: string };

    // Method-agnostic confirmation: the caller must type the word RADERA. Works
    // for every auth method (password, Google, BankID, magic-link) because it
    // relies on the authenticated session, not a password.
    if (typeof confirm !== "string" || confirm.trim().toUpperCase() !== "RADERA") {
      return NextResponse.json(
        { error: "Bekräftelse saknas. Skriv RADERA för att bekräfta." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const userId = user.id;

    // 1. Anonymize profile + release personnummer + hide listings (atomic).
    const { error: rpcError } = await admin.rpc("soft_delete_account", {
      p_user_id: userId,
      p_reason: "user-requested",
    });
    if (rpcError) {
      console.error("Account deletion: soft_delete_account RPC failed", rpcError);
      return NextResponse.json(
        { error: "Något gick fel vid radering av kontot. Kontakta support." },
        { status: 500 }
      );
    }

    // 2. Auth-layer changes GoTrue must own: free the login email for reuse and
    //    ban the user so login is blocked without deleting the row. The uuid in
    //    the freed address guarantees uniqueness against the auth.users email index.
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      email: `deleted+${userId}@deleted.usha.se`,
      email_confirm: true,
      ban_duration: "876000h", // ~100 years = effectively permanent
      user_metadata: { deleted: true },
    });
    if (authError) {
      console.error("Account deletion: failed to release/ban auth user", authError);
      return NextResponse.json(
        { error: "Något gick fel vid radering av kontot. Kontakta support." },
        { status: 500 }
      );
    }

    // The client signs the user out and clears the local session after this.
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Ett oväntat fel uppstod. Försök igen senare." },
      { status: 500 }
    );
  }
}
