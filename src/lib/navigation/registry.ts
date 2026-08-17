// Ett register över appens destinationer.
//
// Varje meny i appen hade tidigare sin egen hårdkodade lista: flikraden,
// sidomenyn på desktop, Mer-griden, profilmenyn, settings-hubben och
// knappraden på eventsidan. Ingen av dem visste om de andra, så en ny sida
// blev osynlig om man glömde en av listorna — och det hände upprepade gånger:
// Kopplingar, Login & säkerhet, bokningsvyn. Sidomenyn och Mer-griden hade
// dessutom drivit isär, så vad som gick att nå berodde på skärmbredden.
//
// Här deklareras varje destination EN gång. Menyerna renderar ur registret,
// och coverage-testet failar om en sida under /app eller /dashboard varken
// står här eller är listad som kontextuell. Att glömma en meny är därmed inte
// längre möjligt utan att bygget säger ifrån.

import type { LucideIcon } from "lucide-react";
import {
  Package, CalendarCheck, CalendarDays, ScanLine, Briefcase, BookOpen, Building2,
  Wallet, BarChart3, CreditCard, Tag, Search, Store, FileText, Heart, Trophy,
  ShoppingBag, Ticket, MessageCircle, BookMarked, Gift, Bell, User, Settings,
  Users, Home, Sparkles, Box, LayoutGrid,
} from "lucide-react";

/** Kanoniska roller. Se roll-modellen: creator/venue säljer, customer köper. */
export type NavRole = "customer" | "creator" | "venue";

/**
 * Ytor en destination kan visas på.
 * - `sidebar`: sidomenyn på desktop
 * - `more`: Mer-griden (mobil)
 * Profilmenyn och settings-hubben är små och handredigerade, men deras sidor
 * måste ändå stå i registret för att passera coverage-testet.
 */
export type NavSurface = "sidebar" | "more" | "profile" | "settings";

export type NavGroup =
  | "createSell"
  | "finance"
  | "explore"
  | "myAccount";

export interface AppDestination {
  /** Rutt som den ser ut i URL:en. Måste matcha en page.tsx om external saknas. */
  path: string;
  /**
   * Lång etikett + beskrivning, nycklar i toolsPage-namespacet. Krävs bara för
   * destinationer som renderas i Mer-griden eller sidomenyn — settings- och
   * profilraderna har egna etiketter i sina respektive namespace och står här
   * enbart för att coverage-testet ska se dem.
   */
  labelKey?: string;
  descKey?: string;
  /** Kort etikett för sidomenyn, nyckel i nav-namespacet. */
  navLabelKey?: string;
  icon: LucideIcon;
  group: NavGroup;
  /** "all" = alla roller. Annars de roller som ser destinationen. */
  roles: NavRole[] | "all";
  surfaces: NavSurface[];
  /** Ligger utanför appen (annan domän eller publik sajt). */
  external?: boolean;
}

