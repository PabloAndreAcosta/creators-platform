import { describe, it, expect } from "vitest";
import { destinationAccountId } from "@/lib/settlements/destination";

// Stripe svarar med sträng eller expanderat objekt beroende på anrop. Läser vi
// fel variant hamnar "[object Object]" i databasen — ett svar som ser ut att
// vara ett svar men inte är det.
describe("destinationAccountId", () => {
  it("läser en ren konto-id-sträng", () => {
    expect(destinationAccountId("acct_1UAtdkFmVWAUCItC")).toBe("acct_1UAtdkFmVWAUCItC");
  });

  it("läser id ur ett expanderat objekt", () => {
    expect(destinationAccountId({ id: "acct_1UAtdkFmVWAUCItC" })).toBe("acct_1UAtdkFmVWAUCItC");
  });

  it("ger null i stället för att hitta på", () => {
    expect(destinationAccountId(null)).toBeNull();
    expect(destinationAccountId(undefined)).toBeNull();
    expect(destinationAccountId("")).toBeNull();
    expect(destinationAccountId({})).toBeNull();
    expect(destinationAccountId({ id: null })).toBeNull();
  });

  it("gör aldrig ett objekt till en sträng", () => {
    // Det här är hela poängen: utan funktionen hade raden fått
    // "[object Object]" och sett besvarad ut.
    const r = destinationAccountId({ id: "acct_X" } as never);
    expect(r).toBe("acct_X");
    expect(String(r)).not.toContain("object");
  });
});
