import { describe, it, expect } from "vitest";
import { buildNotifyAudience } from "../audience";

describe("buildNotifyAudience", () => {
  it("slår ihop arrangörens och lokalens följare", () => {
    const a = buildNotifyAudience({
      creatorFollowers: ["a", "b"],
      venueFollowers: ["c"],
      creatorId: "pablo",
      venueId: "bacchi",
    });
    expect(a).toEqual(["a", "b", "c"]);
  });

  it("mejlar bara en gång till den som följer båda", () => {
    // Den mest engagerade personen i registret. Två identiska mejl om samma
    // kväll är det snabbaste sättet att lära hen att ignorera oss.
    const a = buildNotifyAudience({
      creatorFollowers: ["a", "b"],
      venueFollowers: ["b", "c"],
      creatorId: "pablo",
      venueId: "bacchi",
    });
    expect(a).toEqual(["a", "b", "c"]);
  });

  it("mejlar inte arrangören om hens eget evenemang", () => {
    const a = buildNotifyAudience({
      creatorFollowers: ["pablo", "a"],
      creatorId: "pablo",
    });
    expect(a).toEqual(["a"]);
  });

  it("mejlar inte lokalen som just bekräftat kopplingen", () => {
    const a = buildNotifyAudience({
      creatorFollowers: ["a"],
      venueFollowers: ["bacchi", "b"],
      creatorId: "pablo",
      venueId: "bacchi",
    });
    expect(a).toEqual(["a", "b"]);
  });

  it("fungerar som förut när evenemanget saknar lokal", () => {
    // Regressionsskydd: de allra flesta evenemang har ingen kopplad lokal, och
    // för dem ska beteendet vara oförändrat.
    const a = buildNotifyAudience({ creatorFollowers: ["a", "b"], creatorId: "pablo" });
    expect(a).toEqual(["a", "b"]);
  });

  it("behåller ordningen: arrangörens följare först", () => {
    const a = buildNotifyAudience({
      creatorFollowers: ["a"],
      venueFollowers: ["b"],
      creatorId: "x",
      venueId: "y",
    });
    expect(a[0]).toBe("a");
  });

  it("klarar tomma listor och skräpvärden", () => {
    expect(buildNotifyAudience({ creatorFollowers: [], creatorId: "x" })).toEqual([]);
    expect(buildNotifyAudience({ creatorFollowers: ["", "a"], creatorId: "x" })).toEqual(["a"]);
  });
});

describe("lokalens omgång skickar inte dubbelt", () => {
  it("hoppar över den som redan fått mejl som arrangörens följare", () => {
    // Notisen sker i två omgångar vid olika tillfällen. Den som följer båda
    // fick sitt mejl i första omgången och ska inte få ett till när lokalen
    // godkänner dagen efter.
    const arrangorensFoljare = new Set(["a", "b"]);
    const lokalensFoljare = ["b", "c"];
    const kvar = lokalensFoljare.filter((id) => !arrangorensFoljare.has(id));

    const a = buildNotifyAudience({
      creatorFollowers: [],
      venueFollowers: kvar,
      creatorId: "pablo",
      venueId: "bacchi",
    });
    expect(a).toEqual(["c"]);
  });

  it("mejlar inte lokalen om dess eget godkännande", () => {
    const a = buildNotifyAudience({
      creatorFollowers: [],
      venueFollowers: ["bacchi", "c"],
      creatorId: "pablo",
      venueId: "bacchi",
    });
    expect(a).toEqual(["c"]);
  });
});
