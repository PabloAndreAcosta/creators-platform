import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { notIndexable } from "@/lib/seo/metadata";
import { Kiosk, type KioskStrings } from "./kiosk";

export const dynamic = "force-dynamic";
export const metadata = { title: "Självinsläpp · Usha Platform", ...notIndexable() };

/**
 * Självinsläppet för ett evenemang: plattan i dörren.
 *
 * Ligger UTANFÖR /app med flit — appens flikrad och sidhuvud ska inte synas
 * på en platta som står vänd mot gästerna. Översättningarna hämtas här på
 * servern och skickas som strängar; klientdelen behöver då ingen egen
 * provider.
 */
export default async function KioskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tt?: string }>;
}) {
  const { id } = await params;
  const { tt } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/dorr/${id}`)}`);

  const s = await getTranslations("scanPage");
  const d = await getTranslations("dorrPage");
  const strings: KioskStrings = {
    title: d("title"),
    startLead: d("startLead"),
    startStep1: d("startStep1"),
    startStep2: d("startStep2"),
    startStep3: d("startStep3"),
    start: d("start"),
    starting: s("startingCamera"),
    exit: s("kioskExit"),
    buyTitle: s("kioskBuyTitle"),
    buyHint: s("kioskBuyHint"),
    priceSuffix: d("priceSuffix"),
    noTicketTypes: s("kioskNoTicketTypes"),
    showTitle: s("kioskShowTitle"),
    showHint: s("kioskShowHint"),
    cameraBlocked: s("cameraBlocked"),
    cameraFailed: s("kioskCameraFailed"),
    retry: d("retry"),
    welcome: s("kioskWelcome"),
    wrongDate: s("kioskWrongDate"),
    wrongDateDetail: s("statusWrongDate", { date: "{date}" }),
    alreadyUsed: s("statusAlreadyUsed"),
    checkInTime: s("checkInTimeLabel", { time: "{time}" }),
    canceled: s("statusCanceled"),
    pending: s("statusPending"),
    invalid: s("statusInvalid"),
    askCrew: s("kioskAskCrew"),
    seats: s("seats", { n: "{n}" }),
    passRemaining: s("passRemaining", { n: "{n}" }),
    noPermission: s("kioskNoPermission"),
    onlyOwnEvents: s("errOnlyOwnEvents"),
    couldNotVerify: s("errCouldNotVerify"),
    checkInFailed: s("checkInFailed"),
    network: s("errNetwork"),
    lockedTitle: s("kioskLockedTitle"),
    lockedBody: s("kioskLockedBody"),
    upgrade: s("kioskUpgrade"),
  };

  return <Kiosk id={id} ticketTypeId={tt ?? null} s={strings} />;
}
