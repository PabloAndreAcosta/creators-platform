"use client";

// Root segment error boundary. Catches render/runtime errors thrown anywhere in
// the app tree that a nested error.tsx doesn't handle. It renders inside the
// root layout, so the root IntlProvider is there for the texts. Reporting to
// Sentry and the "Rapportera felet" button live in ErrorScreen.
import { ErrorScreen } from "@/components/feedback/error-screen";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen error={error} reset={reset} home={{ href: "/", label: "home" }} />;
}
