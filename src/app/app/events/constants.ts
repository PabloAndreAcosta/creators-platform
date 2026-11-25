// Dans, Musik, Performance och Yoga fanns bara i lib/categories.ts, så den som
// skapade en danskväll fick välja "Eventlokal" eller "Övrigt". Kvällen hamnade
// då utanför /upplevelser/<stad>/dance och Dans-räknaren, som läser
// listings.category = "dance". Värdena är desamma som i lib/categories.ts.
export const EVENT_CATEGORIES = [
  "dance",
  "music",
  "performance",
  "yoga",
  "day_party",
  "restaurant",
  "concert",
  "nightclub",
  "spa",
  "retreat",
  "venue",
  "fitness",
  "other",
] as const;

export const EVENT_CATEGORY_LABELS: Record<string, string> = {
  dance: "Dans",
  music: "Musik",
  performance: "Performance",
  yoga: "Yoga",
  day_party: "Dagfest",
  restaurant: "Restaurang",
  concert: "Konsert",
  nightclub: "Nattklubb",
  spa: "SPA & Wellness",
  retreat: "Retreat",
  venue: "Eventlokal",
  fitness: "Fitness",
  other: "Övrigt",
};
