import { Skeleton, RowSkeleton } from "@/components/ui/skeleton";

export default function BookingsLoading() {
  return (
    <>
      <div className="mb-8">
        <Skeleton className="mb-4 h-4 w-20" />
        <Skeleton className="mb-1 h-9 w-36" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      {/* Inkommande bokningar */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24 rounded-lg" />
                  <Skeleton className="h-9 w-20 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mina bokningar */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-36" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5"
            >
              <RowSkeleton />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
