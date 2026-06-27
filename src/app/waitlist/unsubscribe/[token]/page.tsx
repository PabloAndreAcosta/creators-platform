import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avregistrera – Usha Platform" };

// GDPR: a guest unsubscribes from an event waitlist via their unique token.
// Idempotent — re-visiting an already-unsubscribed token still confirms.
export default async function UnsubscribePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const admin = createAdminClient();

  // Match on the token only; set unsubscribed_at if not already set.
  const { data: row } = await admin
    .from("event_waitlist")
    .select("id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  let ok = false;
  if (row) {
    ok = true;
    if (!row.unsubscribed_at) {
      await admin
        .from("event_waitlist")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--usha-black)] p-6 text-[var(--usha-white)]">
      <div className="max-w-md rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8 text-center">
        {ok ? (
          <>
            <h1 className="text-xl font-bold text-[var(--usha-gold)]">Du är avregistrerad</h1>
            <p className="mt-3 text-sm text-[var(--usha-muted)]">
              Du tas bort från väntelistan och får inga fler utskick för det här eventet.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Länken är ogiltig</h1>
            <p className="mt-3 text-sm text-[var(--usha-muted)]">
              Avregistreringslänken kunde inte hittas. Den kan redan ha använts.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
