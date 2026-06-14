export const CATEGORIES = [
  { value: "dance", label: "Dans" },
  { value: "music", label: "Musik" },
  { value: "performance", label: "Performance" },
  { value: "photo", label: "Fotografi" },
  { value: "video", label: "Video" },
  { value: "design", label: "Design" },
  { value: "yoga", label: "Yoga" },
  { value: "fitness", label: "Fitness" },
  { value: "other", label: "Övrigt" },
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])),
  // Taxonomy values that exist in listing data but are not user-selectable
  // categories (so they're excluded from CATEGORIES/pickers/filters), yet still
  // need a human label so they never render as a raw key.
  venue: "Lokal",
  wellness: "Wellness",
};

export type CategoryValue = (typeof CATEGORIES)[number]["value"];
