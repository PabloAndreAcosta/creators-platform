"use client";

import { ErrorScreen } from "@/components/feedback/error-screen";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center"
    />
  );
}
