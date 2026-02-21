import { Skeleton, CircleSkeleton, TextSkeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <>
      <div className="mb-8">
        <Skeleton className="mb-4 h-4 w-20" />
        <Skeleton className="mb-1 h-9 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
        <div className="flex flex-col gap-8">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <CircleSkeleton size="lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>

          {/* Form fält */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-28 w-full rounded-md" />
          </div>

          {/* Knapp */}
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>
    </>
  );
}
