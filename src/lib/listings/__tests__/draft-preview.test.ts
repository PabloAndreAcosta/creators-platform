import { describe, it, expect } from "vitest";
import { loadPreviewableDraft } from "../draft-preview";

/**
 * Vem får se ett utkast på den publika sidan. Fejkad klient som i
 * venues/__tests__/manage-access.test.ts: det som testas är beslutet.
 */
type Row = Record<string, unknown> | null;

function fakeAdmin(draft: Row, opts: { collaborator?: Row; member?: Row } = {}) {
  const eqs: [string, unknown][] = [];
  const client = {
    eqs,
    from(table: string) {
      const data =
        table === "listings" ? draft :
        table === "venue_members" ? opts.member ?? null :
        opts.collaborator ?? null;
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          if (table === "listings") eqs.push([col, val]);
          return chain;
        },
        maybeSingle: async () => ({ data }),
      };
      return chain;
    },
  };
  return client;
}

const draft = { id: "listing-1", user_id: "agare", title: "Practica", is_active: false };
const opts = (viewerId: string) => ({ column: "slug" as const, value: "practica-abc", viewerId, columns: "id, user_id" });

describe("loadPreviewableDraft", () => {
  it("visar utkastet för ägaren", async () => {
    expect(await loadPreviewableDraft(fakeAdmin(draft) as never, opts("agare"))).toEqual(draft);
  });

  it("visar utkastet för en medarrangör med can_manage", async () => {
    const admin = fakeAdmin(draft, { collaborator: { id: "c1" } });
    expect(await loadPreviewableDraft(admin as never, opts("medarr"))).toEqual(draft);
  });

  it("ger null för en främling (sidan svarar 404)", async () => {
    expect(await loadPreviewableDraft(fakeAdmin(draft) as never, opts("framling"))).toBeNull();
  });

  it("ger null när inget utkast finns", async () => {
    expect(await loadPreviewableDraft(fakeAdmin(null) as never, opts("agare"))).toBeNull();
  });

  it("frågar bara efter inaktiva rader", async () => {
    const admin = fakeAdmin(draft);
    await loadPreviewableDraft(admin as never, opts("agare"));
    expect(admin.eqs).toContainEqual(["is_active", false]);
    expect(admin.eqs).toContainEqual(["slug", "practica-abc"]);
  });
});
