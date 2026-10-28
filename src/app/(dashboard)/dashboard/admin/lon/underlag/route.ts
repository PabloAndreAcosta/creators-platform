import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { loadPendingUnderlag } from "@/lib/assignments/load-underlag";
import { underlagCsv } from "@/lib/assignments/underlag";
import { stockholmToday } from "@/lib/time";

/** Underlaget som fil, för SAMekonomis file drop. Innehåller personnummer. */
export async function GET() {
  try {
    await assertAdmin("full");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { rows } = await loadPendingUnderlag();
  return new NextResponse(underlagCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usha-loneunderlag-${stockholmToday()}.csv"`,
      // Personnummer ska aldrig ligga kvar i en mellanlagring.
      "Cache-Control": "no-store",
    },
  });
}
