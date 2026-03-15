"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Facebook, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface FBPage {
  id: string;
  name: string;
  token: string;
}

export default function SelectFacebookPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [selecting, setSelecting] = useState<string | null>(null);

  let pages: FBPage[] = [];
  try {
    pages = JSON.parse(decodeURIComponent(searchParams.get("pages") || "[]"));
  } catch {
    pages = [];
  }

  async function handleSelect(page: FBPage) {
    setSelecting(page.id);
    try {
      const res = await fetch("/api/facebook/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id, pageName: page.name, pageToken: page.token }),
      });
      if (res.ok) {
        toast.success("Facebook-sida ansluten", page.name);
        router.push("/app/events?fb_connected=1");
      } else {
        toast.error("Kunde inte ansluta sidan");
        setSelecting(null);
      }
    } catch {
      toast.error("Något gick fel");
      setSelecting(null);
    }
  }

  if (pages.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-[var(--usha-muted)]">Inga sidor att visa.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 md:max-w-lg md:mx-auto">
      <div className="text-center">
        <Facebook size={32} className="mx-auto mb-3 text-[#1877F2]" />
        <h1 className="text-2xl font-bold">Välj Facebook-sida</h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          Du hanterar flera sidor. Vilken vill du ansluta?
        </p>
      </div>

      <div className="space-y-2">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => handleSelect(page)}
            disabled={selecting !== null}
            className="flex w-full items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-left transition-colors hover:border-[#1877F2]/40 disabled:opacity-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2]/10">
              <Facebook size={18} className="text-[#1877F2]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{page.name}</p>
              <p className="text-xs text-[var(--usha-muted)]">ID: {page.id}</p>
            </div>
            {selecting === page.id && (
              <Loader2 size={16} className="animate-spin text-[#1877F2]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
