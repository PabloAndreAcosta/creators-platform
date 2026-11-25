import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("../create", () => ({ createNotification: vi.fn(async () => {}) }));

import { notifyEntranceSwishRequest, shortEventDate } from "../event-owner";
import { createNotification } from "../create";

/**
 * Notisen om ett Swish-köp att bekräfta: till ägaren och alla i kvällens crew
 * som får sköta dörren, med en länk till bekräftelsesidan för just det köpet.
 */

const collaborators = [
  { user_id: "medarr", can_manage: true, can_scan: false },
  { user_id: "dorrvakt", can_manage: false, can_scan: true },
  { user_id: "dansare", can_manage: false, can_scan: false },
];
const admin = {
  from: () => {
    const b = { select: () => b, eq: () => b, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: collaborators }).then(r) };
    return b;
  },
} as unknown as SupabaseClient;

beforeEach(() => vi.mocked(createNotification).mockClear());

describe("notifyEntranceSwishRequest", () => {
  it("går till ägaren, medarrangörer och dörrpersonal — inte till övrig crew", async () => {
    await notifyEntranceSwishRequest(admin, {
      listingId: "L",
      ownerId: "owner",
      bookingId: "B1",
      name: "Ana",
      service: "The Lab",
      amountOre: 13000,
      eventDate: "2026-11-26",
    });
    const users = vi.mocked(createNotification).mock.calls.map((c) => c[0].userId).sort();
    expect(users).toEqual(["dorrvakt", "medarr", "owner"]);
  });

  it("öppnar bekräftelsesidan, egen push-tagg per köp, Bekräfta-knappen öppnar bara sidan", async () => {
    await notifyEntranceSwishRequest(admin, {
      listingId: "L",
      ownerId: "owner",
      bookingId: "B1",
      name: "Ana",
      service: "The Lab",
      amountOre: 13000,
      eventDate: "2026-11-26",
    });
    const n = vi.mocked(createNotification).mock.calls[0][0];
    expect(n).toMatchObject({
      titleKey: "swishRequestTitle",
      bodyKey: "swishToConfirmMsg",
      params: { name: "Ana", service: "The Lab", amount: 130, date: "26/11" },
      link: "/app/swish/bekrafta/B1",
      pushTag: "swish-B1",
    });
    expect(n.pushActions).toEqual([
      { action: "swish-confirm", titleKey: "swishActionConfirm", url: "/app/swish/bekrafta/B1?val=bekrafta" },
    ]);
    // Ingen hemlighet i länken: bara boknings-id, sidan kräver inloggning.
    expect(n.pushActions?.[0].url).not.toMatch(/token|secret|sig=/i);
  });

  it("utan datum: meningen utan datum", async () => {
    await notifyEntranceSwishRequest(admin, { listingId: "L", ownerId: "owner", bookingId: "B2", name: "x", service: "s", amountOre: 100 });
    expect(vi.mocked(createNotification).mock.calls[0][0].bodyKey).toBe("swishToConfirmMsgNoDate");
  });

  it("shortEventDate", () => {
    expect(shortEventDate("2026-11-26")).toBe("26/11");
    expect(shortEventDate("2026-01-05")).toBe("5/1");
    expect(shortEventDate(null)).toBeNull();
  });
});
