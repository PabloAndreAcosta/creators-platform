/**
 * Maskering av skärmbilden i felrapporten (felknappen steg 2, juristen 2026-11-25).
 *
 * Maskering är standard, för alla roller: ALL text blir block, alla fält töms,
 * alla bilder, QR-koder, kanvasar, videor och inbäddningar blir grå rutor och
 * bakgrundsbilder tas bort. Kvar blir sidans form: var knappar, rutor och
 * fel sitter. Det räcker för att se att något ligger fel eller är tomt, och
 * gör att QR-koder (= giltiga biljetter), gästlistor, avräkningar, namn,
 * e-post, telefon, meddelanden och adresser aldrig följer med, oavsett vilken
 * roll den som rapporterar har.
 *
 * Undantag: text inom [data-felrapport-visa] (fasta rubriker och menyer utan
 * personuppgifter) får stå kvar, men även där maskas allt som ser ut som e-post,
 * telefon eller personnummer. [data-felrapport-maska] maskas alltid, även inuti
 * ett undantag. [data-felrapport-utesluten] (felknappen och formuläret) tas
 * bort helt.
 *
 * Körs på KOPIAN av sidan (modern-screenshot onCloneNode), aldrig på sidan själv.
 */

export const SHOW_ATTR = "data-felrapport-visa";
export const MASK_ATTR = "data-felrapport-maska";
export const EXCLUDE_ATTR = "data-felrapport-utesluten";

/** Små SVG:er är ikoner (lucide 16–24 px) och får stå kvar. */
const ICON_MAX_PX = 32;

const MEDIA = new Set(["IMG", "PICTURE", "VIDEO", "CANVAS", "IFRAME", "OBJECT", "EMBED", "AUDIO"]);
const FIELDS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

// E-post, telefon (svenska och internationella), personnummer och långa sifferserier.
const SENSITIVE: RegExp[] = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/g,
  /\b(19|20)?\d{6}[-+]?\d{4}\b/g,
  /(\+\d{1,3}[\s-]?)?(\(?0\d{1,3}\)?[\s-]?)\d{2,3}([\s-]?\d{2}){2,3}\b/g,
  /\+\d{1,3}([\s-]?\d{1,4}){2,5}/g,
  /\d{6,}/g,
];

/**
 * Byter varje tecken mot ett lika brett utfyllnadstecken (x, X, 0), så att
 * radlängder och radbrytningar blir som förut men inget går att läsa.
 */
export function blockText(s: string): string {
  return s.replace(/\p{Lu}/gu, "X").replace(/\p{N}/gu, "0").replace(/[^\sX0]/gu, "x");
}

export function scrubSensitive(s: string): string {
  return SENSITIVE.reduce((acc, re) => acc.replace(re, (m) => blockText(m)), s);
}

function isElement(n: Node): n is Element {
  return n.nodeType === 1;
}

function closestAttr(el: Element | null, attr: string): boolean {
  for (let e = el; e; e = e.parentElement) if (e.hasAttribute(attr)) return true;
  return false;
}

function px(v: string | null | undefined): number {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : NaN;
}

function isIcon(svg: Element): boolean {
  const style = (svg as HTMLElement).style;
  const w = px(style?.width) || px(svg.getAttribute("width"));
  const h = px(style?.height) || px(svg.getAttribute("height"));
  return Number.isFinite(w) && Number.isFinite(h) && w <= ICON_MAX_PX && h <= ICON_MAX_PX;
}

function greyBox(doc: Document, from: Element): HTMLElement {
  const box = doc.createElement("div");
  const css = (from as HTMLElement).style?.cssText;
  if (css) box.style.cssText = css;
  const w = from.getAttribute("width");
  const h = from.getAttribute("height");
  if (w && !box.style.width) box.style.width = /^\d+$/.test(w) ? `${w}px` : w;
  if (h && !box.style.height) box.style.height = /^\d+$/.test(h) ? `${h}px` : h;
  if (!box.style.display || box.style.display === "inline") box.style.display = "inline-block";
  box.style.setProperty("background-color", "#6b6b6b", "important");
  box.style.setProperty("opacity", "1", "important");
  box.style.setProperty("visibility", "visible", "important");
  box.style.backgroundImage = "none";
  box.setAttribute(MASK_ATTR, "");
  return box;
}

/** Maskerar kopian på plats. Returnerar antalet maskade delar (för tester och loggning). */
export function maskClone(root: Node): number {
  let masked = 0;
  const doc = root.ownerDocument ?? (root as Document);

  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      const parent = node.parentElement;
      const text = node.nodeValue ?? "";
      if (!text.trim()) return;
      const show = closestAttr(parent, SHOW_ATTR) && !closestAttr(parent, MASK_ATTR);
      const next = show ? scrubSensitive(text) : blockText(text);
      if (next !== text) {
        node.nodeValue = next;
        masked++;
      }
      return;
    }
    if (!isElement(node)) return;

    if (node.hasAttribute(EXCLUDE_ATTR)) {
      node.remove();
      masked++;
      return;
    }

    const tag = node.tagName.toUpperCase();
    if (MEDIA.has(tag) || (tag === "SVG" && !isIcon(node))) {
      node.replaceWith(greyBox(doc, node));
      masked++;
      return;
    }

    if (FIELDS.has(tag)) {
      const field = node as HTMLInputElement;
      if (tag === "SELECT") {
        node.querySelectorAll("option").forEach((o) => (o.textContent = blockText(o.textContent ?? "")));
      } else {
        const v = field.value ?? node.getAttribute("value") ?? "";
        field.value = "";
        node.removeAttribute("value");
        if (tag === "TEXTAREA") node.textContent = blockText(v);
        else if (v) node.setAttribute("value", blockText(v));
      }
      const ph = node.getAttribute("placeholder");
      if (ph) node.setAttribute("placeholder", blockText(ph));
      masked++;
    }

    const style = (node as HTMLElement).style;
    if (style?.backgroundImage && style.backgroundImage !== "none") {
      style.backgroundImage = "none";
      masked++;
    }
    for (const attr of ["title", "aria-label", "alt", "href", "data-value"]) {
      if (node.hasAttribute(attr)) node.removeAttribute(attr);
    }

    Array.from(node.childNodes).forEach(visit);
  };

  visit(root);
  return masked;
}

/** Filter till modern-screenshot: knappen och formuläret är aldrig med. */
export function includeInShot(node: Node): boolean {
  return !(isElement(node) && node.hasAttribute(EXCLUDE_ATTR));
}
