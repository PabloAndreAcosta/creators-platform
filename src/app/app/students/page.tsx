import { redirect } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { MessageCircle, Mail, Search, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buildRoster, matchesStudent, type RosterBooking } from "@/lib/students/roster";
import { saveStudentNote } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("studentsPage");
  return { title: `${t("title")} – Usha Platform` };
}

/**
 * Elevregistret: alla som köpt av mig, samlade per person — hur ofta de
 * kommer, vad de har kvar på sina klippkort och mina egna anteckningar.
 * Massutskick finns inte här: de går till Följare, som har sagt ja.
 */
export default async function StudentsPage(props: { searchParams: Promise<{ q?: string }> }) {
  const t = await getTranslations("studentsPage");
  const locale = await getLocale();
  const dateFmt = locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : "sv-SE";
  const q = ((await props.searchParams).q ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: bookings }, { data: notes }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, listing_id, customer_id, guest_email, guest_name, status, scheduled_at, created_at, amount_paid, sessions_total, sessions_redeemed, pass_expires_at"
      )
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3000),
    supabase.from("student_notes").select("student_key, note").eq("owner_id", user.id),
  ]);
  const rows = (bookings ?? []) as RosterBooking[];
  const listingIds = [...new Set(rows.map((b) => b.listing_id))];
  const customerIds = [...new Set(rows.map((b) => b.customer_id).filter((id): id is string => !!id))];
  const [{ data: listings }, { data: profiles }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, title").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    customerIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const roster = buildRoster(
    rows,
    new Map((listings ?? []).map((l) => [l.id, l.title])),
    new Map((profiles ?? []).map((p) => [p.id, p.full_name])),
    new Date()
  );
  const shown = roster.filter((s) => matchesStudent(s, q));
  const noteFor = new Map((notes ?? []).map((n) => [n.student_key, n.note]));
  const day = (iso: string) => new Date(iso).toLocaleDateString(dateFmt, { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 text-[var(--usha-white)]">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("subtitle", { n: roster.length })}</p>

      {roster.length > 0 && (
        <form method="get" className="mt-6 flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            className="min-h-[44px] w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 text-base outline-none focus:border-[var(--usha-gold)]/40 sm:text-sm"
          />
          <button className="flex min-h-[44px] items-center rounded-xl border border-[var(--usha-border)] px-4" aria-label={t("search")}>
            <Search size={16} />
          </button>
        </form>
      )}

      {roster.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-sm text-[var(--usha-muted)]">
          {t("empty")}
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--usha-muted)]">{t("noMatch")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {shown.map((s) => (
            <li key={s.key} className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{s.name || s.guestEmail || t("unnamed")}</p>
                  <p className="mt-0.5 text-xs text-[var(--usha-muted)]">
                    {t("stats", { n: s.bookings, kr: Math.round(s.paidOre / 100) })}
                    {s.lastAt && <> · {t("last", { date: day(s.lastAt) })}</>}
                    {s.nextAt && <> · {t("next", { date: day(s.nextAt) })}</>}
                  </p>
                  {s.titles.length > 0 && (
                    <p className="mt-1 truncate text-xs text-[var(--usha-muted)]">{s.titles.slice(0, 4).join(" · ")}</p>
                  )}
                </div>
                {s.customerId ? (
                  <Link
                    href={`/app/messages?to=${s.customerId}`}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs hover:border-[var(--usha-gold)]/40"
                  >
                    <MessageCircle size={13} />
                    {t("message")}
                  </Link>
                ) : (
                  s.guestEmail && (
                    <a
                      href={`mailto:${s.guestEmail}`}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs hover:border-[var(--usha-gold)]/40"
                    >
                      <Mail size={13} />
                      {s.guestEmail}
                    </a>
                  )
                )}
              </div>

              {s.activePasses.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.activePasses.map((p) => (
                    <span key={p.bookingId} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs text-[var(--usha-gold)]">
                      <Ticket size={12} />
                      {t("passLeft", { title: p.title, n: p.left })}
                      {p.expiresAt && <span className="text-[var(--usha-muted)]">· {t("passExpires", { date: day(p.expiresAt) })}</span>}
                    </span>
                  ))}
                </div>
              )}

              <form action={saveStudentNote} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                <input type="hidden" name="studentKey" value={s.key} />
                <textarea
                  name="note"
                  defaultValue={noteFor.get(s.key) ?? ""}
                  rows={2}
                  maxLength={2000}
                  placeholder={t("notePlaceholder")}
                  className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm outline-none focus:border-[var(--usha-gold)]/40"
                />
                <button className="shrink-0 rounded-lg border border-[var(--usha-border)] px-3 py-2 text-xs hover:border-[var(--usha-gold)]/40">
                  {t("saveNote")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 rounded-xl border border-[var(--usha-border)] px-4 py-3 text-[12px] leading-relaxed text-[var(--usha-muted)]">
        {t("privacyNote")}{" "}
        <Link href="/app/followers" className="text-[var(--usha-gold)] hover:underline">
          {t("followersLink")}
        </Link>
      </p>
    </main>
  );
}
