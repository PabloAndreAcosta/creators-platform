"use client";

import { useState } from "react";
import {
  Share2,
  Facebook,
  Copy,
  Check,
  X,
  MessageCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface SocialShareButtonProps {
  /** Listing/event title */
  title: string;
  /** Short description or excerpt */
  description?: string;
  /** Public URL to share (e.g. creator profile or listing page) */
  url: string;
  /** Optional: event date for richer share text */
  eventDate?: string | null;
  /** Optional: event location */
  eventLocation?: string | null;
  /** Optional: price in SEK */
  price?: number | null;
}

export function SocialShareButton({
  title,
  description,
  url,
  eventDate,
  eventLocation,
  price,
}: SocialShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Build share text
  const parts = [title];
  if (eventDate) {
    parts.push(
      new Date(eventDate + "T00:00").toLocaleDateString("sv-SE", {
        day: "numeric",
        month: "long",
      })
    );
  }
  if (eventLocation) parts.push(eventLocation);
  if (price != null) parts.push(price > 0 ? `${price} kr` : "Gratis");
  const shareText = parts.join(" — ");

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  function getFacebookUrl() {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  }

  function getTwitterUrl() {
    return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
  }

  function getWhatsAppUrl() {
    return `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  }

  function getLinkedInUrl() {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Länk kopierad!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kunde inte kopiera länken");
    }
  }

  async function handleNativeShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title,
        text: description || shareText,
        url,
      });
    } catch {
      // User cancelled
    }
  }

  function openLink(href: string) {
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=500");
    setOpen(false);
  }

  const platforms = [
    {
      name: "Facebook",
      icon: <Facebook size={16} />,
      color: "text-[#1877F2]",
      bg: "hover:bg-[#1877F2]/10",
      action: () => openLink(getFacebookUrl()),
    },
    {
      name: "X / Twitter",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      color: "text-white",
      bg: "hover:bg-white/10",
      action: () => openLink(getTwitterUrl()),
    },
    {
      name: "WhatsApp",
      icon: <MessageCircle size={16} />,
      color: "text-[#25D366]",
      bg: "hover:bg-[#25D366]/10",
      action: () => openLink(getWhatsAppUrl()),
    },
    {
      name: "LinkedIn",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      color: "text-[#0A66C2]",
      bg: "hover:bg-[#0A66C2]/10",
      action: () => openLink(getLinkedInUrl()),
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => {
          // Use native share on mobile if available
          if (navigator.share && window.innerWidth < 768) {
            handleNativeShare();
          } else {
            setOpen(!open);
          }
        }}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
      >
        <Share2 size={12} />
        Dela
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute bottom-full right-0 z-20 mb-2 w-56 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-2 shadow-xl">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs font-medium text-[var(--usha-muted)]">
                Dela till
              </span>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-0.5 text-[var(--usha-muted)] hover:text-white"
              >
                <X size={12} />
              </button>
            </div>

            {platforms.map((p) => (
              <button
                key={p.name}
                onClick={p.action}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${p.bg}`}
              >
                <span className={p.color}>{p.icon}</span>
                {p.name}
              </button>
            ))}

            {/* Divider */}
            <div className="my-1 border-t border-[var(--usha-border)]" />

            {/* Copy link */}
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/5"
            >
              {copied ? (
                <Check size={16} className="text-green-400" />
              ) : (
                <Copy size={16} className="text-[var(--usha-muted)]" />
              )}
              {copied ? "Kopierad!" : "Kopiera länk"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
