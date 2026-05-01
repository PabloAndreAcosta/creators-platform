"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, creator_subcategory")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    role: (profile as { role?: string | null } | null)?.role ?? null,
    subcategory: (profile as { creator_subcategory?: string | null } | null)?.creator_subcategory ?? null,
  };
}

export async function createGig(formData: FormData) {
  const ctx = await getViewer();
  if ("error" in ctx) return { error: ctx.error };

  if (ctx.role !== "experience") {
    return { error: "Endast arrangörer kan skapa gigs." };
  }

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const event_date = (formData.get("event_date") as string)?.trim();
  const event_time = (formData.get("event_time") as string)?.trim() || null;
  const venue = (formData.get("venue") as string)?.trim() || null;
  const venue_address = (formData.get("venue_address") as string)?.trim() || null;
  const perks = (formData.get("perks") as string)?.trim() || null;
  const proposedPriceRaw = formData.get("proposed_price") as string;
  const proposed_price = proposedPriceRaw ? parseInt(proposedPriceRaw, 10) : NaN;

  if (!title) return { error: "Titel krävs" };
  if (!event_date) return { error: "Eventdatum krävs" };
  if (!Number.isFinite(proposed_price) || proposed_price < 0) {
    return { error: "Föreslagen ersättning krävs och måste vara ≥ 0" };
  }

  const { error } = await ctx.supabase.from("gigs").insert({
    arranger_id: ctx.user.id,
    title,
    description,
    event_date,
    event_time,
    venue,
    venue_address,
    proposed_price,
    perks,
  });

  if (error) return { error: "Kunde inte skapa gig: " + error.message };

  revalidatePath("/dashboard/gigs");
  revalidatePath("/app/gigs");
  redirect("/dashboard/gigs");
}

export async function closeGig(gigId: string) {
  const ctx = await getViewer();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from("gigs")
    .update({ status: "closed" })
    .eq("id", gigId)
    .eq("arranger_id", ctx.user.id);

  if (error) return { error: "Kunde inte stänga gig" };
  revalidatePath("/dashboard/gigs");
  return { success: true };
}

