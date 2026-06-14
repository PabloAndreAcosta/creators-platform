import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

type Key = "creators" | "venues" | "audience";

/** Cross-links at the bottom of each perspective page: the other two
 *  perspectives + back to the hub (home). Keeps the four pages connected. */
export function PerspectiveLinks({ exclude }: { exclude?: Key }) {
  const t = useTranslations("perspectiveLinks");

  const all: { key: Key; href: string }[] = [
    { key: "creators", href: "/for-kreatorer" },
    { key: "venues", href: "/for-platser" },
    { key: "audience", href: "/for-publik" },
  ];
  const links = all.filter((l) => l.key !== exclude);

  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-2 text-sm font-medium transition hover:border-[var(--usha-gold)]/40 hover:text-[var(--usha-white)]";

  return (
    <section className="py-12 px-4 sm:py-16 sm:px-6">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="mb-6 text-xl font-bold tracking-tight sm:text-2xl">{t("heading")}</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {links.map((l) => (
            <a key={l.key} href={l.href} className={chip}>
              {t(l.key)} <ArrowRight size={14} />
            </a>
          ))}
          <a href="/" className={chip}>{t("hub")}</a>
        </div>
      </div>
    </section>
  );
}
