"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ERROR_PAGE_KEYS, FEEDBACK_KEYS, type ErrorPageTexts, type FeedbackTexts } from "@/lib/feedback/texts";

export function useFeedbackTexts(): FeedbackTexts {
  const t = useTranslations("feedback");
  return useMemo(
    () => Object.fromEntries(FEEDBACK_KEYS.map((k) => [k, t(k)])) as FeedbackTexts,
    [t],
  );
}

export function useErrorPageTexts(): ErrorPageTexts {
  const t = useTranslations("errorPage");
  return useMemo(
    // "code" hämtas rå (med {code} kvar) och fylls i av felsidan.
    () => Object.fromEntries(ERROR_PAGE_KEYS.map((k) => [k, k === "code" ? t.raw(k) : t(k)])) as ErrorPageTexts,
    [t],
  );
}
