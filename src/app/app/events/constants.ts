export const EVENT_CATEGORIES = [
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
