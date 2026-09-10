import { getTranslations } from "next-intl/server";
import { Facebook, Instagram, Music2 } from "lucide-react";
import { getSocialLinks } from "@/lib/follows/social-links";

/**
 * "Följ oss" – Ushas egna kanaler. Renderas bara för de kanaler som har en
 * adress i app_config.social_links.
 */
export async function FollowUs({ className = "" }: { className?: string }) {
  const links = await getSocialLinks();
  const items = [
    { key: "facebook" as const, href: links.facebook, Icon: Facebook },
    { key: "instagram" as const, href: links.instagram, Icon: Instagram },
    { key: "tiktok" as const, href: links.tiktok, Icon: Music2 },
  ].filter((i): i is typeof i & { href: string } => !!i.href);
  if (items.length === 0) return null;

  const t = await getTranslations("followUs");
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--usha-muted)]">{t("heading")}</span>
      {items.map(({ key, href, Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer me"
          aria-label={t(key)}
          title={t(key)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--usha-border)] text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/50 hover:text-[var(--usha-gold)]"
        >
          <Icon size={16} />
        </a>
      ))}
    </div>
  );
}
