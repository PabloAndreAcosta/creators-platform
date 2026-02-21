import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      {/* Hälsning */}
      <Skeleton className="mb-2 h-9 w-64" />
      <Skeleton className="mb-10 h-5 w-80" />

      {/* Quick stats */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6"
          >
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6"
          >
            <Skeleton className="mb-3 h-5 w-5 rounded" />
            <Skeleton className="mb-1 h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </>
  );
}
