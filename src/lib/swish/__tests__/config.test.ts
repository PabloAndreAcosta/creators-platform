import { describe, it, expect } from "vitest";
import { formatSwishNumber, swishMessage, swishPaymentUrl } from "../config";

describe("swish: länken i QR-koden", () => {
  it("bär nummer, belopp i hela kronor, SEK och meddelande – utan edit, så inget går att ändra", () => {
    const u = new URL(swishPaymentUrl({ number: "1237111180", amountSek: 130, message: "The Lab 11/12" }));
    expect(u.origin + u.pathname).toBe("https://app.swish.nu/1/p/sw/");
    expect(u.searchParams.get("sw")).toBe("1237111180");
    expect(u.searchParams.get("amt")).toBe("130.00");
    expect(u.searchParams.get("msg")).toBe("The Lab 11/12");
    expect(u.searchParams.get("edit")).toBeNull();
    expect(u.searchParams.has("cur")).toBe(false);
  });
  it("rundar beloppet och kapar meddelandet till 50 tecken utan specialtecken", () => {
    const u = new URL(swishPaymentUrl({ number: "1237111180", amountSek: 129.6, message: "x".repeat(80) + "<script>" }));
    expect(u.searchParams.get("amt")).toBe("130.00");
    expect(u.searchParams.get("msg")).toHaveLength(50);
  });
});

describe("swish: meddelande och format", () => {
  it("kortar titeln före tankstrecket och lägger på datum", () => {
    expect(swishMessage("The Lab Torsdag – Practica (Tarraxo & Urban Kizomba)", "2026-11-12")).toBe("The Lab Torsdag 11/12");
    expect(swishMessage("Test", null)).toBe("Test");
  });
  it("formaterar numret som Swish visar det", () => {
    expect(formatSwishNumber("1237111180")).toBe("123 711 11 80");
  });
});
