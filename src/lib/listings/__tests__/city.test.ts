import { describe, it, expect } from "vitest";
import { cityFromAddress, resolveEventCity } from "../city";

describe("cityFromAddress", () => {
  it("läser orten efter postnumret", () => {
    expect(
      cityFromAddress("Järfälla Kampsport Klubb, Fänriksvägen 1, 177 43 Järfälla, Sverige")
    ).toBe("Järfälla");
  });

  it("klarar postnummer utan mellanslag", () => {
    expect(cityFromAddress("Värmeverket, Bredängsvägen 203, 12734 Skärholmen, Sverige")).toBe(
      "Skärholmen"
    );
  });

  it("ger null när adressen saknar postnummer", () => {
    // Den här är poängen: utan postnummer vore sista ledet "Gamla stan",
    // som är en stadsdel och inte en ort.
    expect(cityFromAddress("Bacchi Syre, Järntorgsgatan 5, Gamla stan")).toBeNull();
  });

  it("tar inte landet för en stad", () => {
    expect(cityFromAddress("Någon gata 1, 111 11 Sverige")).toBeNull();
  });

  it("ger null för tomt och saknat värde", () => {
    expect(cityFromAddress(null)).toBeNull();
    expect(cityFromAddress("")).toBeNull();
    expect(cityFromAddress("   ")).toBeNull();
  });

  it("avstår när träffen är en hel mening", () => {
    expect(cityFromAddress("Ring 070 12 34 567 för vägbeskrivning till lokalen")).toBeNull();
  });
});

describe("resolveEventCity", () => {
  it("behåller stad från platsväljaren", () => {
    expect(resolveEventCity("Stockholm", "Någonstans, 177 43 Järfälla, Sverige")).toBe("Stockholm");
  });

  it("faller tillbaka på adressen när staden är tom", () => {
    expect(resolveEventCity("  ", "Lokalen, Gatan 1, 177 43 Järfälla, Sverige")).toBe("Järfälla");
  });

  it("ger null när varken stad eller adress bär en ort", () => {
    expect(resolveEventCity(null, "Bacchi Syre, Järntorgsgatan 5, Gamla stan")).toBeNull();
  });
});
