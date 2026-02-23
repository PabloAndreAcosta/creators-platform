import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { releaseEventToGoldMembers } from "@/lib/listings/early-bird";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Du måste vara inloggad." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { listingId } = body;

    if (!listingId) {
      return NextResponse.json(
        { error: "listingId krävs." },
        { status: 400 }
      );
    }

    // Verify the user owns this listing
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, user_id, title")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: "Annonsen hittades inte." },
        { status: 404 }
      );
    }

    if (listing.user_id !== user.id) {
      return NextResponse.json(
        { error: "Du har inte behörighet att ändra denna annons." },
        { status: 403 }
      );
    }

    // Release to Gold members with a 48-hour exclusive window
    const releaseDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await releaseEventToGoldMembers(listingId, releaseDate);

    return NextResponse.json({
      success: true,
      message: "Gold-exklusiv tillgång har aktiverats.",
      releaseDate: releaseDate.toISOString(),
    });
  } catch (error) {
    console.error("Early bird release error:", error);
    return NextResponse.json(
      { error: "Kunde inte aktivera Gold-exklusiv tillgång." },
      { status: 500 }
    );
  }
}
