import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Package, CalendarCheck, CalendarDays, ScanLine, Briefcase, BookOpen,
  Wallet, BarChart3, CreditCard, Tag,
  Search, Store, FileText, Heart, Trophy,
  Ticket, MessageCircle, BookMarked, Gift, Bell, User, Settings, LayoutGrid, Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Verktyg – Usch-Ja!" };

interface Tool {
  href: string;
  label: string;
  desc?: string;
  icon: LucideIcon;
}
interface Group {
  title: string;
  items: Tool[];
}

const creatorGroups: Group[] = [
  {
    title: "Skapa & sälj",
    items: [
      { href: "/dashboard/listings", label: "Tjänster", desc: "Skapa & hantera", icon: Package },
      { href: "/dashboard/bookings", label: "Bokningar", desc: "Inkommande & avklarade", icon: CalendarCheck },
      { href: "/app/calendar", label: "Kalender", desc: "Din & följdas", icon: CalendarDays },
      { href: "/app/scan", label: "Skanna", desc: "Checka in biljetter", icon: ScanLine },
      { href: "/dashboard/gigs", label: "Gigs", desc: "B2B-uppdrag", icon: Briefcase },
      { href: "/app/courses", label: "Kurser", desc: "Digitalt innehåll", icon: BookOpen },
    ],
  },
  {
    title: "Ekonomi",
    items: [
      { href: "/dashboard/payouts", label: "Utbetalningar", desc: "Intäkter & historik", icon: Wallet },
      { href: "/dashboard/analytics", label: "Analys", desc: "Tillväxt & statistik", icon: BarChart3 },
      { href: "/dashboard/billing", label: "Abonnemang", desc: "Plan & fakturor", icon: CreditCard },
      { href: "/dashboard/promo-codes", label: "Promokoder", desc: "Rabatter", icon: Tag },
    ],
  },
];

const sharedGroups: Group[] = [
  {
    title: "Utforska",
    items: [
      { href: "/app/search", label: "Sök", desc: "Hitta kreatörer", icon: Search },
      { href: "/marketplace", label: "Marknadsplats", desc: "Bläddra", icon: Store },
      { href: "/app/posts", label: "Flöde", desc: "Inlägg", icon: FileText },
      { href: "/app/favorites", label: "Favoriter", desc: "Sparade", icon: Heart },
      { href: "/app/leaderboard", label: "Topplista", desc: "Ranking", icon: Trophy },
    ],
  },
  {
    title: "Mitt konto",
    items: [
      { href: "/app/tickets", label: "Biljetter", desc: "Dina bokningar", icon: Ticket },
      { href: "/app/my-collaborations", label: "Mina samarbeten", desc: "Produktioner du medverkar i", icon: Users },
      { href: "/app/messages", label: "Meddelanden", icon: MessageCircle },
      { href: "/app/library", label: "Bibliotek", desc: "Köpt innehåll", icon: BookMarked },
      { href: "/app/rewards", label: "Belöningar", desc: "Poäng", icon: Gift },
      { href: "/app/notifications", label: "Notiser", icon: Bell },
      { href: "/app/profile", label: "Profil", icon: User },
      { href: "/app/settings", label: "Inställningar", icon: Settings },
    ],
  },
];

export default async function ToolsPage() {
  let isCreator = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = (data?.role as string) ?? "publik";
      isCreator = role === "kreator" || role === "upplevelse";
    }
  } catch {
    // fall back to non-creator view
  }

  const groups = isCreator ? [...creatorGroups, ...sharedGroups] : sharedGroups;

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <LayoutGrid size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-2xl font-bold">Verktyg</h1>
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">{group.title}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.items.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="flex flex-col gap-2 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
                    <t.icon size={20} />
                  </span>
                  <span className="font-semibold leading-tight text-white">{t.label}</span>
                  {t.desc && <span className="text-xs text-[var(--usha-muted)]">{t.desc}</span>}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
