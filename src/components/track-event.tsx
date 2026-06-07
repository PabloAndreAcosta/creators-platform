"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

type Params = Record<string, string | number | boolean | undefined>;

export function TrackEvent({ name, params }: { name: string; params?: Params }) {
  useEffect(() => {
    trackEvent(name, params);
  }, [name, params]);
  return null;
}
