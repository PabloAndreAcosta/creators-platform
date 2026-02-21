import { cn } from "@/lib/utils";
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

export function NoBookings({ onExplore }: { onExplore?: () => void }) {
  return (
    <EmptyState
      icon={<Calendar size={28} />}
      title="Inga bokningar ännu"
      description="Du har inte bokat några tjänster. Utforska marketplace och boka något idag!"
      action={onExplore ? { label: "Utforska marketplace", onClick: onExplore } : undefined}
    />
  );
}

export function NoListings({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<List size={28} />}
      title="Inga tjänster ännu"
      description="Du har inte skapat några tjänster. Skapa din första tjänst för att synas i marketplace."
      action={onCreate ? { label: "Skapa tjänst", onClick: onCreate } : undefined}
    />
  );
}

export function NoCreators() {
  return (
    <EmptyState
      icon={<Users size={28} />}
      title="Inga kreatörer hittades"
      description="Vi kunde inte hitta några kreatörer med dina valda filter. Prova att ändra din sökning."
    />
  );
}

export function NoEvents() {
  return (
    <EmptyState
      icon={<Ticket size={28} />}
      title="Inga events att visa"
      description="Det finns inga events just nu. Kolla tillbaka senare!"
    />
  );
}

export function NoResults({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={<Search size={28} />}
      title="Ingen träff"
      description={
        query
          ? `Inga resultat för "${query}". Prova ett annat sökord.`
          : "Inga resultat matchade din sökning. Prova att ändra filtren."
      }
    />
  );
}
