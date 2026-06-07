"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Check } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

export function AcceptButton({ token, listingSlug }: { token: string; listingSlug: string | null }) {
  const t = useTranslations("invites");
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAccept() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "bankid_required") {
          toast.error(t("bankidRequired"));
          router.push(`/dashboard/profile?bankid_next=${encodeURIComponent(`/app/invites/${token}`)}`);
          return;
        }
        toast.error(data.error ?? "Could not accept invitation");
        return;
      }
      setDone(true);
      toast.success(t("successTitle"));
      setTimeout(() => {
        if (listingSlug) router.push(`/event/${listingSlug}`);
        else router.push("/app/my-collaborations");
      }, 1200);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl bg-green-500/15 px-6 py-3 text-sm font-bold text-green-300">
        <Check size={18} />
        {t("successTitle")}
      </div>
    );
  }

  return (
    <button
      onClick={handleAccept}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black shadow-lg transition hover:opacity-90 disabled:opacity-60 sm:text-lg"
    >
      {loading ? <Loader2 size={20} className="animate-spin" /> : null}
      {loading ? t("accepting") : t("accept")}
    </button>
  );
}
