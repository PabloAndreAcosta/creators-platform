import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdminById } from "@/lib/admin/check";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCreatorRole } from "@/lib/roles";
import Link from "next/link";
import { ArrowLeft, Search, Building2, User } from "lucide-react";
import { setCreatorIsCompany } from "./actions";

/**
 * Admin: look up a creator by email and flip their is_company flag (privatperson
 * ↔ företag) after signup. Company creators get the org.nr verification step +
 * company receipt / on_behalf_of path.
 */
export default async function AdminCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; updated?: string; error?: string }>;
}) {
  const { email, updated, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdminById(user.id))) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const query = (email ?? "").trim();
  let profile:
    | { id: string; full_name: string | null; email: string; role: string | null; is_company: boolean | null; company_verified_at: string | null }
    | null = null;
  if (query) {
    const { data } = await admin
      .from("profiles")
      .select("id, full_name, email, role, is_company, company_verified_at")
      .ilike("email", query)
      .maybeSingle();
    profile = data ?? null;
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <h1 className="text-3xl font-bold">Kreatörer — privatperson/företag</h1>
        <p className="mt-1 text-[var(--usha-muted)]">
          Sök upp en kreatör och ändra om de säljer som företag (org.nr-verifiering + org.nr på kvitto).
        </p>
      </div>

      {updated === "1" && (
        <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-400">
          Uppdaterat.
        </div>
      )}
      {error === "not_creator" && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
          Kontot är inte en kreatör — flaggan gäller bara kreatörer.
        </div>
      )}

      {/* Search by email */}
      <form method="GET" className="mb-8 flex gap-2">
        <input
          type="email"
          name="email"
          defaultValue={query}
          placeholder="kreatörens e-post"
          className="w-full max-w-sm rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--usha-gold)]/40"
        />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
        >
          <Search size={16} />
          Sök
        </button>
      </form>

      {query && !profile && (
        <p className="text-sm text-[var(--usha-muted)]">Ingen profil hittades för “{query}”.</p>
      )}

      {profile && (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
          <div className="mb-4">
            <p className="font-semibold">{profile.full_name || "(namn saknas)"}</p>
            <p className="text-sm text-[var(--usha-muted)]">{profile.email} · roll: {profile.role ?? "–"}</p>
          </div>

          {!isCreatorRole(profile.role) ? (
            <p className="text-sm text-[var(--usha-muted)]">
              Flaggan gäller bara kreatörer. Venues är alltid företag; kunder saknar den.
            </p>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2 text-sm">
                <span className="text-[var(--usha-muted)]">Status nu:</span>
                {profile.is_company ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-[var(--usha-gold)]">
                    <Building2 size={14} /> Företag
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <User size={14} /> Privatperson
                  </span>
                )}
                {profile.company_verified_at && (
                  <span className="text-xs text-[var(--usha-muted)]">(bolag verifierat)</span>
                )}
              </div>

              <div className="flex gap-2">
                <form action={setCreatorIsCompany}>
                  <input type="hidden" name="userId" value={profile.id} />
                  <input type="hidden" name="isCompany" value="true" />
                  <button
                    type="submit"
                    disabled={!!profile.is_company}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
                  >
                    Sätt som företag
                  </button>
                </form>
                <form action={setCreatorIsCompany}>
                  <input type="hidden" name="userId" value={profile.id} />
                  <input type="hidden" name="isCompany" value="false" />
                  <button
                    type="submit"
                    disabled={!profile.is_company}
                    className="rounded-lg border border-[var(--usha-border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    Sätt som privatperson
                  </button>
                </form>
              </div>
              {profile.is_company && profile.company_verified_at && (
                <p className="mt-3 text-xs text-[var(--usha-muted)]">
                  Obs: kontot har ett verifierat bolag. Om du sätter tillbaka till privatperson kvarstår org.nr-uppgifterna tills de rensas separat.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
