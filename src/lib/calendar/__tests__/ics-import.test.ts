import { describe, it, expect } from "vitest";
import {
  parseIcs,
  unfoldLines,
  validateCalendarIcsUrl,
  maskCalendarUrl,
  guessCommitmentKind,
  upcomingEvents,
} from "../ics-import";

const wrap = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Google Inc//Google Calendar 70.9054//EN", body, "END:VCALENDAR"].join(
    "\r\n"
  );

describe("parseIcs", () => {
  it("läser en heldagshändelse med exklusivt DTEND", () => {
    const [e] = parseIcs(
      wrap(
        [
          "BEGIN:VEVENT",
          "DTSTART;VALUE=DATE:20261204",
          "DTEND;VALUE=DATE:20261207",
          "UID:abc123@google.com",
          "SUMMARY:Kizomba Festival Lissabon",
          "LOCATION:Lissabon\\, Portugal",
          "END:VEVENT",
        ].join("\r\n")
      )
    );
    expect(e).toEqual({
      uid: "abc123@google.com",
      summary: "Kizomba Festival Lissabon",
      location: "Lissabon, Portugal",
      startDate: "2026-12-04",
      endDate: "2026-12-06",
      allDay: true,
    });
  });

  it("endagshändelse utan DTEND", () => {
    const [e] = parseIcs(wrap("BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261224\r\nUID:x\r\nSUMMARY:Jul\r\nEND:VEVENT"));
    expect([e.startDate, e.endDate]).toEqual(["2026-12-24", "2026-12-24"]);
  });

  it("tidsatt med TZID: dagen läses i den zonens lokala tid", () => {
    const [e] = parseIcs(
      wrap(
        [
          "BEGIN:VEVENT",
          "DTSTART;TZID=Europe/Stockholm:20261205T200000",
          "DTEND;TZID=Europe/Stockholm:20261206T020000",
          "UID:t1",
          "SUMMARY:Dansjobb",
          "END:VEVENT",
        ].join("\r\n")
      )
    );
    expect([e.startDate, e.endDate, e.allDay]).toEqual(["2026-12-05", "2026-12-06", false]);
  });

  it("tidsatt i UTC räknas om till Stockholmstid", () => {
    const [e] = parseIcs(
      wrap("BEGIN:VEVENT\r\nDTSTART:20261205T233000Z\r\nDTEND:20261206T010000Z\r\nUID:u1\r\nSUMMARY:Sent\r\nEND:VEVENT")
    );
    // 23:30 UTC i december = 00:30 svensk tid nästa dag.
    expect([e.startDate, e.endDate]).toEqual(["2026-12-06", "2026-12-06"]);
  });

  it("slut exakt vid midnatt räknas inte som en extra dag", () => {
    const [e] = parseIcs(
      wrap(
        "BEGIN:VEVENT\r\nDTSTART;TZID=Europe/Stockholm:20261205T180000\r\nDTEND;TZID=Europe/Stockholm:20261206T000000\r\nUID:m1\r\nSUMMARY:Kväll\r\nEND:VEVENT"
      )
    );
    expect([e.startDate, e.endDate]).toEqual(["2026-12-05", "2026-12-05"]);
  });

  it("vecklar ut vikta rader (RFC 5545 3.1)", () => {
    const [e] = parseIcs(
      wrap(
        [
          "BEGIN:VEVENT",
          "DTSTART;VALUE=DATE:20270115",
          "UID:fold",
          "SUMMARY:Bachata-kurs för",
          "  nybörjare",
          "LOCATION:Studio",
          "\t 3",
          "END:VEVENT",
        ].join("\r\n")
      )
    );
    expect(e.summary).toBe("Bachata-kurs för nybörjare");
    expect(e.location).toBe("Studio 3");
  });

  it("hoppar över återkommande, undantag, inställda och händelser utan UID", () => {
    const events = parseIcs(
      wrap(
        [
          "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261201\r\nRRULE:FREQ=WEEKLY\r\nUID:r\r\nSUMMARY:Varje vecka\r\nEND:VEVENT",
          "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261208\r\nRECURRENCE-ID;VALUE=DATE:20261208\r\nUID:r\r\nSUMMARY:Undantag\r\nEND:VEVENT",
          "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261210\r\nSTATUS:CANCELLED\r\nUID:c\r\nSUMMARY:Inställt\r\nEND:VEVENT",
          "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261211\r\nSUMMARY:Utan uid\r\nEND:VEVENT",
          "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261212\r\nUID:ok\r\nSUMMARY:Kvar\r\nBEGIN:VALARM\r\nTRIGGER:-PT15M\r\nDESCRIPTION:Påminnelse\r\nEND:VALARM\r\nEND:VEVENT",
        ].join("\r\n")
      )
    );
    expect(events.map((e) => e.uid)).toEqual(["ok"]);
    expect(events[0].summary).toBe("Kvar");
  });

  it("tål LF-radbrytningar och kolon i värden", () => {
    const [e] = parseIcs(
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20270301\nUID:lf\nSUMMARY:Möte: planering\nEND:VEVENT\nEND:VCALENDAR"
    );
    expect(e.summary).toBe("Möte: planering");
  });
});

