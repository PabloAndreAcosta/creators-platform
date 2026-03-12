export const EVENT_CATEGORIES = [
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
  restaurant: "Restaurang",
  concert: "Konsert",
  nightclub: "Nattklubb",
  spa: "SPA & Wellness",
  retreat: "Retreat",
  venue: "Eventlokal",
  fitness: "Fitness",
  other: "Övrigt",
};
