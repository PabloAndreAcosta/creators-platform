import { describe, it, expect } from "vitest";
import { isRateLimitError } from "./rate-limit-error";

describe("isRateLimitError", () => {
  it("detects a 429 status", () => {
    expect(isRateLimitError({ status: 429, message: "Request rate limit reached" })).toBe(true);
  });

  it("detects the over_request_rate_limit code", () => {
    expect(isRateLimitError({ code: "over_request_rate_limit", message: "" })).toBe(true);
  });

  it("detects a rate-limit message when status/code are absent", () => {
    expect(isRateLimitError({ message: "Request rate limit reached" })).toBe(true);
  });

  it("does not flag wrong-credentials errors", () => {
    expect(isRateLimitError({ status: 400, code: "invalid_credentials", message: "Invalid login credentials" })).toBe(false);
  });

  it("handles null/undefined safely", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});