describe("unfoldLines", () => {
  it("slår ihop fortsättningsrader", () => {
    expect(unfoldLines("A:1\r\n 2\r\nB:3")).toEqual(["A:12", "B:3"]);
  });
});

describe("validateCalendarIcsUrl", () => {
  const good =
    "https://calendar.google.com/calendar/ical/pablo%40example.com/private-0123456789abcdef/basic.ics";

  it("godkänner Googles hemliga adress", () => {
    expect(validateCalendarIcsUrl(good)).toEqual({ ok: true, url: good });
    expect(validateCalendarIcsUrl(`  ${good}  `).ok).toBe(true);
  });

  it.each([
    ["http://calendar.google.com/calendar/ical/x/private-y/basic.ics", "protocol"],
    ["webcal://calendar.google.com/calendar/ical/x/private-y/basic.ics", "protocol"],
    ["https://evil.example.com/calendar/ical/x/private-y/basic.ics", "host"],
    ["https://calendar.google.com.evil.com/calendar/ical/x/basic.ics", "host"],
    ["https://169.254.169.254/calendar/ical/x/basic.ics", "host"],
    ["https://user:pw@calendar.google.com/calendar/ical/x/basic.ics", "credentials"],
    ["https://calendar.google.com:8443/calendar/ical/x/basic.ics", "port"],
    ["https://calendar.google.com/calendar/u/0/r", "path"],
    ["inte en adress", "invalid"],
  ])("avvisar %s (%s)", (url, reason) => {
    expect(validateCalendarIcsUrl(url)).toEqual({ ok: false, reason });
  });

  it("avvisar annat än strängar", () => {
    expect(validateCalendarIcsUrl(undefined)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("maskCalendarUrl", () => {
  it("lämnar inte ut nyckeln", () => {
    const masked = maskCalendarUrl(
      "https://calendar.google.com/calendar/ical/pablo%40example.com/private-0123456789abcdef/basic.ics"
    );
    expect(masked).toBe("calendar.google.com/…/private-••••cdef/…");
    expect(masked).not.toContain("0123456789");
    expect(masked).not.toContain("pablo");
  });
});

describe("guessCommitmentKind", () => {
  it("festival för festival/weekend/congress, annars annat", () => {
    expect(guessCommitmentKind("Stockholm Kizomba Festival")).toBe("festival");
    expect(guessCommitmentKind("Zouk Weekend Tallinn")).toBe("festival");
    expect(guessCommitmentKind("Salsa Congress")).toBe("festival");
    expect(guessCommitmentKind("Tandläkaren")).toBe("annat");
  });
});

describe("upcomingEvents", () => {
  const ev = (uid: string, startDate: string, endDate = startDate) => ({
    uid,
    summary: uid,
    location: null,
    startDate,
    endDate,
    allDay: true,
  });
  it("tar pågående och kommande inom 18 månader, sorterat", () => {
    const out = upcomingEvents(
      [ev("sen", "2028-06-01"), ev("past", "2026-11-01"), ev("b", "2027-02-01"), ev("pågår", "2026-11-19", "2026-11-22")],
      "2026-11-20"
    );
    expect(out.map((e) => e.uid)).toEqual(["pågår", "b"]);
  });
});
