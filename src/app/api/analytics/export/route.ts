import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics/export?type=bookings|revenue|all
 * Exports creator's analytics data as CSV.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") || "all";

  // Fetch bookings for this creator
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, status, scheduled_at, created_at, amount_paid, guest_count, booking_type, checked_in_at, listings(title, category, price)"
    )
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (!bookings || bookings.length === 0) {
    const emptyCSV = "No data to export";
    return new NextResponse(emptyCSV, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="usha-export-${type}.csv"`,
      },
    });
  }

  let csv = "";

  if (type === "bookings" || type === "all") {
    csv += "Booking ID,Service,Category,Status,Date,Guests,Amount (SEK),Type,Checked In\n";
    for (const b of bookings) {
      const listing = b.listings as any;
      const amount = b.amount_paid ? (b.amount_paid / 100).toFixed(2) : (listing?.price || 0).toFixed(2);
      const checkedIn = b.checked_in_at ? "Yes" : "No";
      const title = (listing?.title || "").replace(/,/g, " ");
      const category = (listing?.category || "").replace(/,/g, " ");
      csv += `${b.id},${title},${category},${b.status},${b.scheduled_at?.split("T")[0] || ""},${b.guest_count || 1},${amount},${b.booking_type},${checkedIn}\n`;
    }
  }

  if (type === "revenue" || type === "all") {
    if (type === "all") csv += "\n";

    // Group by month
    const monthlyMap = new Map<string, { revenue: number; bookings: number; completed: number }>();
    for (const b of bookings) {
      const month = b.created_at.slice(0, 7); // YYYY-MM
      const entry = monthlyMap.get(month) || { revenue: 0, bookings: 0, completed: 0 };
      entry.bookings++;
      if (b.status === "completed") {
        entry.completed++;
        const listing = b.listings as any;
        entry.revenue += b.amount_paid ? b.amount_paid / 100 : (listing?.price || 0);
      }
      monthlyMap.set(month, entry);
    }

    csv += "Month,Bookings,Completed,Revenue (SEK)\n";
    const sortedMonths = Array.from(monthlyMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [month, data] of sortedMonths) {
      csv += `${month},${data.bookings},${data.completed},${data.revenue.toFixed(2)}\n`;
    }
  }

  // Fetch payouts
  if (type === "all") {
    const { data: payouts } = await supabase
      .from("payouts")
      .select("id, amount_gross, amount_commission, amount_net, payout_type, status, created_at, paid_at")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });

    if (payouts && payouts.length > 0) {
      csv += "\nPayout ID,Gross (SEK),Commission (SEK),Net (SEK),Type,Status,Date,Paid At\n";
      for (const p of payouts) {
        csv += `${p.id},${p.amount_gross},${p.amount_commission},${p.amount_net},${p.payout_type},${p.status},${p.created_at?.split("T")[0] || ""},${p.paid_at?.split("T")[0] || ""}\n`;
      }
    }
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usha-export-${type}-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
