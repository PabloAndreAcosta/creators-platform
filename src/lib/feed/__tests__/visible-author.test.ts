import { describe, it, expect } from "vitest";
import { isFeedPostVisible } from "../visible-author";

describe("isFeedPostVisible", () => {
  it("visar inlägg från en publik profil", () => {
    expect(isFeedPostVisible({ user_id: "a", profiles: { is_public: true } })).toBe(true);
  });

  it("döljer inlägg från en dold profil", () => {
    expect(isFeedPostVisible({ user_id: "a", profiles: { is_public: false } })).toBe(false);
  });

  it("döljer inlägg när profilen inte går att läsa (raderad eller dold bakom RLS)", () => {
    expect(isFeedPostVisible({ user_id: "a", profiles: null })).toBe(false);
    expect(isFeedPostVisible({ user_id: "a" })).toBe(false);
  });

  it("visar den inloggades egna inlägg även när profilen är dold", () => {
    expect(isFeedPostVisible({ user_id: "a", profiles: { is_public: false } }, "a")).toBe(true);
  });
});
