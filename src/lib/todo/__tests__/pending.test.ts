import { describe, it, expect } from "vitest";
import { pendingTodos } from "../pending";

describe("pendingTodos", () => {
  it("visar lokalens obesvarade förfrågningar", () => {
    // Marias fall: åtta kvällar väntade på hennes ja utan att något sa till.
    const [item] = pendingTodos({ venueRequestsPending: 8 });
    expect(item).toEqual({ key: "venueRequests", count: 8, href: "/app/venue-requests" });
  });

  it("visar arrangörens evenemang som väntar på lokalens ja", () => {
    const [item] = pendingTodos({ listingsAwaitingVenue: 8 });
    expect(item).toEqual({ key: "awaitingVenue", count: 8, href: "/app/events" });
  });

  it("sätter det som väntar på mig före det som väntar på någon annan", () => {
    // Jag kan agera på mina egna förfrågningar. Det andra kan jag bara vänta på.
    const keys = pendingTodos({ venueRequestsPending: 2, listingsAwaitingVenue: 5 }).map((i) => i.key);
    expect(keys).toEqual(["venueRequests", "awaitingVenue"]);
  });

  it("ger ingen post när ingenting väntar", () => {
    // Panelen ska försvinna helt, inte stå tom och säga "inget att göra".
    expect(pendingTodos({})).toEqual([]);
    expect(pendingTodos({ venueRequestsPending: 0, listingsAwaitingVenue: 0 })).toEqual([]);
  });

  it("tål saknade och orimliga värden i stället för att visa skräp", () => {
    // Räkningarna kommer från frågor som kan misslyckas och ge null.
    expect(pendingTodos({ venueRequestsPending: null })).toEqual([]);
    expect(pendingTodos({ venueRequestsPending: undefined })).toEqual([]);
    expect(pendingTodos({ venueRequestsPending: -3 })).toEqual([]);
    expect(pendingTodos({ venueRequestsPending: NaN })).toEqual([]);
    expect(pendingTodos({ venueRequestsPending: 2.7 })[0].count).toBe(2);
  });
});
