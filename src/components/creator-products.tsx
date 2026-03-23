"use client";

import { Film, BookOpen, Download, Package, ShoppingCart } from "lucide-react";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  product_type: string;
  video_url: string | null;
  thumbnail_url: string | null;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Film size={18} />,
  course: <BookOpen size={18} />,
  download: <Download size={18} />,
  other: <Package size={18} />,
};

export function CreatorProducts({
  products,
  isLoggedIn,
  creatorId,
}: {
  products: Product[];
  isLoggedIn: boolean;
  creatorId: string;
}) {
  if (products.length === 0) return null;

  async function handleBuy(productId: string) {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }

    try {
      const res = await fetch("/api/stripe/product-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Något gick fel");
      }
    } catch {
      alert("Kunde inte starta köp");
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Digitalt innehåll</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5"
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
                {TYPE_ICONS[product.product_type] || TYPE_ICONS.other}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{product.title}</h3>
                {product.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--usha-muted)]">
                    {product.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-[var(--usha-gold)]">
                {product.price} SEK
              </span>
              <button
                onClick={() => handleBuy(product.id)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-bold text-black transition hover:opacity-90"
              >
                <ShoppingCart size={14} />
                Köp
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
