"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Video,
  FileDown,
  Package,
  Play,
  Download,
  ExternalLink,
  BookMarked,
} from "lucide-react";

interface Purchase {
  id: string;
  amount_paid: number;
  created_at: string;
  digital_products: {
    id: string;
    title: string;
    description: string | null;
    product_type: string;
    video_url: string | null;
    file_url: string | null;
    creator_id: string;
    profiles: {
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
}

interface LibraryContentProps {
  purchases: Purchase[];
}

const TYPE_ICONS: Record<string, typeof Video> = {
  video: Video,
  course: BookOpen,
  download: FileDown,
  other: Package,
};

const TYPE_LABELS: Record<string, string> = {
  video: "Video",
  course: "Kurs",
  download: "Nedladdning",
  other: "Övrigt",
};

export function LibraryContent({ purchases }: LibraryContentProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all"
    ? purchases
    : purchases.filter((p) => p.digital_products?.product_type === filter);

  const typeCount = purchases.reduce<Record<string, number>>((acc, p) => {
    const type = p.digital_products?.product_type || "other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Mitt bibliotek</h1>

      {purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--usha-card)]">
            <BookOpen size={24} className="text-[var(--usha-muted)]" />
          </div>
          <p className="text-base font-medium">Inga köp ännu</p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            Utforska kreatörer och köp kurser, videos och annat material
          </p>
          <Link
            href="/marketplace"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-2.5 text-sm font-bold text-black"
          >
            Utforska marketplace
          </Link>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === "all"
                  ? "bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]"
                  : "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-white"
              }`}
            >
              Alla ({purchases.length})
            </button>
            {Object.entries(typeCount).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === type
                    ? "bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]"
                    : "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-white"
                }`}
              >
                {TYPE_LABELS[type] || "Övrigt"} ({count})
              </button>
            ))}
          </div>

          {/* Purchases list */}
          <div className="space-y-3">
            {filtered.map((purchase) => (
              <PurchaseCard key={purchase.id} purchase={purchase} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const product = purchase.digital_products;
  if (!product) return null;

  const Icon = TYPE_ICONS[product.product_type] || Package;
  const creator = product.profiles;

  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10">
          <Icon size={20} className="text-[var(--usha-gold)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{product.title}</h3>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--usha-muted)]">
              {product.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--usha-muted)]">
            <span>{TYPE_LABELS[product.product_type] || "Övrigt"}</span>
            {creator?.full_name && (
              <Link
                href={`/creators/${product.creator_id}`}
                className="flex items-center gap-1 hover:text-[var(--usha-gold)]"
              >
                {creator.avatar_url ? (
                  <img src={creator.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                ) : null}
                {creator.full_name}
              </Link>
            )}
            <span>
              {purchase.amount_paid > 0 ? `${purchase.amount_paid} kr` : "Gratis"}
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        {product.video_url && (
          <a
            href={product.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-[var(--usha-gold)]/10 px-3 py-2 text-xs font-medium text-[var(--usha-gold)] transition hover:bg-[var(--usha-gold)]/20"
          >
            <Play size={12} />
            Titta
          </a>
        )}
        {product.file_url && (
          <a
            href={product.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-[var(--usha-gold)]/10 px-3 py-2 text-xs font-medium text-[var(--usha-gold)] transition hover:bg-[var(--usha-gold)]/20"
          >
            <Download size={12} />
            Ladda ner
          </a>
        )}
        <Link
          href={`/creators/${product.creator_id}`}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--usha-card)] px-3 py-2 text-xs font-medium text-[var(--usha-muted)] transition hover:text-white"
        >
          <ExternalLink size={12} />
          Kreatörens profil
        </Link>
      </div>
    </div>
  );
}
