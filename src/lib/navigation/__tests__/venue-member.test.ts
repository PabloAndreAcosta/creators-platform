import { describe, it, expect } from "vitest";
import { destinationsFor } from "../registry";
import { navPathsForVenueCapabilities, memberLandingPath } from "../venue-member";

const paths = (role: "customer" | "creator" | "venue", caps: string[][], surface: "sidebar" | "more" = "sidebar") =>
  destinationsFor(role, surface, navPathsForVenueCapabilities(caps)).map((d) => d.path);

describe("lokalteamets menyval", () => {
  it("en publik utan lokalteam ser varken Evenemang eller Skanna", () => {
    const p = paths("customer", []);
    expect(p).not.toContain("/app/events");
    expect(p).not.toContain("/app/scan");
  });

  it("dörrteamet (scan) får Skanna men inte Evenemang", () => {
    const p = paths("customer", [["scan", "bookings"]]);
    expect(p).toContain("/app/scan");
    expect(p).not.toContain("/app/events");
  });

  it("den som får skapa åt lokalen (events) får Evenemang", () => {
    const p = paths("customer", [["events"]], "more");
    expect(p).toContain("/app/events");
    expect(p).not.toContain("/app/scan");
  });

  it("page låser upp Förfrågningar", () => {
    expect(paths("customer", [["page"]])).toContain("/app/venue-requests");
  });

  it("behörigheter från flera lokaler läggs ihop", () => {
    expect(navPathsForVenueCapabilities([["scan"], ["events"]]).sort()).toEqual(["/app/events", "/app/scan"]);
  });

  it("låser inte upp något utöver det behörigheten gäller", () => {
    const utan = paths("customer", []);
    const med = paths("customer", [["events", "bookings", "scan", "messages", "stats", "page"]]);
    expect(med.filter((p) => !utan.includes(p)).sort()).toEqual(["/app/events", "/app/scan", "/app/venue-requests"]);
  });

  it("okända behörigheter ger inget", () => {
    expect(navPathsForVenueCapabilities([["payouts", "stripe"]])).toEqual([]);
  });

  it("ändrar inget för en lokal eller kreatör", () => {
    expect(paths("venue", [["events", "scan"]])).toEqual(paths("venue", []));
    expect(paths("creator", [["events", "scan"]])).toEqual(paths("creator", []));
  });
});

describe("vart en ny medlem skickas efter accept", () => {
  it("till evenemangen om hen får skapa", () => {
    expect(memberLandingPath(["scan", "events"])).toBe("/app/events");
  });
  it("till skannern för dörrteamet", () => {
    expect(memberLandingPath(["bookings", "scan"])).toBe("/app/scan");
  });
  it("till förfrågningarna för den som sköter sidan", () => {
    expect(memberLandingPath(["messages", "page"])).toBe("/app/venue-requests");
  });
  it("till /app när inget har en egen sida", () => {
    expect(memberLandingPath(["stats"])).toBe("/app");
    expect(memberLandingPath([])).toBe("/app");
  });
});
