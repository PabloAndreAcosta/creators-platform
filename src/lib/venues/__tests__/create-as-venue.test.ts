import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listingWriterFor } from "../create-as-venue";

const own = { name: "own" } as unknown as SupabaseClient;
const admin = { name: "admin" } as unknown as SupabaseClient;

describe("listingWriterFor", () => {
  it("skriver genom personens egen session när hen skapar åt sig själv", () => {
    const factory = vi.fn(() => admin);
    expect(listingWriterFor(own, null, factory)).toBe(own);
    // Service-role skapas inte ens i onödan.
    expect(factory).not.toHaveBeenCalled();
  });

  it("skriver genom service-role när en prövad medlem skapar åt lokalen", () => {
    // RLS kräver auth.uid() = user_id, och raden ägs av lokalen — medlemmens
    // session kan aldrig skriva den. Före rättningen föll varje sådant försök.
    expect(listingWriterFor(own, "medlem-1", () => admin)).toBe(admin);
  });
});

describe("createEvent i lokalens namn", () => {
  const src = readFileSync(join(process.cwd(), "src/app/app/events/actions.ts"), "utf8");
  const body = src.slice(src.indexOf("export async function createEvent"), src.indexOf("export async function duplicateEvent"));

  it("prövar medlemskapet innan service-role tas fram", () => {
    const check = body.indexOf("venuesUserCanCreateFor(user.id)");
    const writer = body.indexOf("listingWriterFor(");
    expect(check).toBeGreaterThan(-1);
    expect(writer).toBeGreaterThan(check);
  });

  it("skriver evenemang och biljettyper med samma klient", () => {
    expect(body).toMatch(/await db\s*\.from\("listings"\)\s*\.insert\(rows\)/);
    expect(body).toContain("reconcileTicketTypes(db,");
    expect(body).not.toMatch(/await supabase\s*\.from\("listings"\)\s*\.insert/);
  });

  it("låter lokalen äga raden och medlemmen stå som skapare", () => {
    expect(body).toContain("user_id: ownerId,");
    expect(body).toContain("created_by: createdBy,");
  });
});
