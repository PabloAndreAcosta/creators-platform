import { describe, expect, it } from "vitest";
import {
  bookingStartsAt,
  cancellationDeadline,
  customerCancelBlock,
  parseCancellationHours,
} from "../cancellation";

describe("parseCancellationHours", () => {
  it("bara de valbara tiderna; annat blir ingen gräns", () => {
    expect(parseCancellationHours("24")).toBe(24);
    expect(parseCancellationHours("5")).toBeNull();
    expect(parseCancellationHours("")).toBeNull();
  });
});

describe("bookingStartsAt", () => {
  it("evenemang börjar när kvällen börjar, i Stockholmstid", () => {
    const d = bookingStartsAt({ scheduledAt: "2026-10-01T10:00:00Z", listingType: "event", eventDate: "2026-11-05", eventTime: "17:00:00" });
    expect(d?.toISOString()).toBe("2026-11-05T16:00:00.000Z");
  });
  it("tjänst börjar vid den bokade tiden", () => {
    const d = bookingStartsAt({ scheduledAt: "2026-11-05T09:00:00Z", listingType: "service", eventDate: null, eventTime: null });
    expect(d?.toISOString()).toBe("2026-11-05T09:00:00.000Z");
  });
  it("klippkort har ingen tidpunkt", () => {
    expect(bookingStartsAt({ scheduledAt: "2026-10-01T10:00:00Z", listingType: "package", eventDate: null, eventTime: null })).toBeNull();
  });
});

describe("customerCancelBlock", () => {
  const start = new Date("2026-11-05T16:00:00Z");
  const deadline = cancellationDeadline(start, 24);
  it("före gränsen går det bra", () => {
    expect(customerCancelBlock({ now: new Date("2026-11-04T15:00:00Z"), deadline, sessionsRedeemed: 0, minutesRedeemed: 0 })).toBeNull();
  });
  it("efter gränsen är det stängt", () => {
    expect(customerCancelBlock({ now: new Date("2026-11-04T17:00:00Z"), deadline, sessionsRedeemed: 0, minutesRedeemed: 0 })).toBe("deadlinePassed");
  });
  it("utan gräns går det alltid", () => {
    expect(customerCancelBlock({ now: start, deadline: cancellationDeadline(start, null), sessionsRedeemed: null, minutesRedeemed: null })).toBeNull();
  });
  it("ett påbörjat klippkort lämnas inte tillbaka av köparen", () => {
    expect(customerCancelBlock({ now: start, deadline: null, sessionsRedeemed: 2, minutesRedeemed: 0 })).toBe("packageInUse");
  });
});
