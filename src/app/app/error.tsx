"use client";

// Error boundary for the authenticated app area (/app/*). Renders inside the app
// shell so a crash in one screen shows a recoverable panel instead of a blank
// page. Reporting to Sentry and the report button live in ErrorScreen.
import { ErrorScreen } from "@/components/feedback/error-screen";

export default function AppError({
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
      home={{ href: "/app", label: "toApp" }}
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center"
    />
  );
}
