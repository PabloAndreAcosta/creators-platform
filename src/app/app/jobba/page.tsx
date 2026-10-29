import { getTranslations } from "next-intl/server";
import { WorkLadder } from "@/components/work/work-ladder";

/** "Jobba med Usha" inne i appen — samma trappa som den öppna sidan. */
export default async function WorkPage() {
  const t = await getTranslations("work");
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-[var(--usha-muted)]">{t("intro")}</p>
      <WorkLadder loggedIn />
    </div>
  );
}
