/**
 * Datum då stycket om ansvar mot näringsidkare i villkoren (punkt 7) börjar gälla.
 *
 * P2B-förordningen (EU) 2019/1150 art. 3.2: ändrade villkor för företagsanvändare
 * (säljare och lokaler) får börja gälla tidigast 15 dagar efter att de har fått
 * ändringen på ett varaktigt medium, alltså mejl. Fram till datumet gäller det
 * tidigare taket, och det står i texten själv.
 *
 * Byt "[DATUM]" mot ett datum, till exempel "2026-12-15", när mejlet till
 * säljarna har gått ut. Samma sträng visas på sv, en och es, så använd ÅÅÅÅ-MM-DD.
 */
export const TERMS_S7_BUSINESS_EFFECTIVE_DATE = "[DATUM]";
