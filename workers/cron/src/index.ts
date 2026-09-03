/**
 * Usha-plattformens schemaläggare.
 *
 * Endpointerna bor i Next-appen på usha.se; det här är bara klockan. Den låg
 * tidigare i GitHub Actions, för att Vercel Hobby bara tillåter en körning per
 * dygn. Men GitHubs schemaläggning är uttalat "best effort", och för det här
 * repot betydde det i praktiken var 4,5:e timme med värsta glapp på 12,6.
 *
 * "Din bokning börjar snart"-mejlet letar efter bokningar inom två timmar. Med
 * fyra och en halv timme mellan körningarna hann de flesta bokningar passera
 * hela fönstret mellan två körningar: 5 av 57 bokningar fick sitt mejl.
 *
 * Alla endpoints är idempotenta (varsin dedup-kolumn), så en extra körning är
 * ofarlig — GitHub-schemat får ligga kvar som reserv.
 */

interface Env {
  /** Delad hemlighet med Next-appens verifyCronAuth. */
  CRON_SECRET: string;
  /** För larmmejlet när ett jobb failar. Utan den larmar Workern inte. */
  RESEND_API_KEY?: string;
  /** Vart larmet går. */
  ALERT_EMAIL?: string;
  /** Bas-URL, för att kunna peka om till en preview vid felsökning. */
  APP_URL?: string;
}

/** Jobben, i den ordning de körs. Namnet används i larmmejlet. */
const JOBS = [
  { name: "booking-reminders-soon", desc: 'Påminnelse "börjar snart" (T-2h)' },
  { name: "creator-event-notify", desc: "Notis till följare om nya evenemang" },
  { name: "event-reminders", desc: "Autopublicering till Facebook (T-3d)" },
  { name: "waitlist-release", desc: "Mejl till väntelistan när biljetter släpps" },
  { name: "connect-sync", desc: "Synk av Stripe Connect-kapaciteter" },
] as const;

async function runJob(env: Env, path: string): Promise<{ ok: boolean; detail: string }> {
  const base = env.APP_URL ?? "https://usha.se";
  try {
    const res = await fetch(`${base}/api/cron/${path}`, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text();
    return { ok: res.ok, detail: `${res.status} ${body.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Larmar när ett jobb failat.
 *
 * Ett tyst schema är värre än inget schema: storage-backupen låg nere i trettio
 * dagar för att ingen fick veta. Går mejlet inte att skicka syns det åtminstone
 * i Workerns logg.
 */
async function alert(env: Env, failures: { name: string; desc: string; detail: string }[]) {
  const rader = failures.map((f) => `${f.desc} (${f.name}): ${f.detail}`).join("\n");
  console.error(`Cron-jobb misslyckades:\n${rader}`);

  if (!env.RESEND_API_KEY) return;
  const to = env.ALERT_EMAIL ?? "pablo.acosta@usha.se";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Usha <no-reply@usha.se>",
        to,
        subject: `Cron: ${failures.length} jobb misslyckades`,
        text: `Schemaläggaren körde men följande jobb svarade inte som de skulle.\n\n${rader}\n\nKör om manuellt:\ncurl -H "Authorization: Bearer $CRON_SECRET" https://usha.se/api/cron/<jobb>`,
      }),
    });
  } catch (err) {
    console.error("Larmmejlet gick inte att skicka", err);
  }
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const failures: { name: string; desc: string; detail: string }[] = [];
        for (const job of JOBS) {
          const res = await runJob(env, job.name);
          if (res.ok) console.log(`${job.name}: ${res.detail}`);
          else failures.push({ name: job.name, desc: job.desc, detail: res.detail });
        }
        if (failures.length) await alert(env, failures);
      })()
    );
  },

  /**
   * Manuell körning för felsökning, skyddad av samma hemlighet som jobben.
   * Utan den kan man bara vänta på nästa hela timme för att se om schemat lever.
   */
  async fetch(req: Request, env: Env): Promise<Response> {
    const auth = req.headers.get("authorization");
    if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const results: Record<string, string> = {};
    const failures: { name: string; desc: string; detail: string }[] = [];
    for (const job of JOBS) {
      const res = await runJob(env, job.name);
      results[job.name] = `${res.ok ? "ok" : "FEL"} ${res.detail}`;
      if (!res.ok) failures.push({ name: job.name, desc: job.desc, detail: res.detail });
    }
    // Larmar även här, så att larmvägen går att prova skarpt utan att vänta på
    // nästa hela timme. Ett larm ingen testat är ett larm man inte har.
    if (failures.length) await alert(env, failures);
    return Response.json(results);
  },
};
