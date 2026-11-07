/** Klientsäkra bitar: ingen node-import här. */
export const TEMPLATE_KEYS = ["cohost", "gig", "venue", "free"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** Ersätter {platshållare} i mallen med parternas och kvällens uppgifter. */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}
