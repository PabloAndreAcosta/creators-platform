"use client";

import { LEVEL_COLORS, LEVEL_BG_COLORS, LEVEL_NAMES } from "@/lib/points/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-5 h-5 text-[10px]",
  md: "w-7 h-7 text-xs",
  lg: "w-10 h-10 text-sm",
};

export function LevelBadge({
  level,
  size = "sm",
  showName = false,
  className,
}: LevelBadgeProps) {
  const colorClass = LEVEL_COLORS[level] || LEVEL_COLORS[1];
  const bgClass = LEVEL_BG_COLORS[level] || LEVEL_BG_COLORS[1];
  const name = LEVEL_NAMES[level] || `Nivå ${level}`;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border font-bold",
          colorClass,
          bgClass,
          sizeClasses[size]
        )}
        title={name}
      >
        {level}
      </span>
      {showName && (
        <span className={cn("text-xs font-medium", colorClass)}>
          {name}
        </span>
      )}
    </span>
  );
}
