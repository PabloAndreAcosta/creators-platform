import { describe, it, expect } from "vitest";
import { approvalScopeKey, approvedRoles, unapprovedRolesAmong, cleanMessage } from "../approvals";

describe("ansökningar", () => {
  it("avgränsas till serien, annars arrangören", () => {
    expect(approvalScopeKey({ series_id: "s1", user_id: "u1" })).toBe("series:s1");
    expect(approvalScopeKey({ series_id: null, user_id: "u1" })).toBe("host:u1");
  });
  it("bara godkända roller räknas", () => {
    const a = approvedRoles([
      { role: "taxi_dancer", status: "approved" },
      { role: "cashier", status: "pending" },
      { role: "instructor", status: "declined" },
    ]);
    expect([...a]).toEqual(["taxi_dancer"]);
  });
  it("pekar ut de roller som saknar godkännande", () => {
    expect(unapprovedRolesAmong(["taxi_dancer", "cashier", "cashier"], new Set(["taxi_dancer"]))).toEqual(["cashier"]);
    expect(unapprovedRolesAmong(["taxi_dancer"], new Set(["taxi_dancer"]))).toEqual([]);
  });
  it("städar meddelandet", () => {
    expect(cleanMessage("  Hej!\\n\\n Jag dansar kizomba  ")).toBe("Hej!\\n\\n Jag dansar kizomba".replace(/\\s+/g, " "));
    expect(cleanMessage("   ")).toBeNull();
    expect(cleanMessage(42)).toBeNull();
  });
});
