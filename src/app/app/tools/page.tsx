import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Package, CalendarCheck, CalendarDays, ScanLine, Briefcase, BookOpen, Building2,
  Wallet, BarChart3, CreditCard, Tag,
  Search, Store, FileText, Heart, Trophy, ShoppingBag,
  Ticket, MessageCircle, BookMarked, Gift, Bell, User, Settings, LayoutGrid, Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Verktyg – Usha Platform" };

interface Tool {
  href: string;
  labelKey: string;
  descKey?: string;
  icon: LucideIcon;
}
interface Group {
  titleKey: string;
  items: Tool[];
}

const creatorGroups: Group[] = [
  {
    titleKey: "groupCreateSell",
    items: [
      { href: "/dashboard/listings", labelKey: "servicesLabel", descKey: "servicesDesc", icon: Package },
      { href: "/dashboard/bookings", labelKey: "bookingsLabel", descKey: "bookingsDesc", icon: CalendarCheck },
      { href: "/app/calendar", labelKey: "calendarLabel", descKey: "calendarDesc", icon: CalendarDays },
      { href: "/app/scan", labelKey: "scanLabel", descKey: "scanDesc", icon: ScanLine },
      { href: "/dashboard/gigs", labelKey: "gigsLabel", descKey: "gigsDesc", icon: Briefcase },
      { href: "/app/events", labelKey: "eventsLabel", descKey: "eventsDesc", icon: Building2 },
      { href: "/app/courses", labelKey: "coursesLabel", descKey: "coursesDesc", icon: BookOpen },
      { href: "/app/events/insights", labelKey: "statisticsLabel", descKey: "statisticsDesc", icon: BarChart3 },
    ],
  },
  {
    titleKey: "groupFinance",
    items: [
      { href: "/dashboard/payouts", labelKey: "payoutsLabel", descKey: "payoutsDesc", icon: Wallet },
      { href: "/dashboard/analytics", labelKey: "analyticsLabel", descKey: "analyticsDesc", icon: BarChart3 },
      { href: "/dashboard/billing", labelKey: "billingLabel", descKey: "billingDesc", icon: CreditCard },
      { href: "/dashboard/promo-codes", labelKey: "promoCodesLabel", descKey: "promoCodesDesc", icon: Tag },
    ],
  },
];

const sharedGroups: Group[] = [
  {
    titleKey: "groupExplore",
    items: [
      { href: "/app/search", labelKey: "searchLabel", descKey: "searchDesc", icon: Search },
      { href: "/app/training-buddies", labelKey: "trainingBuddiesLabel", descKey: "trainingBuddiesDesc", icon: Users },
      { href: "/marketplace", labelKey: "marketplaceLabel", descKey: "marketplaceDesc", icon: Store },
      { href: "https://shop.usha.se", labelKey: "shopLabel", descKey: "shopDesc", icon: ShoppingBag },
      { href: "/app/posts", labelKey: "feedLabel", descKey: "feedDesc", icon: FileText },
      { href: "/app/favorites", labelKey: "favoritesLabel", descKey: "favoritesDesc", icon: Heart },
      { href: "/app/leaderboard", labelKey: "leaderboardLabel", descKey: "leaderboardDesc", icon: Trophy },
    ],
  },
  {
    titleKey: "groupMyAccount",
    items: [
      { href: "/app/tickets", labelKey: "ticketsLabel", descKey: "ticketsDesc", icon: Ticket },
      { href: "/app/my-collaborations", labelKey: "collaborationsLabel", descKey: "collaborationsDesc", icon: Users },
      { href: "/app/messages", labelKey: "messagesLabel", icon: MessageCircle },
      { href: "/app/library", labelKey: "libraryLabel", descKey: "libraryDesc", icon: BookMarked },
      { href: "/app/rewards", labelKey: "rewardsLabel", descKey: "rewardsDesc", icon: Gift },
      { href: "/app/notifications", labelKey: "notificationsLabel", icon: Bell },
      { href: "/app/profile", labelKey: "profileLabel", icon: User },
      { href: "/app/settings", labelKey: "settingsLabel", icon: Settings },
    ],
  },
];

export default async function ToolsPage() {
  const t = await getTranslations("toolsPage");

  let isCreator = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = (data?.role as string) ?? "customer";
      isCreator = role === "creator" || role === "venue";
    }
  } catch {
    // fall back to non-creator view
  }

  const groups = isCreator ? [...creatorGroups, ...sharedGroups] : sharedGroups;

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <LayoutGrid size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-2xl font-bold">{t("heading")}</h1>
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.titleKey}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{t(group.titleKey)}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.items.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex flex-col gap-2 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
                    <tool.icon size={20} />
                  </span>
                  <span className="font-semibold leading-tight text-[var(--usha-white)]">{t(tool.labelKey)}</span>
                  {tool.descKey && <span className="text-xs text-[var(--usha-muted)]">{t(tool.descKey)}</span>}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
