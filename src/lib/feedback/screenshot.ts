/**
 * Skärmbilden till felrapporten. Ritas i webbläsaren av modern-screenshot (Sentrys
 * egen skärmdump fungerar inte på mobil eller i appskalet), på en maskerad
 * kopia av sidan (mask.ts). Bara det synliga fönstret, som JPEG under 300 kB.
 *
 * Tas först när användaren kryssar i rutan och skickas först när hen trycker
 * Skicka (juristen: inget skickas före klicket). Inget sparas i webbläsaren.
 */
import { includeInShot, maskClone } from "./mask";

export const MAX_SCREENSHOT_BYTES = 300 * 1024;

export type Screenshot = { bytes: Uint8Array; dataUrl: string };

function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Fönstret som syns just nu, maskerat. null om det inte gick eller blev för stort. */
export async function captureMaskedScreenshot(win: Window = window): Promise<Screenshot | null> {
  const { domToJpeg } = await import("modern-screenshot");
  const doc = win.document;
  const width = win.innerWidth;
  const height = win.innerHeight;
  const bg = win.getComputedStyle(doc.body).backgroundColor || "#000";

  // Börja skarpt nog att läsa formen, sänk tills bilden är under taket.
  for (const [scale, quality] of [
    [1, 0.7],
    [0.75, 0.6],
    [0.5, 0.5],
  ] as const) {
    try {
      const dataUrl = await domToJpeg(doc.documentElement, {
        width,
        height,
        scale,
        quality,
        backgroundColor: bg,
        filter: includeInShot,
        onCloneNode: (clone) => {
          maskClone(clone);
          // Visa just den del av sidan som syns i fönstret.
          const el = clone as HTMLElement;
          if (el.style) {
            el.style.transform = `translate(${-win.scrollX}px, ${-win.scrollY}px)`;
            el.style.overflow = "hidden";
          }
        },
        timeout: 5000,
      });
      const bytes = dataUrlBytes(dataUrl);
      if (bytes.byteLength <= MAX_SCREENSHOT_BYTES) return { bytes, dataUrl };
    } catch (e) {
      console.error("Felrapportens skärmbild misslyckades:", e);
      return null;
    }
  }
  return null;
}
