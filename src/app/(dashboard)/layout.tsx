import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <header className="border-b border-[var(--usha-border)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
              <span className="text-sm font-bold text-black">U</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Usha</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--usha-muted)]">
              {profile?.full_name || user.email}
            </span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="rounded-md p-2 text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card)] hover:text-white"
                title="Logga ut"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
