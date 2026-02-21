import { cn } from "@/lib/utils";

// Base shimmer skeleton
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-label="Laddar..."
      {...props}
    />
  );
}

// Card skeleton — for event cards, listings, bookings (250×350px)
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-lg border border-border p-4", className)}
      aria-label="Laddar..."
    >
      <Skeleton className="h-[180px] w-full rounded-md" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex justify-between">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <Skeleton className="h-10 w-full mt-2 rounded-md" />
    </div>
  );
}

// Row skeleton — for table rows and list items
function RowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-4 py-3 px-2", className)}
      aria-label="Laddar..."
    >
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
    </div>
  );
}

// Circle skeleton — for avatars
function CircleSkeleton({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-10 w-10",
    md: "h-[60px] w-[60px]",
    lg: "h-[100px] w-[100px]",
  };
  return (
    <Skeleton
      className={cn("rounded-full", sizes[size], className)}
      aria-label="Laddar..."
    />
  );
}

// Text skeleton — for text content blocks
function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-4/5", "w-3/5", "w-full", "w-2/3", "w-1/2"];
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-label="Laddar...">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", widths[i % widths.length])}
        />
      ))}
    </div>
  );
}

export { Skeleton, CardSkeleton, RowSkeleton, CircleSkeleton, TextSkeleton };
