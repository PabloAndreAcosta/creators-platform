import { describe, it, expect } from "vitest";
import { isTikTokConfigured } from "../tiktok-config";

describe("isTikTokConfigured", () => {
  it("är av när nyckeln saknas", () => {
    expect(isTikTokConfigured({})).toBe(false);
  });

  it("är av när nyckeln är tom eller bara blanksteg", () => {
    expect(isTikTokConfigured({ TIKTOK_CLIENT_KEY: "" })).toBe(false);
    expect(isTikTokConfigured({ TIKTOK_CLIENT_KEY: " \n" })).toBe(false);
  });

  it("är på när nyckeln finns", () => {
    expect(isTikTokConfigured({ TIKTOK_CLIENT_KEY: "abc123" })).toBe(true);
  });
});
