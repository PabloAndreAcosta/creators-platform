import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Tag, Copy } from "lucide-react";
import { PromoCodeForm } from "./promo-form";
import { DeletePromoButton } from "./delete-promo-button";

export default async function PromoCodesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: codes } = await supabase
    .from("creator_promo_codes")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <h1 className="text-3xl font-bold">Promo-koder</h1>
        <p className="mt-1 text-[var(--usha-muted)]">
          Skapa rabattkoder som kunder kan använda vid köp. Du kan spåra hur många som använt varje kod.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
        <h2 className="mb-4 text-lg font-bold">Ny promo-kod</h2>
        <PromoCodeForm />
      </div>

      <div className="space-y-3">
        {(!codes || codes.length === 0) ? (
          <div className="rounded-2xl border border-dashed border-[var(--usha-border)] py-16 text-center">
            <Tag size={32} className="mx-auto mb-3 text-[var(--usha-muted)]" />
            <p className="text-sm text-[var(--usha-muted)]">Inga promo-koder ännu.</p>
          </div>
        ) : (
          codes.map((code) => (
            <div
              key={code.id}
              className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
                <Tag size={18} className="text-[var(--usha-gold)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold tracking-wider">{code.code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    code.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {code.is_active ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--usha-muted)]">
                  {code.discount_percent > 0 && <span>{code.discount_percent}% rabatt</span>}
                  {code.discount_amount > 0 && <span>{code.discount_amount} SEK rabatt</span>}
                  <span>{code.times_used}{code.max_uses ? `/${code.max_uses}` : ""} använd</span>
                  {code.valid_until && (
                    <span>
                      Gäller t.o.m. {new Date(code.valid_until).toLocaleDateString("sv-SE")}
                    </span>
                  )}
                </div>
              </div>
              <DeletePromoButton promoId={code.id} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
