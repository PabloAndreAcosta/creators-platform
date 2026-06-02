"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface Props {
  role: "creator" | "experience";
  label: string;
  className: string;
}

export function BankIdVerifyButton({ role, label, className }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/bankid/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, mode: "add" }),
      });
      const data = await res.json();
      if (!res.ok || !data.authenticationUrl) {
        toast.error("Kunde inte starta BankID", data.error ?? "Försök igen.");
        setLoading(false);
        return;
      }
      window.location.href = data.authenticationUrl;
    } catch {
      toast.error("Kunde inte starta BankID", "Försök igen.");
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} className={className} type="button">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
      {label}
    </button>
  );
}
