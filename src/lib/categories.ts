export const CATEGORIES = [
  { value: "dance", label: "Dans" },
  { value: "music", label: "Musik" },
  { value: "photo", label: "Fotografi" },
  { value: "video", label: "Video" },
  { value: "design", label: "Design" },
  { value: "yoga", label: "Yoga" },
  { value: "fitness", label: "Fitness" },
  { value: "other", label: "Övrigt" },
] as const;

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

export type CategoryValue = (typeof CATEGORIES)[number]["value"];
