import { describe, it, expect } from "vitest";
import { isValidEmail, normalizeEmail, cleanName, waitlistToCsv, type WaitlistEntry } from "../waitlist";

describe("isValidEmail", () => {
  it("accepts valid addresses", () => {
    expect(isValidEmail("anna@joynation.se")).toBe(true);
    expect(isValidEmail("  a.b+tag@sub.example.co.uk ")).toBe(true);
  });
  it("rejects invalid addresses", () => {
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a@b.c")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Anna@JoyNation.SE ")).toBe("anna@joynation.se");
  });
});

describe("cleanName", () => {
  it("trims, caps length, and nullifies empty", () => {
    expect(cleanName("  Anna  ")).toBe("Anna");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName(123)).toBeNull();
    expect(cleanName("x".repeat(200))).toHaveLength(120);
  });
});

describe("waitlistToCsv", () => {
  const rows: WaitlistEntry[] = [
    {
      id: "1", listing_id: "l1", name: 'Anna "AJ"', email: "anna@joynation.se",
      source: "event_page", unsubscribe_token: "t1", unsubscribed_at: null,
      created_at: "2026-06-27T10:00:00Z",
    },
    {
      id: "2", listing_id: "l1", name: null, email: "b@example.com",
      source: null, unsubscribe_token: "t2", unsubscribed_at: "2026-06-28T10:00:00Z",
      created_at: "2026-06-27T11:00:00Z",
    },
  ];

  it("has a header and one line per row", () => {
    const csv = waitlistToCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('"name","email","signed_up_at","status"');
  });

  it("escapes quotes and marks status", () => {
    const csv = waitlistToCsv(rows);
    expect(csv).toContain('"Anna ""AJ"""');
    expect(csv).toContain('"active"');
    expect(csv).toContain('"unsubscribed"');
  });

  it("renders empty name as empty string", () => {
    const csv = waitlistToCsv(rows);
    const line = csv.split("\r\n")[2];
    expect(line.startsWith('"","b@example.com"')).toBe(true);
  });
});
