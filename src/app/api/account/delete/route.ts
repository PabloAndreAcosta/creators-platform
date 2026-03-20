import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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

    // Check that the user has an email address for password verification
    if (!user.email) {
      return NextResponse.json(
        { error: "Kontot har ingen e-postadress kopplad." },
        { status: 400 }
      );
    }

    // Verify password using a standalone client that does NOT write cookies.
    // Using the cookie-based server client for signInWithPassword would corrupt
    // the current session by overwriting the session cookie mid-request.
    const verifyClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: user.email,
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

    // Delete user data in order to respect foreign key constraints.
    // Best-effort GDPR deletion: log errors but continue so partial failures
    // don't prevent the rest of the data from being removed.

    // 1. Delete reviews (both written and received)
    const { error: reviewsError } = await adminClient
      .from("reviews")
      .delete()
      .or(`reviewer_id.eq.${userId},creator_id.eq.${userId}`);
    if (reviewsError) console.error("Account deletion: failed to delete reviews", reviewsError);

    // 2. Delete messages (both sent AND received)
    // First, find all conversations where the user is a participant
    const { data: userConversations, error: convLookupError } = await adminClient
      .from("conversations")
      .select("id")
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
    if (convLookupError) console.error("Account deletion: failed to look up conversations", convLookupError);

    // Delete all messages in those conversations (covers both sent and received)
    if (userConversations && userConversations.length > 0) {
      const conversationIds = userConversations.map((c) => c.id);
      const { error: messagesError } = await adminClient
        .from("messages")
        .delete()
        .in("conversation_id", conversationIds);
      if (messagesError) console.error("Account deletion: failed to delete messages", messagesError);
    }

    // Also delete any messages by sender_id in case they exist outside tracked conversations
    const { error: senderMsgError } = await adminClient
      .from("messages")
      .delete()
      .eq("sender_id", userId);
    if (senderMsgError) console.error("Account deletion: failed to delete sent messages", senderMsgError);

    // 3. Delete conversations
    const { error: convsError } = await adminClient
      .from("conversations")
      .delete()
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
    if (convsError) console.error("Account deletion: failed to delete conversations", convsError);

    // 4. Cancel pending/confirmed bookings, then delete
    const { error: bookingsCancelError } = await adminClient
      .from("bookings")
      .update({ status: "canceled" })
      .or(`customer_id.eq.${userId},creator_id.eq.${userId}`)
      .in("status", ["pending", "confirmed"]);
    if (bookingsCancelError) console.error("Account deletion: failed to cancel bookings", bookingsCancelError);

    const { error: bookingsDeleteError } = await adminClient
      .from("bookings")
      .delete()
      .or(`customer_id.eq.${userId},creator_id.eq.${userId}`);
    if (bookingsDeleteError) console.error("Account deletion: failed to delete bookings", bookingsDeleteError);

    // 5. Delete notifications
    const { error: notificationsError } = await adminClient
      .from("notifications")
      .delete()
      .eq("user_id", userId);
    if (notificationsError) console.error("Account deletion: failed to delete notifications", notificationsError);

    // 6. Delete user settings
    const { error: settingsError } = await adminClient
      .from("user_settings")
      .delete()
      .eq("user_id", userId);
    if (settingsError) console.error("Account deletion: failed to delete user settings", settingsError);

    // 7. Delete favorites
    const { error: favoritesError } = await adminClient
      .from("favorites")
      .delete()
      .eq("user_id", userId);
    if (favoritesError) console.error("Account deletion: failed to delete favorites", favoritesError);

    // 8. Delete listings
    const { error: listingsError } = await adminClient
      .from("listings")
      .delete()
      .eq("user_id", userId);
    if (listingsError) console.error("Account deletion: failed to delete listings", listingsError);

    // 9. Delete profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileError) console.error("Account deletion: failed to delete profile", profileError);

    // 10. Delete auth user
    const { error: deleteAuthError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error("Account deletion: failed to delete auth user", deleteAuthError);
      return NextResponse.json(
        { error: "Något gick fel vid radering av kontot. Kontakta support." },
        { status: 500 }
      );
    }

    // Note: The client-side page is responsible for signing the user out
    // and clearing the local session after receiving this success response.
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Ett oväntat fel uppstod. Försök igen senare." },
      { status: 500 }
    );
  }
}
