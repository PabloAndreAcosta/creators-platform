// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { EXCLUDE_ATTR, MASK_ATTR, SHOW_ATTR, blockText, includeInShot, maskClone, scrubSensitive } from "../mask";

/**
 * Maskeringstestet som juristen krävde före release (2026-11-25). Sidorna nedan
 * är förenklade kopior av de känsligaste vyerna: biljetten med QR-kod,
 * gästlistan i dörren, avräkningen och profilen. Efter maskering får INGEN
 * av de känsliga strängarna finnas kvar någonstans i kopian – inte i text,
 * fält, attribut eller bilder.
 */

const SECRETS = [
  "Anna Andersson",
  "anna.andersson@example.com",
  "070-123 45 67",
  "+46 70 123 45 67",
  "19900101-1234",
  "Storgatan 12",
  "BILJETT-7f3a9c",
  "12 450 kr",
  "Hej! Jag kommer sent",
  "data:image/png;base64,QRKOD",
  "https://cdn.usha.se/profil/anna.jpg",
];

function page(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.cloneNode(true) as HTMLElement;
}

function leaks(root: HTMLElement): string[] {
  const all = root.outerHTML;
  const fieldValues = Array.from(root.querySelectorAll("input, textarea")).map((f) => (f as HTMLInputElement).value);
  return SECRETS.filter((s) => all.includes(s) || fieldValues.some((v) => v.includes(s)));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("maskClone — inget känsligt följer med skärmbilden", () => {
  it("biljetten: QR-koden (img, canvas, stor svg) blir grå ruta, namn och biljett-id blir block", () => {
    const root = page(`
      <main>
        <h1>Anna Andersson</h1>
        <p>BILJETT-7f3a9c</p>
        <img src="data:image/png;base64,QRKOD" alt="Anna Andersson" style="width:240px;height:240px">
        <canvas width="240" height="240"></canvas>
        <svg width="240" height="240"><rect width="10" height="10"></rect><text>BILJETT-7f3a9c</text></svg>
      </main>`);
    maskClone(root);
    expect(leaks(root)).toEqual([]);
    expect(root.querySelectorAll("img, canvas").length).toBe(0);
    expect(root.querySelectorAll(`[${MASK_ATTR}]`).length).toBe(3);
    const box = root.querySelector(`[${MASK_ATTR}]`) as HTMLElement;
    expect(box.style.width).toBe("240px");
  });

  it("gästlistan och avräkningen: varje rad blir block", () => {
    const root = page(`
      <table>
        <tr><td>Anna Andersson</td><td>anna.andersson@example.com</td><td>070-123 45 67</td></tr>
        <tr><td>Totalt</td><td>12 450 kr</td></tr>
      </table>`);
    maskClone(root);
    expect(leaks(root)).toEqual([]);
    expect(root.textContent?.replace(/[\sxX0]/g, "")).toBe("");
  });

  it("formulär: fält töms, platshållare och val blir block", () => {
    const root = page(`
      <form>
        <input name="email" value="anna.andersson@example.com" placeholder="Anna Andersson">
        <textarea>Hej! Jag kommer sent</textarea>
        <select><option>Storgatan 12</option></select>
      </form>`);
    (root.querySelector("input") as HTMLInputElement).value = "anna.andersson@example.com";
    maskClone(root);
    expect(leaks(root)).toEqual([]);
  });

  it("attribut och bakgrundsbilder: title, aria-label, href och background-image tas bort", () => {
    const root = page(`
      <a href="mailto:anna.andersson@example.com" title="Anna Andersson" aria-label="070-123 45 67">x</a>
      <div style="background-image:url('https://cdn.usha.se/profil/anna.jpg');width:40px"></div>`);
    maskClone(root);
    expect(leaks(root)).toEqual([]);
  });

  it("undantaget [data-felrapport-visa]: rubriker står kvar, men e-post, telefon och personnummer maskas ändå", () => {
    const root = page(`
      <nav ${SHOW_ATTR}>
        <span>Biljetter</span>
        <span>anna.andersson@example.com</span>
        <span>+46 70 123 45 67</span>
        <span>19900101-1234</span>
        <span ${MASK_ATTR}>Anna Andersson</span>
      </nav>`);
    maskClone(root);
    expect(root.textContent).toContain("Biljetter");
    expect(leaks(root)).toEqual([]);
  });

  it("små ikoner (lucide) står kvar, så att knapparna går att känna igen", () => {
    const root = page(`<button><svg width="16" height="16"><path d="M0 0"></path></svg>Köp</button>`);
    maskClone(root);
    expect(root.querySelector("svg")).not.toBeNull();
    expect(root.textContent).not.toContain("Köp");
  });

  it("felknappen och formuläret tas bort ur bilden", () => {
    const root = page(`<div><button ${EXCLUDE_ATTR}>Något fungerar inte?</button><div ${EXCLUDE_ATTR}><textarea>Hej! Jag kommer sent</textarea></div></div>`);
    expect(includeInShot(root.querySelector(`[${EXCLUDE_ATTR}]`)!)).toBe(false);
    maskClone(root);
    expect(root.querySelectorAll(`[${EXCLUDE_ATTR}]`).length).toBe(0);
    expect(leaks(root)).toEqual([]);
  });
});

describe("hjälpfunktionerna", () => {
  it("blockText behåller mellanslag, radbrytningar och ungefär bredden, så att formen syns", () => {
    expect(blockText("Ab c\nd 12,5 Åsa")).toBe("Xx x\nx 00x0 Xxx");
  });

  it("scrubSensitive rör inte vanlig text", () => {
    expect(scrubSensitive("Köp biljett")).toBe("Köp biljett");
    expect(scrubSensitive("Ring 070-123 45 67")).not.toContain("123");
  });
});
