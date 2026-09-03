import { describe, it, expect } from "vitest";
import {
  eventPath,
  eventShareUrl,
  formatShareWhen,
  buildShareSummary,
  buildShareMessage,
  nativeShareText,
} from "../share";

const LAB = {
  id: "9b49b2f5-cfb1-4352-a553-37c39842fafc",
  slug: "the-lab-tarraxo-urban-kizomba-2026-09-07",
  title: "The Lab - Tarraxo & Urban Kizomba",
};

describe("eventPath", () => {
  it("pekar på evenemangssidan, inte på arrangörens profil", () => {
    // Det var buggen: delningen skickade mottagaren till /creators/<uuid>,
    // där det inte går att köpa biljett till just den här kvällen.
    expect(eventPath(LAB)).toBe("/event/the-lab-tarraxo-urban-kizomba-2026-09-07");
  });

  it("faller tillbaka på id när slug saknas", () => {
    // Återkommande tillfällen skapas ibland utan egen slug.
    expect(eventPath({ id: "abc", slug: null })).toBe("/event/abc");
    expect(eventPath({ id: "abc", slug: "   " })).toBe("/event/abc");
  });
});

describe("eventShareUrl", () => {
  it("använder sidans origin när det finns", () => {
    expect(eventShareUrl(LAB, "https://usha.se")).toBe(
      "https://usha.se/event/the-lab-tarraxo-urban-kizomba-2026-09-07"
    );
  });

  it("faller tillbaka på usha.se vid server-rendering", () => {
    // window finns inte på servern; en relativ länk är oanvändbar i en chatt.
    expect(eventShareUrl(LAB, "")).toMatch(/^https:\/\/usha\.se\/event\//);
    expect(eventShareUrl(LAB, null)).toMatch(/^https:\/\/usha\.se\/event\//);
  });

  it("dubblar inte snedstrecket", () => {
    expect(eventShareUrl(LAB, "https://usha.se/")).not.toContain("se//event");
  });
});

describe("formatShareWhen", () => {
  // Exakt formatering kommer från ICU och kan skilja mellan Node-versioner —
  // testa innehållet, inte tecken för tecken.
  it("skriver kort datum och tid", () => {
    const when = formatShareWhen("2026-09-07", "17:00:00", "sv")!;
    expect(when).toMatch(/mån/);
    expect(when).toMatch(/7 sep/);
    expect(when).toMatch(/ · 17:00$/);
    expect(when).not.toMatch(/2026/); // årtalet stjäl plats utan att tillföra något
  });

  it("klarar datum utan tid och tid utan datum", () => {
    expect(formatShareWhen("2026-09-07", null, "sv")).toMatch(/^mån 7 sep/);
    expect(formatShareWhen("2026-09-07", null, "sv")).not.toContain("·");
    expect(formatShareWhen(null, "17:00", "sv")).toBe("17:00");
  });

  it("ger null när ingetdera finns", () => {
    expect(formatShareWhen(null, null)).toBeNull();
    expect(formatShareWhen("inte-ett-datum", null)).toBeNull();
  });
});

describe("buildShareSummary", () => {
  const parts = {
    title: "The Lab - Tarraxo & Urban Kizomba",
    when: "mån 7 sep · 17:00",
    where: "Bacchi Syre",
    price: "Från 50 kr",
  };

  it("håller sig till tre rader", () => {
    expect(buildShareSummary(parts).split("\n")).toEqual([
      "The Lab - Tarraxo & Urban Kizomba",
      "mån 7 sep · 17:00 · Bacchi Syre",
      "Från 50 kr",
    ]);
  });

  it("hoppar över rader som saknas i stället för att lämna skiljetecken", () => {
    // Tomma fält får inte bli " · " eller en blankrad mitt i meddelandet.
    expect(buildShareSummary({ title: "Kväll", when: null, where: null, price: null })).toBe(
      "Kväll"
    );
    expect(buildShareSummary({ title: "Kväll", when: "", where: "Bacchi Syre" })).toBe(
      "Kväll\nBacchi Syre"
    );
  });
});

describe("buildShareMessage", () => {
  it("lägger länken sist och ensam på sin rad", () => {
    // En länk som står mitt i en textmassa syns inte och är svår att träffa.
    const msg = buildShareMessage({ title: "Kväll", when: "mån 7 sep" }, "https://usha.se/event/x");
    expect(msg.split("\n").at(-1)).toBe("https://usha.se/event/x");
    expect(msg).toContain("\n\nhttps://");
  });
});

describe("nativeShareText", () => {
  it("slutar med radbrytning så Chrome inte klistrar länken i sista meningen", () => {
    // Chrome på Android fogar ihop text och url med ett mellanslag.
    const text = nativeShareText({ title: "Kväll", when: "mån 7 sep" });
    expect(text.endsWith("\n")).toBe(true);
    const pasted = `${text} https://usha.se/event/x`;
    expect(pasted.split("\n").at(-1)?.trim()).toBe("https://usha.se/event/x");
  });

  it("bär aldrig med sig eventbeskrivningen", () => {
    // Beskrivningen hör hemma på sidan länken går till.
    expect(nativeShareText({ title: "Kväll" }).length).toBeLessThan(200);
  });
});
