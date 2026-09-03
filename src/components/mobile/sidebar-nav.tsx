"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  Ticket,
  BookOpen,
  User,
  Building2,
  MessageCircle,
  ScanLine,
  FileText,
  BookMarked,
  Trophy,
  CalendarDays,
  ShoppingBag,
  Users,
  ShieldCheck,
} from "lucide-react";
import { useRole } from "./role-context";
import { groupedDestinationsFor, ADMIN_ROOT, type NavRole } from "@/lib/navigation/registry";
import { useSubscription } from "@/lib/subscription/context";
import { LanguageSwitcher } from "@/components/language-switcher";
import UschjaLogo from "@/components/UschjaLogo";

export function SidebarNav() {
  const pathname = usePathname();
  const { role, hasAdminAccess } = useRole();
  const { tier } = useSubscription();
  const t = useTranslations("nav");
  const tAdmin = useTranslations("adminPage");
  const tTools = useTranslations("toolsPage");

  // Sidomenyn läser samma navigationsregister som Mer-griden. Tidigare hade
  // båda egna hårdkodade listor som drivit isär, så vad man kunde nå berodde
  // på skärmbredden — favoriter och analys fanns t.ex. bara på mobil.
  //
  // Listan renderas i grupper med små rubriker. Den var en platt rad på 17
  // poster för en lokal, och en platt lista i den längden läser man inte —
  // man skannar den och missar mitten. Grupperna finns redan i registret och
  // Mer-griden använder dem; sidomenyn gjorde det inte.
  const navRole: NavRole =
    role === "creator" ? "creator" : role === "venue" ? "venue" : "customer";
  const groups = groupedDestinationsFor(navRole, "sidebar").map((g) => ({
    group: g.group,
    // Hem hör inte under någon rubrik. Den ligger i createSell i registret för
    // att den måste ligga någonstans, men "Skapa & sälj: Hem" vore fel.
    items: g.items.filter((d) => d.path !== "/app"),
  }));
  const home = groupedDestinationsFor(navRole, "sidebar")
    .flatMap((g) => g.items)
    .find((d) => d.path === "/app");
  const GROUP_LABEL_KEY: Record<string, string> = {
    createSell: "groupCreateSell",
    finance: "groupFinance",
    explore: "groupExplore",
    myAccount: "groupMyAccount",
  };

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]"
        : "text-[var(--usha-muted)] hover:bg-[var(--usha-card)] hover:text-[var(--usha-white)]"
    }`;
  const activeFor = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 flex-shrink-0 sticky top-0 h-screen flex-col justify-between border-r border-[var(--usha-border)] bg-[var(--usha-black)]">
      <div>
        {/* Logo */}
        <a
          href="/app"
          aria-label="Usha Platform – hem"
          className="flex items-center gap-2.5 px-6 py-6 transition-opacity duration-150 active:opacity-50"
        >
          <UschjaLogo size={36} />
          <span className="text-xl font-bold tracking-tight">Usha Platform</span>
        </a>

        {/* Navigation */}
        <nav className="space-y-0.5 px-4">
          {home && (
            <Link href={home.path} className={linkClass(activeFor(home.path))}>
              <home.icon size={20} strokeWidth={activeFor(home.path) ? 2.5 : 1.5} />
              {t(home.navLabelKey!)}
            </Link>
          )}

          {groups.map(({ group, items }) =>
            items.length === 0 ? null : (
              <div key={group} className="pt-3 first:pt-1">
                <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--usha-muted)]/70">
                  {tTools(GROUP_LABEL_KEY[group])}
                </p>
                {items.map((d) => {
                  const isActive = activeFor(d.path);
                  return (
                    <Link key={d.path} href={d.path} className={linkClass(isActive)}>
                      <d.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                      {t(d.navLabelKey!)}
                    </Link>
                  );
                })}
              </div>
            )
          )}

          {/* Usha Shop — separate storefront on the shop.usha.se subdomain.
              External link, so a plain <a> (not next/link) and its own group. */}
          <div className="my-1.5 h-px bg-[var(--usha-border)]" />
          <a
            href="https://shop.usha.se"
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card)] hover:text-[var(--usha-white)]"
          >
            <ShoppingBag size={20} strokeWidth={1.5} />
            {t("shop")}
          </a>

          {/* Admin sits outside the role model, so it hangs off the registry's
              admin root rather than the role-filtered list above. Shown to
              anyone with any admin access — the hub then lists only the tools
              they hold. The flag arrives after mount (see role-context), so the
              entry appears a beat late; the pages check on the server anyway. */}
          {hasAdminAccess && (
            <Link
              href={ADMIN_ROOT}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                pathname.startsWith(ADMIN_ROOT)
                  ? "bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]"
                  : "text-[var(--usha-muted)] hover:bg-[var(--usha-card)] hover:text-[var(--usha-white)]"
              }`}
            >
              <ShieldCheck size={20} strokeWidth={pathname.startsWith(ADMIN_ROOT) ? 2.5 : 1.5} />
              {tAdmin("navLabel")}
            </Link>
          )}
        </nav>
      </div>

      {/* Language switcher at bottom */}
      <div className="px-4 pb-6">
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