export const APP_DESTINATIONS: AppDestination[] = [
  // ---- Skapa & sälj -------------------------------------------------------
  { path: "/app", labelKey: "homeLabel", navLabelKey: "home", icon: Home,
    group: "createSell", roles: "all", surfaces: ["sidebar"] },
  { path: "/dashboard/listings", labelKey: "servicesLabel", descKey: "servicesDesc", icon: Package,
    group: "createSell", roles: ["creator", "venue"], surfaces: ["more"] },
  { path: "/dashboard/bookings", labelKey: "bookingsLabel", descKey: "bookingsDesc", icon: CalendarCheck,
    group: "createSell", roles: ["creator", "venue"], surfaces: ["more"] },
  { path: "/app/calendar", labelKey: "calendarLabel", descKey: "calendarDesc", navLabelKey: "calendar", icon: CalendarDays,
    group: "createSell", roles: "all", surfaces: ["more", "sidebar"] },
  { path: "/app/scan", labelKey: "scanLabel", descKey: "scanDesc", navLabelKey: "scan", icon: ScanLine,
    group: "createSell", roles: ["creator", "venue"], surfaces: ["more", "sidebar"] },
  { path: "/dashboard/gigs", labelKey: "gigsLabel", descKey: "gigsDesc", icon: Briefcase,
    group: "createSell", roles: ["venue"], surfaces: ["more"] },
  // Dansarsidan av gig-marknaden. Saknade helt ingång — arrangören kunde lägga
  // upp uppdrag som ingen kunde se eller söka.
  { path: "/app/gigs", labelKey: "openGigsLabel", descKey: "openGigsDesc", icon: Briefcase,
    group: "createSell", roles: ["creator"], surfaces: ["more"] },
  { path: "/app/events", labelKey: "eventsLabel", descKey: "eventsDesc", navLabelKey: "events", icon: Building2,
    group: "createSell", roles: ["creator", "venue"], surfaces: ["more", "sidebar"] },
  { path: "/app/courses", labelKey: "coursesLabel", descKey: "coursesDesc", navLabelKey: "content", icon: BookOpen,
    group: "createSell", roles: ["creator", "venue"], surfaces: ["more", "sidebar"] },
  { path: "/dashboard/products", labelKey: "productsLabel", descKey: "productsDesc", icon: Box,
    group: "createSell", roles: ["creator", "venue"], surfaces: ["more"] },
  { path: "/app/events/insights", labelKey: "statisticsLabel", descKey: "statisticsDesc", icon: BarChart3,
    group: "createSell", roles: ["creator", "venue"], surfaces: ["more"] },

  // ---- Ekonomi ------------------------------------------------------------
  { path: "/dashboard/payouts", labelKey: "payoutsLabel", descKey: "payoutsDesc", icon: Wallet,
    group: "finance", roles: ["creator", "venue"], surfaces: ["more"] },
  { path: "/dashboard/analytics", labelKey: "analyticsLabel", descKey: "analyticsDesc", icon: BarChart3,
    group: "finance", roles: ["creator", "venue"], surfaces: ["more"] },
  { path: "/dashboard/billing", labelKey: "billingLabel", descKey: "billingDesc", icon: CreditCard,
    group: "finance", roles: "all", surfaces: ["more"] },
  { path: "/dashboard/promo-codes", labelKey: "promoCodesLabel", descKey: "promoCodesDesc", icon: Tag,
    group: "finance", roles: ["creator", "venue"], surfaces: ["more"] },

  // ---- Utforska -----------------------------------------------------------
  { path: "/app/search", labelKey: "searchLabel", descKey: "searchDesc", icon: Search,
    group: "explore", roles: "all", surfaces: ["more"] },
  { path: "/app/recommendations", labelKey: "recommendationsLabel", descKey: "recommendationsDesc", icon: Sparkles,
    group: "explore", roles: "all", surfaces: ["more"] },
  { path: "/app/training-buddies", labelKey: "trainingBuddiesLabel", descKey: "trainingBuddiesDesc", navLabelKey: "buddies", icon: Users,
    group: "explore", roles: "all", surfaces: ["more", "sidebar"] },
  { path: "/marketplace", labelKey: "marketplaceLabel", descKey: "marketplaceDesc", icon: Store,
    group: "explore", roles: "all", surfaces: ["more"], external: true },
  { path: "https://shop.usha.se", labelKey: "shopLabel", descKey: "shopDesc", icon: ShoppingBag,
    group: "explore", roles: "all", surfaces: ["more"], external: true },
  { path: "/app/posts", labelKey: "feedLabel", descKey: "feedDesc", navLabelKey: "myPosts", icon: FileText,
    group: "explore", roles: "all", surfaces: ["more", "sidebar"] },
  { path: "/app/favorites", labelKey: "favoritesLabel", descKey: "favoritesDesc", navLabelKey: "favorites", icon: Heart,
    group: "explore", roles: "all", surfaces: ["more", "sidebar"] },
  { path: "/app/leaderboard", labelKey: "leaderboardLabel", descKey: "leaderboardDesc", navLabelKey: "leaderboard", icon: Trophy,
    group: "explore", roles: "all", surfaces: ["more", "sidebar"] },

  // ---- Mitt konto ---------------------------------------------------------
  { path: "/app/tickets", labelKey: "ticketsLabel", descKey: "ticketsDesc", navLabelKey: "tickets", icon: Ticket,
    group: "myAccount", roles: "all", surfaces: ["more", "sidebar"] },
  { path: "/app/my-collaborations", labelKey: "collaborationsLabel", descKey: "collaborationsDesc", icon: Users,
    group: "myAccount", roles: "all", surfaces: ["more"] },
  { path: "/app/messages", labelKey: "messagesLabel", navLabelKey: "messages", icon: MessageCircle,
    group: "myAccount", roles: "all", surfaces: ["more", "sidebar"] },
  { path: "/app/library", labelKey: "libraryLabel", descKey: "libraryDesc", navLabelKey: "library", icon: BookMarked,
    group: "myAccount", roles: "all", surfaces: ["more", "sidebar"] },
  { path: "/app/rewards", labelKey: "rewardsLabel", descKey: "rewardsDesc", icon: Gift,
    group: "myAccount", roles: "all", surfaces: ["more", "profile"] },
  { path: "/app/notifications", labelKey: "notificationsLabel", icon: Bell,
    group: "myAccount", roles: "all", surfaces: ["more"] },
  { path: "/app/profile", labelKey: "profileLabel", navLabelKey: "profile", icon: User,
    group: "myAccount", roles: "all", surfaces: ["more", "sidebar"] },
  { path: "/app/settings", labelKey: "settingsLabel", icon: Settings,
    group: "myAccount", roles: "all", surfaces: ["more"] },
  // Mer-griden själv måste finnas i sidomenyn. Utan den vägen är allt som bara
  // ligger i griden omöjligt att nå på desktop, eftersom flikraden är md:hidden.
  { path: "/app/tools", labelKey: "toolsLabel", navLabelKey: "tools", icon: LayoutGrid,
    group: "myAccount", roles: "all", surfaces: ["sidebar"] },
  { path: "/app/settings/connections", icon: Settings,
    group: "myAccount", roles: "all", surfaces: ["settings", "profile"] },
  { path: "/app/settings/security", icon: Settings,
    group: "myAccount", roles: "all", surfaces: ["settings", "profile"] },
  { path: "/app/settings/notifications", icon: Bell,
    group: "myAccount", roles: "all", surfaces: ["settings", "profile"] },
  { path: "/app/settings/privacy", icon: Settings,
    group: "myAccount", roles: "all", surfaces: ["settings", "profile"] },
  { path: "/app/settings/help", icon: Settings,
    group: "myAccount", roles: "all", surfaces: ["settings", "profile"] },
  { path: "/app/settings/account", icon: Settings,
    group: "myAccount", roles: "all", surfaces: ["settings"] },
];

