"use client";

import { useState } from "react";
import { Tag, Check, X, Loader2 } from "lucide-react";

interface PromoCodeInputProps {
  scope: "subscription" | "ticket";
  planKey?: string;
  originalPrice?: number;
  onValidCode: (code: string, discountInfo: DiscountInfo | null) => void;
}

export interface DiscountInfo {
  discount_type: "percent" | "fixed";
  discount_value: number;
  preview?: {
    discountedPrice: number;
    discountAmount: number;
  };
}

export function PromoCodeInput({
  scope,
  planKey,
  originalPrice,
  onValidCode,
}: PromoCodeInputProps) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [error, setError] = useState("");
  const [discountInfo, setDiscountInfo] = useState<DiscountInfo | null>(null);

  async function handleValidate() {
    if (!code.trim()) return;

    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          scope,
          planKey,
          originalPrice,
        }),
      });

      const data = await res.json();

      if (data.valid) {
        setStatus("valid");
        const info: DiscountInfo = {
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          preview: data.preview,
        };
        setDiscountInfo(info);
        onValidCode(code.trim().toUpperCase(), info);
      } else {
        setStatus("invalid");
        setError(data.error || "Ogiltig promokod.");
        onValidCode("", null);
      }
    } catch {
      setStatus("invalid");
      setError("Kunde inte validera koden. Försök igen.");
      onValidCode("", null);
    }
  }

  function handleClear() {
    setCode("");
    setStatus("idle");
    setError("");
    setDiscountInfo(null);
    onValidCode("", null);
  }

  const discountLabel = discountInfo
    ? discountInfo.discount_type === "percent"
      ? `${discountInfo.discount_value}% rabatt`
      : `${discountInfo.discount_value} SEK rabatt`
    : "";

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--usha-muted)]">
        <Tag size={12} />
        Promokod
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (status !== "idle") {
                setStatus("idle");
                setError("");
                setDiscountInfo(null);
                onValidCode("", null);
              }
            }}
            placeholder="Ange kod"
            disabled={status === "valid"}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal transition-colors ${
              status === "valid"
                ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-400"
                : status === "invalid"
                  ? "border-red-500/50 bg-red-500/5"
                  : "border-[var(--usha-border)] bg-[var(--usha-black)]"
            } disabled:opacity-70`}
          />
          {status === "valid" && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--usha-muted)] hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {status !== "valid" && (
          <button
            onClick={handleValidate}
            disabled={!code.trim() || status === "loading"}
            className="rounded-lg border border-[var(--usha-border)] px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--usha-gold)]/30 hover:text-white disabled:opacity-50"
          >
            {status === "loading" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              "Använd"
            )}
          </button>
        )}
      </div>

      {status === "valid" && (
        <p className="flex items-center gap-1 text-xs text-emerald-400">
          <Check size={12} />
          {discountLabel} tillagd!
          {discountInfo?.preview && (
            <span className="text-[var(--usha-muted)]">
              {" "}
              — Nytt pris: {discountInfo.preview.discountedPrice} SEK
            </span>
          )}
        </p>
      )}

      {status === "invalid" && error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
