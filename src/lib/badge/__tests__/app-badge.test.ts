import { describe, it, expect, vi } from "vitest";
import { BADGE_MAX, applyBadge, badgeAction, badgeSupported, type BadgeTarget } from "../app-badge";

function target(): BadgeTarget & { setAppBadge: ReturnType<typeof vi.fn>; clearAppBadge: ReturnType<typeof vi.fn> } {
  return { setAppBadge: vi.fn().mockResolvedValue(undefined), clearAppBadge: vi.fn().mockResolvedValue(undefined) };
}

describe("siffran på appikonen", () => {
  it("sätter antalet olästa", () => {
    expect(badgeAction(3)).toEqual({ action: "set", count: 3 });
  });

  it("rensar i stället för att rita en nolla", () => {
    expect(badgeAction(0)).toEqual({ action: "clear" });
  });

  it("behandlar skräpvärden som noll", () => {
    expect(badgeAction(-5)).toEqual({ action: "clear" });
    expect(badgeAction(NaN)).toEqual({ action: "clear" });
    // Infinity är inte ett ändligt tal — det är ett trasigt värde, inte "väldigt
    // många olästa". Rensa är den säkra riktningen.
    expect(badgeAction(Infinity)).toEqual({ action: "clear" });
  });

  it("taket håller", () => {
    expect(badgeAction(4711)).toEqual({ action: "set", count: BADGE_MAX });
  });

  it("avrundar nedåt", () => {
    expect(badgeAction(2.9)).toEqual({ action: "set", count: 2 });
  });

  it("säger ifrån när plattformen saknar stödet", async () => {
    expect(badgeSupported(undefined)).toBe(false);
    expect(badgeSupported({})).toBe(false);
    await expect(applyBadge(4, {})).resolves.toBe("unsupported");
  });

  it("anropar rätt funktion", async () => {
    const t = target();
    await expect(applyBadge(7, t)).resolves.toBe("set");
    expect(t.setAppBadge).toHaveBeenCalledWith(7);
    expect(t.clearAppBadge).not.toHaveBeenCalled();

    const t2 = target();
    await expect(applyBadge(0, t2)).resolves.toBe("cleared");
    expect(t2.clearAppBadge).toHaveBeenCalled();
  });

  it("sväljer fel från plattformen", async () => {
    const t = target();
    t.setAppBadge.mockRejectedValue(new Error("not allowed"));
    await expect(applyBadge(2, t)).resolves.toBe("failed");
  });
});
