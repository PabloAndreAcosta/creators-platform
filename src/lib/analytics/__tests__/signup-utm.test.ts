import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { shouldRecordSignupUtm } from "../signup-utm";

const now = Date.parse("2026-11-02T20:00:00Z");
const c = "source:instagram|medium:social|campaign:konto";
describe("shouldRecordSignupUtm", () => {
  it("nytt konto med kanal sparas", () => expect(shouldRecordSignupUtm("2026-11-02T19:00:00Z", c, now)).toBe(true));
  it("gammalt konto sparas inte", () => expect(shouldRecordSignupUtm("2026-10-01T19:00:00Z", c, now)).toBe(false));
  it("utan cookie sparas inget", () => expect(shouldRecordSignupUtm("2026-11-02T19:00:00Z", null, now)).toBe(false));
  it("tom cookie sparas inte", () => expect(shouldRecordSignupUtm("2026-11-02T19:00:00Z", "skräp", now)).toBe(false));
});
