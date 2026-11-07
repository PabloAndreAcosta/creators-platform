import { describe, it, expect } from "vitest";
import { allowedPartnerIds } from "../partners";

function fakeAdmin(rows: { user_id: string | null }[]) {
  const q: any = {
    select: () => q,
    eq: () => q,
    then: (res: (v: unknown) => unknown) => res({ data: rows }),
  };
  return { from: () => q } as any;
}

describe("allowedPartnerIds", () => {
  it("tar med lokalen och accepterad crew", async () => {
    const ids = await allowedPartnerIds(fakeAdmin([{ user_id: "elli" }]), {
      id: "l1",
      user_id: "pablo",
      venue_profile_id: "bacchi",
    });
    expect([...ids].sort()).toEqual(["bacchi", "elli"]);
  });

  it("arrangören själv blir aldrig mottagare", async () => {
    const ids = await allowedPartnerIds(fakeAdmin([{ user_id: "pablo" }]), {
      id: "l1",
      user_id: "pablo",
      venue_profile_id: null,
    });
    expect(ids.size).toBe(0);
  });

  it("utan lokal räcker en medarrangör", async () => {
    const ids = await allowedPartnerIds(fakeAdmin([{ user_id: "elli" }, { user_id: null }]), {
      id: "l1",
      user_id: "pablo",
      venue_profile_id: null,
    });
    expect([...ids]).toEqual(["elli"]);
  });
});
