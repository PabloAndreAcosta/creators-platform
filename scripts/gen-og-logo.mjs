import sharp from "sharp";
import fs from "node:fs";

const SRC = "/Users/pabloacosta/Code/usha-logotyper/symbol/USHA_symbol_gradient.svg";
const OUT = "/Users/pabloacosta/Code/creators-platform/src/app/og-logo.ts";

const buf = await sharp(SRC, { density: 600 })
  .resize(412, 288, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

const b64 = buf.toString("base64");

const header = `// GENERERAD FIL — ändra inte för hand.
//
// Usha-märket som data-URI. Delningskortet ritas i edge-runtime, där det
// varken finns filsystem eller någon säker väg att hämta en bild över nätet
// vid renderingen: ett misslyckat anrop hade gett ett kort utan logga, och
// det upptäcks först när någon redan delat länken. Därför ligger bilden i
// koden.
//
// Källa: usha-logotyper/symbol/USHA_symbol_gradient.svg, renderad till
// 412x288 med genomskinlig botten — 3x av de 138x96 kortet visar den i, så
// den håller på en skärm med hög pixeltäthet.
//
// Görs om med scripts/gen-og-logo.mjs.
`;

fs.writeFileSync(OUT, `${header}export const USHA_MARK_PNG =\n  "data:image/png;base64,${b64}";\n`);
console.log(`skrivet  ${(buf.length / 1024).toFixed(1)} kB png  →  ${(b64.length / 1024).toFixed(1)} kB base64`);
