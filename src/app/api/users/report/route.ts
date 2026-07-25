import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
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

    const { userId, reason, type } = await req.json();

    if (!userId || !UUID_RE.test(userId) || !type || (type !== "block" && type !== "report")) {
      return NextResponse.json(
        { error: "Ogiltig förfrågan. Ange användar-ID och typ (block/report)." },
        { status: 400 }
      );
    }

    if (type === "report" && (!reason || reason.trim().length < 10)) {
      return NextResponse.json(
        { error: "Ange en anledning med minst 10 tecken." },
        { status: 400 }
      );
    }

    if (user.id === userId) {
      return NextResponse.json(
        { error: "Du kan inte blockera eller rapportera dig själv." },
        { status: 400 }
      );
    }

    if (type === "block") {
      try {
        const { error } = await supabase.from("user_blocks").upsert(
          {
            blocker_id: user.id,
            blocked_id: userId,
            created_at: new Date().toISOString(),
          },
          { onConflict: "blocker_id,blocked_id" }
        );

        if (error) throw error;

        // Sever any buddy relationship so the blocked person disappears from the
        // Matches tab and can't be contacted. buddy_matches uses canonical
        // user_a < user_b; buddy_likes are directional (delete both ways).
        // Needs the service-role client (buddy_matches/likes have no user delete
        // policy, and RLS would hide the counterpart's rows).
        const admin = createAdminClient();
        const [x, y] = user.id < userId ? [user.id, userId] : [userId, user.id];
        await admin.from("buddy_matches").delete().eq("user_a", x).eq("user_b", y);
        await admin
          .from("buddy_likes")
          .delete()
          .or(`and(from_user.eq.${user.id},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${user.id})`);
      } catch {
        return NextResponse.json(
          {
            error: "Kunde inte spara. Försök igen.",
          },
          { status: 500 }
        );
      }
    }

    if (type === "report") {
      try {
        const { error } = await supabase.from("user_reports").insert({
          reporter_id: user.id,
          reported_id: userId,
          reason: reason.trim(),
          status: "pending",
          created_at: new Date().toISOString(),
        });

        if (error) throw error;
      } catch {
        return NextResponse.json(
          {
            error: "Kunde inte spara. Försök igen.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Något gick fel. Försök igen senare." },
      { status: 500 }
    );
  }
}