export async function applyToGig(gigId: string, message: string) {
  const ctx = await getViewer();
  if ("error" in ctx) return { error: ctx.error };

  if (ctx.role !== "creator" || ctx.subcategory !== "taxi_dancer") {
    return { error: "Endast taxidansare kan ansöka till gigs." };
  }

  const { data: gig } = await ctx.supabase
    .from("gigs")
    .select("id, status")
    .eq("id", gigId)
    .single();

  if (!gig) return { error: "Giget hittades inte" };
  if ((gig as { status?: string }).status !== "open") {
    return { error: "Giget är inte öppet för ansökningar längre" };
  }

  const { error } = await ctx.supabase.from("gig_applications").insert({
    gig_id: gigId,
    applicant_id: ctx.user.id,
    message: message?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return { error: "Du har redan ansökt till detta gig" };
    return { error: "Kunde inte skicka ansökan: " + error.message };
  }

  revalidatePath("/app/gigs");
  return { success: true };
}

export async function withdrawApplication(applicationId: string) {
  const ctx = await getViewer();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from("gig_applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("applicant_id", ctx.user.id);

  if (error) return { error: "Kunde inte dra tillbaka ansökan" };
  revalidatePath("/app/gigs");
  return { success: true };
}

/**
 * Arranger accepts an application. This:
 * 1. Marks the application accepted
 * 2. Closes the gig (status = filled)
 * 3. Creates a B2B booking with status = confirmed and agreed_price = gig.proposed_price
 *
 * The arrangör then pays via the existing PayB2BButton flow on the bookings page.
 */
export async function acceptApplication(applicationId: string) {
  const ctx = await getViewer();
  if ("error" in ctx) return { error: ctx.error };

  if (ctx.role !== "experience") {
    return { error: "Endast arrangörer kan acceptera ansökningar." };
  }

  const { data: application } = await ctx.supabase
    .from("gig_applications")
    .select("id, gig_id, applicant_id, status, gigs!inner(arranger_id, title, description, event_date, event_time, venue, venue_address, proposed_price, perks, status)")
    .eq("id", applicationId)
    .single();

  if (!application) return { error: "Ansökan hittades inte" };
  const app = application as unknown as {
    id: string;
    gig_id: string;
    applicant_id: string;
    status: string;
    gigs: {
      arranger_id: string;
      title: string;
      description: string | null;
      event_date: string;
      event_time: string | null;
      venue: string | null;
      venue_address: string | null;
      proposed_price: number;
      perks: string | null;
      status: string;
    };
  };

  if (app.gigs.arranger_id !== ctx.user.id) {
    return { error: "Inte din gig" };
  }
  if (app.status !== "pending") {
    return { error: "Ansökan kan inte längre accepteras" };
  }
  if (app.gigs.status !== "open") {
    return { error: "Giget är inte längre öppet" };
  }

  // Create a synthetic listing for the booking — we need a listing_id since
  // bookings.listing_id is NOT NULL. The listing references the taxi_dancer
  // who applied so payouts route to them via Stripe Connect.
  const { data: listing, error: listingError } = await ctx.supabase
    .from("listings")
    .insert({
      user_id: app.applicant_id,
      title: app.gigs.title,
      description: app.gigs.description ?? `Eventbokning från gig "${app.gigs.title}"`,
      category: "dance",
      price: app.gigs.proposed_price,
      listing_type: "b2b_offering",
      is_active: false,
    })
    .select("id")
    .single();

  if (listingError || !listing) {
    return { error: "Kunde inte skapa underliggande listing" };
  }

  const scheduledAt = app.gigs.event_time
    ? `${app.gigs.event_date}T${app.gigs.event_time}`
    : `${app.gigs.event_date}T12:00:00`;

  const venueLines = [
    app.gigs.venue ? `Lokal: ${app.gigs.venue}` : null,
    app.gigs.venue_address ? `Adress: ${app.gigs.venue_address}` : null,
    app.gigs.perks ? `Förmåner: ${app.gigs.perks}` : null,
  ].filter(Boolean) as string[];

  const { error: bookingError } = await ctx.supabase.from("bookings").insert({
    listing_id: listing.id,
    creator_id: app.applicant_id,
    customer_id: ctx.user.id,
    status: "confirmed",
    scheduled_at: scheduledAt,
    notes: app.gigs.description,
    special_requests: venueLines.length ? venueLines.join("\n") : null,
    agreed_price: app.gigs.proposed_price,
  });

  if (bookingError) {
    return { error: "Kunde inte skapa bokning: " + bookingError.message };
  }

  // Mark application accepted, gig filled, other applications declined
  await ctx.supabase
    .from("gig_applications")
    .update({ status: "accepted" })
    .eq("id", applicationId);

  await ctx.supabase
    .from("gig_applications")
    .update({ status: "declined" })
    .eq("gig_id", app.gig_id)
    .neq("id", applicationId)
    .eq("status", "pending");

  await ctx.supabase
    .from("gigs")
    .update({ status: "filled" })
    .eq("id", app.gig_id);

  revalidatePath("/dashboard/gigs");
  revalidatePath("/app/gigs");
  revalidatePath("/dashboard/bookings");
  return { success: true };
}

export async function declineApplication(applicationId: string) {
  const ctx = await getViewer();
  if ("error" in ctx) return { error: ctx.error };

  const { data: app } = await ctx.supabase
    .from("gig_applications")
    .select("id, gig_id, gigs!inner(arranger_id)")
    .eq("id", applicationId)
    .single();

  if (!app) return { error: "Ansökan hittades inte" };
  const arrangerId = (app as unknown as { gigs: { arranger_id: string } }).gigs.arranger_id;
  if (arrangerId !== ctx.user.id) return { error: "Inte din gig" };

  const { error } = await ctx.supabase
    .from("gig_applications")
    .update({ status: "declined" })
    .eq("id", applicationId);

  if (error) return { error: "Kunde inte avböja" };
  revalidatePath("/dashboard/gigs");
  return { success: true };
}
