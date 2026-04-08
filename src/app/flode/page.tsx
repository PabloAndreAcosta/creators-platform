import { createClient } from "@/lib/supabase/server";
import { getFeedPosts } from "@/app/app/feed/queries";
import { Feed } from "@/components/feed/feed";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flöde – Usha",
  description:
    "Se vad kreatörer och upplevelser delar just nu. Boka och köp direkt från flödet.",
  openGraph: {
    title: "Flöde – Usha",
    description:
      "Se vad kreatörer och upplevelser delar just nu. Boka och köp direkt från flödet.",
  },
};

export default async function FlodePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const feedPosts = await getFeedPosts(user?.id);

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-gradient">
            Usha
          </Link>
          {user ? (
            <Link
              href="/app"
              className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-1.5 text-xs font-bold text-black transition hover:opacity-90"
            >
              Min sida
            </Link>
          ) : (
            <Link
              href="/signup"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--usha-muted)] transition hover:text-white"
            >
              Skapa profil
            </Link>
          )}
        </div>
      </header>

      {/* Feed */}
      <main className="mx-auto max-w-lg">
        <div className="px-4 pb-2 pt-4">
          <h1 className="text-lg font-bold">Flöde</h1>
          <p className="text-xs text-[var(--usha-muted)]">
            Se vad kreatörer och upplevelser delar just nu
          </p>
        </div>

        <Feed
          initialPosts={feedPosts}
          isLoggedIn={!!user}
          currentUserId={user?.id}
        />
      </main>
    </div>
  );
}
