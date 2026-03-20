import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Lösenord krävs för att bekräfta kontoradering." },
        { status: 400 }
      );
    }

    // Verify password by attempting sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: "Felaktigt lösenord. Försök igen." },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();
    const userId = user.id;

    // Delete user data in order to respect foreign key constraints

    // 1. Delete reviews (both written and received)
    await adminClient
      .from("reviews")
      .delete()
      .or(`reviewer_id.eq.${userId},reviewed_id.eq.${userId}`);

    // 2. Delete messages
    await adminClient
      .from("messages")
      .delete()
      .eq("sender_id", userId);

    // 3. Delete conversations
    await adminClient
      .from("conversations")
      .delete()
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    // 4. Cancel pending/confirmed bookings, then delete
    await adminClient
      .from("bookings")
      .update({ status: "canceled" })
      .or(`client_id.eq.${userId},creator_id.eq.${userId}`)
      .in("status", ["pending", "confirmed"]);

    await adminClient
      .from("bookings")
      .delete()
      .or(`client_id.eq.${userId},creator_id.eq.${userId}`);

    // 5. Delete notifications
    await adminClient
      .from("notifications")
      .delete()
      .eq("user_id", userId);

    // 6. Delete user settings
    await adminClient
      .from("user_settings")
      .delete()
      .eq("user_id", userId);

    // 7. Delete favorites
    await adminClient
      .from("favorites")
      .delete()
      .eq("user_id", userId);

    // 8. Delete listings
    await adminClient
      .from("listings")
      .delete()
      .eq("user_id", userId);

    // 9. Delete profile
    await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    // 10. Delete auth user
    const { error: deleteAuthError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      return NextResponse.json(
        { error: "Något gick fel vid radering av kontot. Kontakta support." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Ett oväntat fel uppstod. Försök igen senare." },
      { status: 500 }
    );
  }
}
