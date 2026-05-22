import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import { Calendar, List, Users, Search, Ticket } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--usha-border)] bg-[var(--usha-card)]/40 px-6 py-16 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--usha-card)] text-[var(--usha-muted)]">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-base font-semibold">{title}</h3>
      <p className="mb-6 max-w-xs text-sm text-[var(--usha-muted)]">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export async function NoBookings({ onExplore }: { onExplore?: () => void }) {
  const t = await getTranslations("emptyState");
  return (
    <EmptyState
      icon={<Calendar size={28} />}
      title={t("noBookingsTitle")}
      description={t("noBookingsDescription")}
      action={onExplore ? { label: t("noBookingsAction"), onClick: onExplore } : undefined}
    />
  );
}

export async function NoListings({ onCreate }: { onCreate?: () => void }) {
  const t = await getTranslations("emptyState");
  return (
    <EmptyState
      icon={<List size={28} />}
      title={t("noListingsTitle")}
      description={t("noListingsDescription")}
      action={onCreate ? { label: t("noListingsAction"), onClick: onCreate } : undefined}
    />
  );
}

export async function NoCreators() {
  const t = await getTranslations("emptyState");
  return (
    <EmptyState
      icon={<Users size={28} />}
      title={t("noCreatorsTitle")}
      description={t("noCreatorsDescription")}
    />
  );
}

export async function NoEvents() {
  const t = await getTranslations("emptyState");
  return (
    <EmptyState
      icon={<Ticket size={28} />}
      title={t("noEventsTitle")}
      description={t("noEventsDescription")}
    />
  );
}

export async function NoResults({ query }: { query?: string }) {
  const t = await getTranslations("emptyState");
  return (
    <EmptyState
      icon={<Search size={28} />}
      title={t("noResultsTitle")}
      description={
        query
          ? t("noResultsWithQuery", { query })
          : t("noResultsDescription")
      }
    />
  );
}
