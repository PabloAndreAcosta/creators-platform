import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/check";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PromoForm } from "./promo-form";

export default async function NewPromoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    redirect("/dashboard");
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard/admin/promo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka till promokoder
        </Link>
        <h1 className="text-3xl font-bold">Ny promokod</h1>
        <p className="mt-1 text-[var(--usha-muted)]">
          Skapa en rabattkod för prenumerationer eller biljetter.
        </p>
      </div>

      <PromoForm />
    </>
  );
}
