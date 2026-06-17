import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ShieldCheck, Calendar, MapPin, Users, Check } from "lucide-react";
import { AcceptButton } from "./accept-button";

export const dynamic = "force-dynamic";

const BANKID_GATED_ROLES = new Set(["creator", "taxi_dancer", "volunteer"]);

interface Params {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Params) {
  const { token } = await params;
  const t = await getTranslations("invites");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invite } = await admin
    .from("collaborator_invites")
    .select("id, listing_id, role, expires_at, accepted_user_id, invited_by")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <StatusCard
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        variant="error"
      />
    );
  }

  if (invite.accepted_user_id) {
    return (
      <StatusCard
        title={t("acceptedTitle")}
        body={t("acceptedBody")}
        variant="ok"
      />
    );
  }

  const expired = new Date(invite.expires_at).getTime() < Date.now();
  if (expired) {
    return (
      <StatusCard
        title={t("expiredTitle")}
        body={t("expiredBody")}
        variant="error"
      />
    );
  }

  const [{ data: listing }, { data: host }] = await Promise.all([
    admin
      .from("listings")
      .select("id, title, slug, event_date, event_location, image_url")
      .eq("id", invite.listing_id)
      .single(),
    admin
      .from("profiles")
      .select("full_name")
      .eq("id", invite.invited_by)
      .maybeSingle(),
  ]);

  if (!listing) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const expiresDate = new Date(invite.expires_at).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  });

  const roleKey = invite.role as "creator" | "taxi_dancer" | "volunteer" | "co_host";
  const roleLabel = t(`roles.${roleKey}`);
  const roleDescription = t(`roleDescriptions.${roleKey}`);
  const isGated = BANKID_GATED_ROLES.has(invite.role);

  const eventDate = listing.event_date
    ? new Date(`${listing.event_date}T12:00:00+02:00`).toLocaleDateString("sv-SE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Stockholm",
      })
    : t("dateTba");

  const subtitle = host?.full_name
    ? t("subtitleNamed", { host: host.full_name, event: listing.title })
    : t("subtitleAnon", { event: listing.title });

  let needsBankId = false;
  if (user && BANKID_GATED_ROLES.has(invite.role)) {
    const { data: profile } = await admin
      .from("profiles")
      .select("bankid_verified_at")
      .eq("id", user.id)
      .single();
    needsBankId = !profile?.bankid_verified_at;
  }

  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <p className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">
          {t("title")}
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{subtitle}</h1>

        {/* Event */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)]">
          {listing.image_url && (
            <div className="relative aspect-[1.91/1] w-full bg-black">
              <Image
                src={listing.image_url}
                alt={listing.title}
                fill
                sizes="(max-width: 672px) 100vw, 672px"
                className="object-cover"
              />
            </div>
          )}
          <div className="p-6">
            <h2 className="text-xl font-bold">{listing.title}</h2>
            <div className="mt-3 space-y-2 text-sm text-[var(--usha-muted)]">
              <p className="flex items-center gap-2">
                <Calendar size={15} className="shrink-0" />
                <span className="capitalize">{eventDate}</span>
              </p>
              {listing.event_location && (
                <p className="flex items-center gap-2">
                  <MapPin size={15} className="shrink-0" />
                  {listing.event_location}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Role */}
        <div className="mt-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">
            {t("role")}
          </p>
          <p className="mt-1 text-lg font-semibold">{roleLabel}</p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">{roleDescription}</p>
          <p className="mt-4 text-xs text-[var(--usha-muted)]">
            {t("expires", { date: expiresDate })}
          </p>
        </div>

        {/* What happens when you accept */}
        <div className="mt-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
          <h3 className="text-sm font-semibold">{t("whatHappensTitle")}</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-[var(--usha-muted)]">
            <li className="flex items-start gap-2.5">
              <Users size={16} className="mt-0.5 shrink-0 text-[var(--usha-gold)]" />
              <span>{t("whatHappensCrew", { role: roleLabel.toLowerCase() })}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0 text-[var(--usha-gold)]" />
              <span>{t("whatHappensManage")}</span>
            </li>
            {isGated && (
              <li className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <span>{t("whatHappensBankid")}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="mt-8">
          {!user && (
            <Link
              href={`/signup?next=${encodeURIComponent(`/app/invites/${token}`)}`}
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black shadow-lg transition hover:opacity-90 sm:text-lg"
            >
              {t("signupRequired")}
            </Link>
          )}

          {user && needsBankId && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck size={20} className="mt-0.5 text-amber-300" />
                <div>
                  <h3 className="text-base font-semibold text-amber-200">
                    {t("bankidRequired")}
                  </h3>
                  <p className="mt-1 text-sm text-amber-100/80">
                    {t("bankidRequiredBody")}
                  </p>
                  <Link
                    href={`/dashboard/profile?bankid_next=${encodeURIComponent(`/app/invites/${token}`)}`}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
                  >
                    {t("bankidGoVerify")}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {user && !needsBankId && (
            <AcceptButton token={token} listingSlug={listing.slug ?? null} />
          )}
        </div>
      </div>
    </main>
  );
}

function StatusCard({
  title,
  body,
  variant,
}: {
  title: string;
  body: string;
  variant: "ok" | "error";
}) {
  const borderColor = variant === "ok" ? "border-green-500/30" : "border-[var(--usha-border)]";
  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-xl px-6 py-24">
        <div className={`rounded-2xl border ${borderColor} bg-[var(--usha-card)] p-8`}>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-3 text-sm text-[var(--usha-muted)]">{body}</p>
          <Link
            href="/app"
            className="mt-6 inline-flex rounded-xl border border-[var(--usha-border)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--usha-card-hover)]"
          >
            Usha Platform
          </Link>
        </div>
      </div>
    </main>
  );
}
