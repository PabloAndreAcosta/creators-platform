import { describe, it, expect, vi } from "vitest";
import { adoptGuestBookings } from "../adopt-guest";

/** Stubb som fångar vad som filtrerades och uppdaterades. */
function admin(rows: { id: string }[] | null, spy?: Record<string, unknown>) {
  const calls: Record<string, unknown> = spy ?? {};
  return {
    from: (table: string) => {
      calls.table = table;
      return {
        update: (patch: Record<string, unknown>) => {
          calls.patch = patch;
          return {
            is: (col: string, val: unknown) => {
              calls.isCol = col;
              calls.isVal = val;
              return {
                ilike: (col2: string, val2: string) => {
                  calls.ilikeCol = col2;
                  calls.ilikeVal = val2;
                  return { select: async () => ({ data: rows }) };
                },
              };
            },
          };
        },
      };
    },
  } as never;
}

describe("adoptGuestBookings", () => {
  it("knyter gästrader på samma mejl till kontot", async () => {
    const calls: Record<string, unknown> = {};
    const n = await adoptGuestBookings(admin([{ id: "b1" }, { id: "b2" }], calls), "u1", "Anna@Example.se");
    expect(n).toBe(2);
    expect(calls.patch).toEqual({ customer_id: "u1" });
    expect(calls.ilikeVal).toBe("anna@example.se");
  });

  it("rör BARA rader utan ägare", async () => {
    // Annars hade en adress kunnat flytta någon annans bokning.
    const calls: Record<string, unknown> = {};
    await adoptGuestBookings(admin([], calls), "u1", "a@b.se");
    expect(calls.isCol).toBe("customer_id");
    expect(calls.isVal).toBe(null);
  });

  it("rör inte show_attendance", async () => {
    // Att köpet flyttas till kontot är inte ett samtycke till att synas.
    const calls: Record<string, unknown> = {};
    await adoptGuestBookings(admin([], calls), "u1", "a@b.se");
    expect(Object.keys(calls.patch as object)).toEqual(["customer_id"]);
  });

  it("gör ingenting utan mejladress eller användare", async () => {
    expect(await adoptGuestBookings(admin([]), "u1", null)).toBe(0);
    expect(await adoptGuestBookings(admin([]), "u1", "   ")).toBe(0);
    expect(await adoptGuestBookings(admin([]), "", "a@b.se")).toBe(0);
  });

  it("sväljer fel — en inloggning får aldrig fastna på adoptionen", async () => {
    const trasig = {
      from: () => {
        throw new Error("nere");
      },
    } as never;
    await expect(adoptGuestBookings(trasig, "u1", "a@b.se")).resolves.toBe(0);
  });
});
