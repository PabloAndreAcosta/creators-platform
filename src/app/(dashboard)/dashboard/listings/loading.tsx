import { Skeleton, RowSkeleton } from "@/components/ui/skeleton";

export default function ListingsLoading() {
  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Skeleton className="mb-4 h-4 w-20" />
          <Skeleton className="mb-1 h-9 w-40" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5"
          >
            <RowSkeleton />
          </div>
        ))}
      </div>
    </>
  );
}
