import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <>
      <div className="mb-8">
        <Skeleton className="mb-4 h-4 w-20" />
        <Skeleton className="mb-1 h-9 w-44" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>

      {/* Nuvarande plan */}
      <div className="mb-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-24" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Plan-kort */}
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8"
          >
            <Skeleton className="mb-1 h-7 w-24" />
            <Skeleton className="mb-6 h-4 w-full" />
            <div className="mb-6 flex items-baseline gap-1">
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="mb-8 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </>
  );
}
