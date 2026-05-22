"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { useTranslations } from "next-intl";

export function ProfileQR({
  profileSlug,
  profileId,
  fullName,
}: {
  profileSlug: string | null;
  profileId: string;
  fullName: string | null;
}) {
  const t = useTranslations("dashProfile.qr");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const slug = profileSlug || profileId;
  const profileUrl = `https://usha.se/creators/${slug}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(profileUrl, {
      width: 512,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) toast.error(t("generateError"));
      });
    return () => {
      cancelled = true;
    };
  }, [profileUrl, toast, t]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, profileUrl, {
      width: 192,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [profileUrl]);

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `usha-qr-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("copyError"));
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-xl bg-white p-3">
          <canvas ref={canvasRef} aria-label={t("canvasAriaNamed", { name: fullName || t("canvasAriaFallback") })} />
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-1">
          <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2.5 text-xs text-[var(--usha-muted)] break-all">
            {profileUrl}
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-2.5 text-sm font-medium text-[var(--usha-muted)] transition hover:text-white"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? t("copied") : t("copyLink")}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!dataUrl}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            <Download size={14} />
            {t("download")}
          </button>
        </div>
      </div>
    </div>
  );
}
