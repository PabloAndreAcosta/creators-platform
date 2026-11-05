import Image from "next/image";
import type { CrewMember } from "@/lib/taxi/crew";

/**
 * Kvällens taxidansare och instruktörer med bild och förnamn.
 * "full" på evenemangssidan (med passtider), "compact" i listor.
 * Etiketterna kommer från anroparen så komponenten fungerar i alla namnrymder.
 */
export function EveningCrew({
  crew,
  labels,
  variant = "compact",
}: {
  crew: CrewMember[];
  labels: { taxi_dancer: string; instructor: string; collaborator?: string; hint?: string };
  variant?: "full" | "compact";
}) {
  if (!crew.length) return null;
  const groups = (["taxi_dancer", "instructor", "collaborator"] as const)
    .map((role) => ({ role, people: crew.filter((c) => c.role === role) }))
    .filter((g) => g.people.length && labels[g.role]);
  const big = variant === "full";
  return (
    <div className={big ? "mt-5 space-y-3 rounded-xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-4" : "mt-2 space-y-1.5"}>
      {groups.map((g) => (
        <div key={g.role} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className={`${big ? "text-xs" : "text-[10px]"} font-semibold uppercase tracking-wider text-[var(--usha-gold)]`}>
            {labels[g.role]}
          </span>
          {g.people.map((p, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-border)] bg-[var(--usha-card)] ${big ? "py-1 pl-1 pr-3 text-sm" : "py-0.5 pl-0.5 pr-2 text-xs"}`}
            >
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <Image src={p.avatarUrl} alt="" width={big ? 32 : 20} height={big ? 32 : 20} className={`${big ? "h-8 w-8" : "h-5 w-5"} rounded-full object-cover`} />
              ) : (
                <span
                  className={`flex ${big ? "h-8 w-8 text-xs" : "h-5 w-5 text-[10px]"} items-center justify-center rounded-full bg-[var(--usha-gold)]/20 font-bold text-[var(--usha-gold)]`}
                >
                  {p.firstName.charAt(0)}
                </span>
              )}
              <span className="font-medium text-[var(--usha-white)]">{p.firstName}</span>
              {big && p.times.length > 0 && <span className="text-xs text-[var(--usha-muted)]">{p.times.join(", ")}</span>}
            </span>
          ))}
        </div>
      ))}
      {big && labels.hint && <p className="text-xs text-[var(--usha-muted)]">{labels.hint}</p>}
    </div>
  );
}
