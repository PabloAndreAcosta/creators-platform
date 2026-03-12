"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Facebook, Link2, Link2Off, Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface FacebookConnectProps {
  pageName: string | null;
  pageId: string | null;
}

export function FacebookConnect({ pageName, pageId }: FacebookConnectProps) {
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleImport() {
    setImporting(true);
    try {
      const res = await fetch("/api/facebook/import-events");
      const data = await res.json();
      if (!res.ok) {
        toast.error("Import misslyckades", data.error);
      } else if (data.imported === 0) {
        toast.info("Inga nya evenemang", data.message);
      } else {
        toast.success(`${data.imported} evenemang importerade`);
        router.refresh();
      }
    } catch {
      toast.error("Fel", "Kunde inte importera evenemang");
    } finally {
      setImporting(false);
    }
  }

  if (!pageId) {
    return (
      <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Facebook size={16} className="text-[#1877F2]" />
          <span className="text-sm font-medium">Facebook-synk</span>
        </div>
        <p className="mb-4 text-xs text-[var(--usha-muted)]">
          Anslut din Facebook-sida för att synka evenemang åt båda håll — publicera Usha-event på Facebook och importera befintliga Facebook-event.
        </p>
        <a
          href="/api/facebook/connect"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Facebook size={15} />
          Anslut Facebook-sida
        </a>
        <p className="mt-2 text-center text-[10px] text-[var(--usha-muted)]">
          Kräver en Facebook-sida (ej personligt konto)
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1877F2]/30 bg-[var(--usha-card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Facebook size={16} className="text-[#1877F2]" />
          <span className="text-sm font-medium">Facebook-synk</span>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
          <Link2 size={10} />
          Ansluten
        </span>
      </div>

      <p className="mb-4 text-xs text-[var(--usha-muted)]">
        Sida: <span className="font-medium text-white">{pageName}</span>
      </p>

      <div className="flex flex-col gap-2">
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-2.5 text-sm font-medium text-[var(--usha-muted)] transition hover:border-[#1877F2]/40 hover:text-white disabled:opacity-50"
        >
          {importing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          Importera från Facebook
        </button>

        <form action="/api/facebook/disconnect" method="POST">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs text-red-400 transition hover:text-red-300"
          >
            <Link2Off size={12} />
            Koppla bort
          </button>
        </form>
      </div>
    </div>
  );
}
