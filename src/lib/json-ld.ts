/**
 * Serialize an object for safe embedding inside an inline
 * <script type="application/ld+json"> tag.
 *
 * JSON.stringify alone does NOT escape `<`, `>` or `&`, so user-controlled
 * fields (listing titles, creator bios, place names, …) can break out of the
 * script element — e.g. a title containing `</script><img onerror=…>`. We
 * escape the HTML-significant characters plus the JS line separators
 * U+2028/U+2029 to neutralise that injection vector. Output remains valid JSON.
 */
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEP)
    .join("\\u2028")
    .split(PARA_SEP)
    .join("\\u2029");
}
