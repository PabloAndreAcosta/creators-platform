import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { userId, reason, type } = await req.json();

    if (!userId || !type || (type !== "block" && type !== "report")) {
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
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Okänt fel";
        return NextResponse.json(
          {
            error: `Kunde inte blockera användaren. Tabellen 'user_blocks' kanske inte finns ännu. Detaljer: ${message}`,
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
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Okänt fel";
        return NextResponse.json(
          {
            error: `Kunde inte skicka rapporten. Tabellen 'user_reports' kanske inte finns ännu. Detaljer: ${message}`,
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
