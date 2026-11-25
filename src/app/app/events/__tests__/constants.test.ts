import { describe, it, expect } from "vitest";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS } from "../constants";
import { CATEGORIES } from "@/lib/categories";
import sv from "@/i18n/messages/sv.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

describe("evenemangets kategorier", () => {
  it("har Dans och Musik, med samma värde som /upplevelser och Dans-räknaren läser", () => {
    const shared = new Set<string>(CATEGORIES.map((c) => c.value));
    expect(EVENT_CATEGORIES).toContain("dance");
    expect(EVENT_CATEGORIES).toContain("music");
    expect(shared.has("dance")).toBe(true);
    expect(shared.has("music")).toBe(true);
  });

  it("har etikett på sv, en och es för varje val i formuläret", () => {
    for (const msgs of [sv, en, es]) {
      const labels = (msgs as { eventForm: { categories: Record<string, string> } }).eventForm.categories;
      for (const value of EVENT_CATEGORIES) {
        expect(labels[value], value).toBeTruthy();
      }
    }
  });

  it("har en svensk reservetikett för varje val", () => {
    for (const value of EVENT_CATEGORIES) {
      expect(EVENT_CATEGORY_LABELS[value], value).toBeTruthy();
    }
  });
});
