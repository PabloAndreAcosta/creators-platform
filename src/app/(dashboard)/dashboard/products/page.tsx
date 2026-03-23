import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Package, Film, BookOpen, Download } from "lucide-react";
import { ProductForm } from "./product-form";
import { DeleteProductButton } from "./delete-product-button";

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  video: { label: "Video", icon: "film" },
  course: { label: "Kurs", icon: "book" },
  download: { label: "Nedladdning", icon: "download" },
  other: { label: "Övrigt", icon: "package" },
};

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: products } = await supabase
    .from("digital_products")
    .select("id, title, description, price, product_type, video_url, thumbnail_url, is_active, created_at")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  // Get purchase counts
  const productIds = (products || []).map((p) => p.id);
  let purchaseCounts: Record<string, number> = {};
  if (productIds.length > 0) {
    const { data: purchases } = await supabase
      .from("digital_purchases")
      .select("product_id")
      .in("product_id", productIds);
    purchaseCounts = (purchases || []).reduce((acc, p) => {
      acc[p.product_id] = (acc[p.product_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Digitalt innehåll</h1>
            <p className="mt-1 text-[var(--usha-muted)]">
              Sätt upp videokurser, downloads och annat digitalt material till salu.
            </p>
          </div>
        </div>
      </div>

      {/* New product form */}
      <div className="mb-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
        <h2 className="mb-4 text-lg font-bold">Lägg till produkt</h2>
        <ProductForm />
      </div>

      {/* Existing products */}
      <div className="space-y-4">
        {(!products || products.length === 0) ? (
          <div className="rounded-2xl border border-dashed border-[var(--usha-border)] py-16 text-center">
            <Package size={32} className="mx-auto mb-3 text-[var(--usha-muted)]" />
            <p className="text-sm text-[var(--usha-muted)]">Inga digitala produkter ännu.</p>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5"
            >
              {/* Thumbnail */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
                {product.product_type === "video" && <Film size={20} className="text-[var(--usha-gold)]" />}
                {product.product_type === "course" && <BookOpen size={20} className="text-[var(--usha-gold)]" />}
                {product.product_type === "download" && <Download size={20} className="text-[var(--usha-gold)]" />}
                {product.product_type === "other" && <Package size={20} className="text-[var(--usha-gold)]" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{product.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    product.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {product.is_active ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
                {product.description && (
                  <p className="mt-0.5 truncate text-xs text-[var(--usha-muted)]">{product.description}</p>
                )}
                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--usha-muted)]">
                  <span className="font-semibold text-[var(--usha-gold)]">{product.price} SEK</span>
                  <span>{TYPE_LABELS[product.product_type]?.label || product.product_type}</span>
                  <span>{purchaseCounts[product.id] || 0} köp</span>
                </div>
              </div>

              <DeleteProductButton productId={product.id} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
