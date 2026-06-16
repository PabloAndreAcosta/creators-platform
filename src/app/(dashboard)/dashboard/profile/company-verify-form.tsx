"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

export function CompanyVerifyForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [orgNumber, setOrgNumber] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/venue/verify-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        toast.error("Verifiering misslyckades", data.error ?? "Försök igen.");
        setLoading(false);
        return;
      }
      toast.success(
        "Bolag verifierat",
        data.companyName ? `${data.companyName} är nu verifierat.` : "Ditt bolag är nu verifierat."
      );
      router.refresh();
    } catch {
      toast.error("Verifiering misslyckades", "Försök igen.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <input
        type="text"
        inputMode="numeric"
        value={orgNumber}
        onChange={(e) => setOrgNumber(e.target.value)}
        placeholder="Organisationsnummer (t.ex. 559401-8326)"
        autoComplete="off"
        required
        className="flex-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
        Verifiera bolag
      </button>
    </form>
  );
}
