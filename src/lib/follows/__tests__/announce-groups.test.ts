import { describe, it, expect } from "vitest";
import { groupForAnnouncement, announcementUrl, type AnnounceListing } from "../announce-groups";

function kvall(id: string, date: string | null, extra: Partial<AnnounceListing> = {}): AnnounceListing {
  return { id, user_id: "arr", title: "The Lab", event_date: date, event_location: "Bacchi", ...extra };
}

describe("följarmejlet grupperas per serie", () => {
  it("en serie med åtta kvällar blir ett utskick, inte åtta", () => {
    const rader = Array.from({ length: 8 }, (_, i) =>
      kvall(`l${i}`, `2026-12-${String(10 - i).padStart(2, "0")}`, { series_id: "s1", series_slug: "the-lab" })
    );
    const grupper = groupForAnnouncement(rader);
    expect(grupper).toHaveLength(1);
    expect(grupper[0].count).toBe(8);
    // Första datumet, inte första raden i frågan.
    expect(grupper[0].first.event_date).toBe("2026-12-03");
  });

  it("fristående kvällar förblir ett utskick var", () => {
    const grupper = groupForAnnouncement([kvall("a", "2026-12-01"), kvall("b", "2026-12-02")]);
    expect(grupper.map((g) => g.count)).toEqual([1, 1]);
  });

  it("blandar inte ihop olika serier eller olika avsändare", () => {
    const grupper = groupForAnnouncement([
      kvall("a", "2026-12-01", { series_id: "s1" }),
      kvall("b", "2026-12-08", { series_id: "s1" }),
      kvall("c", "2026-12-02", { series_id: "s2" }),
      kvall("d", "2026-12-03", { series_id: "s1", user_id: "annan" }),
    ]);
    expect(grupper.map((g) => g.count).sort()).toEqual([1, 1, 2]);
  });

  it("grupperar lokalens följare per lokal", () => {
    const rader = [
      kvall("a", "2026-12-01", { series_id: "s1", venue_profile_id: "v1" }),
      kvall("b", "2026-12-08", { series_id: "s1", venue_profile_id: "v1" }),
    ];
    expect(groupForAnnouncement(rader, (l) => l.venue_profile_id)).toHaveLength(1);
  });

  it("odaterade kvällar hamnar sist", () => {
    const [g] = groupForAnnouncement([kvall("a", null, { series_id: "s" }), kvall("b", "2026-12-01", { series_id: "s" })]);
    expect(g.listings.map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("länkar en serie till seriesidan och en ensam kväll till kvällen", () => {
    const [serie] = groupForAnnouncement([
      kvall("a", "2026-12-01", { series_id: "s", series_slug: "the-lab" }),
      kvall("b", "2026-12-08", { series_id: "s", series_slug: "the-lab" }),
    ]);
    expect(announcementUrl(serie, "https://usha.se")).toBe("https://usha.se/series/the-lab");

    const [ensam] = groupForAnnouncement([kvall("a", "2026-12-01", { series_id: "s", series_slug: "the-lab" })]);
    expect(announcementUrl(ensam, "https://usha.se")).toBe("https://usha.se/listing/a");

    const [utanSida] = groupForAnnouncement([
      kvall("a", "2026-12-01", { series_id: "s" }),
      kvall("b", "2026-12-08", { series_id: "s" }),
    ]);
    expect(announcementUrl(utanSida, "https://usha.se")).toBe("https://usha.se/listing/a");
  });
});