/**
 * Sidor som medvetet saknar menyingång, med skälet. De nås från ett objekt
 * eller mitt i ett flöde, och skulle vara meningslösa i en meny eftersom de
 * kräver ett id eller ett pågående ärende.
 *
 * Står en sida här är den granskad och avsiktlig — inte bortglömd. Det är
 * skillnaden mot en föräldralös sida.
 */
export const CONTEXTUAL_ROUTES: Record<string, string> = {
  "/dashboard": "Omdirigerar bara vidare till /app.",
  "/app/events/[id]/bookings": "Nås från knappraden på eventsidan.",
  "/app/events/[id]/edit": "Nås genom att öppna ett event i listan.",
  "/app/events/[id]/crew": "Nås från knappraden på eventsidan.",
  "/app/events/[id]/live": "Nås från knappraden på eventsidan.",
  "/app/events/[id]/waitlist": "Nås från knappraden på eventsidan.",
  "/app/events/[id]/stats": "Nås från knappraden på eventsidan.",
  "/app/events/[id]/settlement": "Nås från knappraden på eventsidan.",
  "/app/events/[id]/broadcast": "Nås från väntelistan på eventsidan.",
  "/app/events/[id]/codes": "Nås från eventsidan.",
  "/app/events/new": "Nås från Skapa-knappen i eventlistan.",
  "/app/events/open": "Nås från eventlistan.",
  "/app/events/select-page": "Nås mitt i Facebook-inloggningen när kontot har flera sidor.",
  "/app/invites/[token]": "Nås via inbjudningslänk i mejl.",
  "/dashboard/listings/new": "Nås från tjänstelistan.",
  "/dashboard/listings/[id]/edit": "Nås genom att öppna en tjänst.",
  "/dashboard/gigs/new": "Nås från gig-listan.",
  "/dashboard/gigs/[id]": "Nås genom att öppna ett gig.",
  "/dashboard/admin/promo": "Adminverktyg, avsiktligt utan menyingång.",
  "/dashboard/admin/promo/new": "Adminverktyg, avsiktligt utan menyingång.",
  "/dashboard/profile": "Redigera profil — nås från profilmenyn.",
};

function roleMatches(dest: AppDestination, role: NavRole): boolean {
  return dest.roles === "all" || dest.roles.includes(role);
}

/** Destinationer för en roll på en given yta, i registrets ordning. */
export function destinationsFor(role: NavRole, surface: NavSurface): AppDestination[] {
  return APP_DESTINATIONS.filter(
    (d) => d.surfaces.includes(surface) && roleMatches(d, role)
  );
}

/** Samma, men grupperad — för Mer-griden. */
export function groupedDestinationsFor(
  role: NavRole,
  surface: NavSurface
): { group: NavGroup; items: AppDestination[] }[] {
  const order: NavGroup[] = ["createSell", "finance", "explore", "myAccount"];
  return order
    .map((group) => ({
      group,
      items: destinationsFor(role, surface).filter((d) => d.group === group),
    }))
    .filter((g) => g.items.length > 0);
}
