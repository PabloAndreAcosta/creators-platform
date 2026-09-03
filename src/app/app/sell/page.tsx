import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Layers } from "lucide-react";
import { isVenueRole } from "@/lib/roles";
import { destinationsFor, type NavRole } from "@/lib/navigation/registry";

export const dynamic = "force-dynamic";

/**
 * Utbud — allt du kan sälja, på ett ställe.
 *
 * Menyerna hade fem jämlika rader för det här: Tjänster, Produkter, Kurser,
 * Gigs och Öppna uppdrag. Tre av dem hade noll rader i databasen, och Tjänster
 * visade exakt samma lista som Evenemang (samma tabell, samma filter — bara
 * två renderingar). Fem rader som kräver att man redan vet vad man ska kalla
 * det man säljer är fem chanser att välja fel.
 *
 * Hellre ett klick till med valen framför sig. Rutorna kommer ur samma
 * navigationsregister som sidomenyn och Mer-griden, så en ny säljbar sak
 * hamnar här av sig själv, och antalen står på rutorna så att man ser vad man
 * faktiskt har innan man klickar.
 */
export default async function SellPage() {
  const t = await getTranslations("toolsPage");
  const tSell = await getTranslations("sellPage");

  let role: NavRole = "customer";
  const counts: Record<string, number> = {};

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const dbRole = (data?.role as string) ?? "customer";
      role = isVenueRole(dbRole) ? "venue" : dbRole === "creator" ? "creator" : "customer";

      // Antalen. En tom ruta ska säga att den är tom, inte se likadan ut som en
      // med tio poster i — det var halva förvirringen med fem likadana rader.
      const [listings, products, gigsOut, gigsOpen] = await Promise.all([
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("digital_products").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
        supabase.from("gigs").select("id", { count: "exact", head: true }).eq("arranger_id", user.id),
        supabase.from("gigs").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      // Evenemang och Tjänster läser samma tabell. Att visa samma siffra på båda
      // rutorna är inte en bugg här — det är den ärliga bilden av att de ännu
      // är två vyer av en och samma lista.
      counts["/app/events"] = listings.count ?? 0;
      counts["/dashboard/listings"] = listings.count ?? 0;
      counts["/dashboard/products"] = products.count ?? 0;
      counts["/app/courses"] = products.count ?? 0;
      counts["/dashboard/gigs"] = gigsOut.count ?? 0;
      counts["/app/gigs"] = gigsOpen.count ?? 0;
    }
  } catch {
    // Hellre rutor utan siffror än ingen sida alls.
  }

  const items = destinationsFor(role, "sell");

  return (
    <div className="px-4 py-6">
      <div className="mb-2 flex items-center gap-2">
        <Layers size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-2xl font-bold">{tSell("heading")}</h1>
      </div>
      <p className="mb-6 text-sm text-[var(--usha-muted)]">{tSell("intro")}</p>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--usha-muted)]">{tSell("empty")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const count = counts[item.path];
            return (
              <Link
                key={item.path}
                href={item.path}
                className="flex items-start gap-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
                  <item.icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold leading-tight text-[var(--usha-white)]">
                      {t(item.labelKey!)}
                    </span>
                    {count !== undefined && (
                      <span className="text-xs text-[var(--usha-muted)]">
                        {count === 0 ? tSell("none") : tSell("count", { count })}
                      </span>
                    )}
                  </span>
                  {item.descKey && (
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--usha-muted)]">
                      {t(item.descKey)}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
