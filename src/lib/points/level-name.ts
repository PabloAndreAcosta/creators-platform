"use client";

import { useTranslations } from "next-intl";
import { MAX_LEVEL } from "./constants";

/**
 * Level names live under `serverNotifications` because the level-up
 * notification interpolates one into its sentence, and a name that exists in
 * two namespaces drifts. Everything that shows a level reads it from here.
 */
export function levelNameKey(level: number): string {
  return level >= 1 && level <= MAX_LEVEL ? `levelName${level}` : "";
}

/** `name(level)` → the level's title in the reader's language. */
export function useLevelName() {
  const t = useTranslations("serverNotifications");
  return (level: number) => {
    const key = levelNameKey(level);
    return key ? t(key) : t("levelNameGeneric", { level });
  };
}
