import { requireAdmin } from "@/lib/admin/guard";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PromoForm } from "./promo-form";

export default async function NewPromoPage() {
  await requireAdmin("promo");

  const t = await getTranslations("adminPromo");

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard/admin/promo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          {t("backToList")}
        </Link>
        <h1 className="text-3xl font-bold">{t("newTitle")}</h1>
        <p className="mt-1 text-[var(--usha-muted)]">{t("newIntro")}</p>
      </div>

      <PromoForm />
    </>
  );
}
