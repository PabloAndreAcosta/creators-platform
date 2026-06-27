import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Download, Mail } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await getTranslations("hostEvent");
  return { title: `${t("waitlistTitle")} – Usha Platform` };
}

export default async function WaitlistPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const t = await getTranslations("hostEvent");
  const locale = await getLocale();
  const dateFmt = locale === "en" ? "en-GB" : "sv-SE";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("id, title, slug, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!listing || listing.user_id !== user.id) notFound();

  const { data: rows } = await admin
    .from("event_waitlist")
    .select("name, email, created_at, unsubscribed_at")
    .eq("listing_id", id)
    .order("created_at", { ascending: false });

  const entries = rows ?? [];
  const active = entries.filter((r) => !r.unsubscribed_at).length;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 text-[var(--usha-white)]">
      <Link
        href={`/event/${listing.slug ?? ""}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
      >
        <ChevronLeft className="h-4 w-4" /> {t("backToEvent")}
      </Link>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("waitlistTitle")}</h1>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">{listing.title}</p>
          <p className="mt-2 text-sm">
            <span className="text-2xl font-bold text-[var(--usha-gold)]">{active}</span>{" "}
            <span className="text-[var(--usha-muted)]">
              {t("activeSignups")}{entries.length !== active ? t("totalCount", { total: entries.length }) : ""}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/app/events/${id}/broadcast`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--usha-gold)] px-4 py-2 text-sm font-bold text-black hover:opacity-90"
          >
            <Mail className="h-4 w-4" /> {t("emailList")}
          </Link>
          {entries.length > 0 && (
            <a
              href={`/api/events/${id}/waitlist/export`}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-2 text-sm font-medium hover:bg-[var(--usha-border)]"
            >
              <Download className="h-4 w-4" /> CSV
            </a>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8 text-center text-sm text-[var(--usha-muted)]">
          {t("noSignups")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--usha-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--usha-card)] text-[var(--usha-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("colName")}</th>
                <th className="px-4 py-3 font-medium">{t("colEmail")}</th>
                <th className="px-4 py-3 font-medium">{t("colSignedUp")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((r, i) => (
                <tr key={i} className="border-t border-[var(--usha-border)]">
                  <td className="px-4 py-3">{r.name ?? "—"}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3 text-[var(--usha-muted)]">
                    {new Date(r.created_at).toLocaleDateString(dateFmt)}
                  </td>
                  <td className="px-4 py-3">
                    {r.unsubscribed_at ? (
                      <span className="text-[var(--usha-muted)]">{t("statusUnsubscribed")}</span>
                    ) : (
                      <span className="text-[var(--usha-gold)]">{t("statusActive")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
