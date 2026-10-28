import { describe, it, expect } from "vitest";
import { seriesRepresentative } from "../series-representative";

const kvall = (title: string, event_date: string | null) => ({ title, event_date });

describe("seriesRepresentative", () => {
  it("låter aldrig en inställd premiär tala för serien", () => {
    const r = seriesRepresentative(
      [
        kvall("INSTÄLLT: The Lab Torsdag", "2026-09-24"),
        kvall("The Lab Torsdag – Practica", "2026-11-05"),
      ],
      "2026-10-28"
    );
    expect(r?.title).toBe("The Lab Torsdag – Practica");
  });

  it("väljer den bortersta kommande kvällen, inte en engångsavvikelse närmast", () => {
    const r = seriesRepresentative(
      [
        kvall("The Lab Torsdag – Open Session", "2026-10-29"),
        kvall("The Lab Torsdag – Practica", "2026-11-05"),
        kvall("The Lab Torsdag – Practica", "2026-11-19"),
      ],
      "2026-10-28"
    );
    expect(r?.event_date).toBe("2026-11-19");
  });

  it("hoppar över en inställd sista kväll", () => {
    const r = seriesRepresentative(
      [kvall("The Lab", "2026-11-05"), kvall("INSTÄLLT: The Lab", "2026-11-12")],
      "2026-10-28"
    );
    expect(r?.event_date).toBe("2026-11-05");
  });

  it("visar en avslutad serie som den senaste kvällen som blev av", () => {
    const r = seriesRepresentative(
      [kvall("The Lab", "2026-09-01"), kvall("The Lab", "2026-09-08"), kvall("INSTÄLLT: The Lab", "2026-09-15")],
      "2026-10-28"
    );
    expect(r?.event_date).toBe("2026-09-08");
  });

  it("faller tillbaka på första kvällen när allt är inställt", () => {
    const r = seriesRepresentative([kvall("INSTÄLLT: A", "2026-09-01"), kvall("INSTÄLLT: B", "2026-09-08")], "2026-10-28");
    expect(r?.title).toBe("INSTÄLLT: A");
  });
});
