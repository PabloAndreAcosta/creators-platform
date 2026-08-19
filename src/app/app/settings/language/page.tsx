import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Languages } from "lucide-react";
import { LanguagePicker } from "./language-picker";

export const metadata = { title: "Språk – Usha Platform" };

/**
 * Changing the app's language.
 *
 * There was no way to do this inside the app below the desktop breakpoint: the
 * only switcher lived in the sidebar and the header, both `hidden md:flex`. The
 * language cookie lasts a year, so whatever was resolved on the first visit —
 * or picked once by accident — stayed, with nothing in reach to correct it.
 */
export default async function LanguageSettingsPage() {
  const t = await getTranslations("languageSettings");

  return (
    <div className="px-4 py-6 md:max-w-lg md:mx-auto">
      <Link
        href="/app/profile"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
      >
        <ArrowLeft size={15} />
        {t("back")}
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <Languages size={22} className="text-[var(--usha-gold)]" />
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-xs text-[var(--usha-muted)]">{t("subtitle")}</p>
        </div>
      </div>

      <LanguagePicker />
    </div>
  );
}
