"use client";

import { useState, useRef } from "react";
import {
  Clock,
  Edit2,
  Trash2,
  Plus,
  MoreVertical,
  DollarSign,
  BookOpen,
  Loader2,
  Video,
  FileDown,
  Package,
  Users,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createProduct, deleteProduct } from "./actions";

// ─── Types ───

interface ListingData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
}

interface DigitalProductData {
  id: string;
  title: string;
  description: string | null;
  price: number;
  product_type: string;
  file_url: string | null;
  video_url: string | null;
  is_active: boolean;
  purchase_count: number;
  created_at: string;
}

interface ContentPageContentProps {
  listings: ListingData[];
  digitalProducts: DigitalProductData[];
}

type Tab = "online" | "services";

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

// ─── Main Component ───

export function ContentPageContent({ listings, digitalProducts }: ContentPageContentProps) {
  const [tab, setTab] = useState<Tab>("online");

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mitt innehåll</h1>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-1">
        <button
          onClick={() => setTab("online")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "online"
              ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black"
              : "text-[var(--usha-muted)] hover:text-white"
          }`}
        >
          Onlinematerial
          <span className="ml-1.5 text-xs opacity-70">({digitalProducts.length})</span>
        </button>
        <button
          onClick={() => setTab("services")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "services"
              ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black"
              : "text-[var(--usha-muted)] hover:text-white"
          }`}
        >
          Tjänster
          <span className="ml-1.5 text-xs opacity-70">({listings.length})</span>
        </button>
      </div>

      {tab === "online" ? (
        <OnlineMaterialTab products={digitalProducts} />
      ) : (
        <ServicesTab listings={listings} />
      )}
    </div>
  );
}

// ─── Online Material Tab ───

function OnlineMaterialTab({ products }: { products: DigitalProductData[] }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      {products.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16">
          <Video size={40} className="mb-4 text-[var(--usha-muted)]" />
          <p className="text-base font-medium text-[var(--usha-muted)]">Inget onlinematerial ännu</p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            Lägg upp kurser, workshops och videor som dina kunder kan köpa
          </p>
        </div>
      )}

      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}

      {showForm ? (
        <CreateProductForm onClose={() => setShowForm(false)} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
        >
          <Plus size={18} />
          Lägg till onlinematerial
        </button>
      )}
    </div>
  );
}

// ─── Product Card ───

function ProductCard({ product }: { product: DigitalProductData }) {
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const Icon = TYPE_ICONS[product.product_type] || Package;

  async function handleDelete() {
    setDeleting(true);
    await deleteProduct(product.id);
    router.refresh();
    setDeleting(false);
    setShowConfirm(false);
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10">
        <Icon size={20} className="text-[var(--usha-gold)]" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold">{product.title}</h3>
        <div className="flex items-center gap-3 text-xs text-[var(--usha-muted)]">
          <span>{TYPE_LABELS[product.product_type] || "Övrigt"}</span>
          <span>{product.price > 0 ? `${product.price} kr` : "Gratis"}</span>
          <span className="flex items-center gap-1">
            <Users size={10} /> {product.purchase_count} köp
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          product.is_active ? "bg-green-500/10 text-green-400" : "bg-[var(--usha-border)] text-[var(--usha-muted)]"
        }`}>
          {product.is_active ? "Aktiv" : "Inaktiv"}
        </span>
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded-lg p-1.5 text-[var(--usha-muted)] hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold">Ta bort?</h3>
            <p className="mb-5 text-sm text-[var(--usha-muted)]">
              Är du säker på att du vill ta bort &ldquo;{product.title}&rdquo;?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-xl border border-[var(--usha-border)] py-2.5 text-sm font-medium">Avbryt</button>
              <button onClick={handleDelete} disabled={deleting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Ta bort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Product Form ───

function CreateProductForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [productType, setProductType] = useState("course");
  const [videoUrl, setVideoUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      setError("Filen får vara max 500 MB");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/products/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("creator-media").upload(path, file);

    if (uploadError) {
      setError("Kunde inte ladda upp filen");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("creator-media").getPublicUrl(path);
    setFileUrl(urlData.publicUrl);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Titel krävs"); return; }
    setSubmitting(true);
    setError("");

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("price", price || "0");
    formData.set("product_type", productType);
    if (videoUrl) formData.set("video_url", videoUrl);

    const result = await createProduct(formData);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      router.refresh();
      onClose();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 space-y-4">
      <h3 className="font-semibold">Nytt onlinematerial</h3>

      <div>
        <label className="mb-1 block text-xs text-[var(--usha-muted)]">Typ</label>
        <select
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-sm outline-none"
        >
          <option value="course">Kurs</option>
          <option value="video">Video / Workshop</option>
          <option value="download">Nedladdning (PDF, fil)</option>
          <option value="other">Övrigt</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--usha-muted)]">Titel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="T.ex. Salsa för nybörjare"
          className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-sm outline-none focus:border-[var(--usha-gold)]/40"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--usha-muted)]">Beskrivning</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Beskriv vad som ingår..."
          className="w-full resize-none rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-sm outline-none focus:border-[var(--usha-gold)]/40"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--usha-muted)]">Pris (SEK)</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0 = Gratis"
          min="0"
          className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-sm outline-none focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {(productType === "video" || productType === "course") && (
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Video-URL (YouTube, Vimeo, etc.)</label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-sm outline-none focus:border-[var(--usha-gold)]/40"
          />
        </div>
      )}

      {productType === "download" && (
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Ladda upp fil (max 500 MB)</label>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--usha-border)] px-4 py-2 text-xs text-[var(--usha-muted)] hover:border-[var(--usha-gold)]/30"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {fileUrl ? "Fil uppladdad" : uploading ? "Laddar upp..." : "Välj fil"}
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--usha-border)] py-2.5 text-sm font-medium text-[var(--usha-muted)]">
          Avbryt
        </button>
        <button
          type="submit"
          disabled={submitting || uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Publicera
        </button>
      </div>
    </form>
  );
}

// ─── Services Tab ───

const COURSE_IMAGES = [
  "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=200&fit=crop",
];

function ServicesTab({ listings }: { listings: ListingData[] }) {
  if (listings.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16">
          <BookOpen size={40} className="mb-4 text-[var(--usha-muted)]" />
          <p className="text-base font-medium text-[var(--usha-muted)]">Inga tjänster ännu</p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">Skapa din första tjänst för att komma igång</p>
        </div>
        <Link
          href="/dashboard/listings/new"
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
        >
          <Plus size={18} />
          Lägg till tjänst
        </Link>
      </div>
    );
  }

  const activeCount = listings.filter((l) => l.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--usha-muted)]">{activeCount} aktiva tjänster</span>
      </div>

      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
        {listings.map((listing, i) => (
          <ServiceCard key={listing.id} listing={listing} index={i} />
        ))}
      </div>

      <Link
        href="/dashboard/listings/new"
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
      >
        <Plus size={18} />
        Lägg till tjänst
      </Link>
    </div>
  );
}

function ServiceCard({ listing, index }: { listing: ListingData; index: number }) {
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const image = listing.image_url || COURSE_IMAGES[index % COURSE_IMAGES.length];

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setShowConfirm(false);
      setShowMenu(false);
    }
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-[var(--usha-card)] ${listing.is_active ? "border-[var(--usha-border)]" : "border-[var(--usha-border)] opacity-70"}`}>
      <Link href={`/listing/${listing.id}`} className="relative block h-36">
        <img src={image} alt={listing.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${listing.is_active ? "bg-green-500/90 text-white" : "bg-[var(--usha-muted)]/80 text-white"}`}>
          {listing.is_active ? "Aktiv" : "Inaktiv"}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          {listing.category || "Övrigt"}
        </span>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-base font-bold text-white">{listing.title}</h3>
        </div>
      </Link>
      <div className="p-4">
        <div className="mb-3 flex items-center gap-3 text-xs text-[var(--usha-muted)]">
          {listing.duration_minutes && (
            <span className="flex items-center gap-1"><Clock size={12} />{listing.duration_minutes} min</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <DollarSign size={14} className="text-[var(--usha-gold)]" />
            <span className="text-sm font-medium">{listing.price ? `${listing.price} kr` : "Gratis"}</span>
          </div>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="rounded-lg p-2 text-[var(--usha-muted)] hover:bg-[var(--usha-card-hover)] hover:text-white">
              <MoreVertical size={16} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute bottom-full right-0 z-20 mb-1 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] py-1 shadow-xl">
                  <Link href={`/dashboard/listings/${listing.id}/edit`} className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]" onClick={() => setShowMenu(false)}>
                    <Edit2 size={12} /> Redigera
                  </Link>
                  <button onClick={() => { setShowMenu(false); setShowConfirm(true); }} className="flex w-full items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-[var(--usha-card-hover)]">
                    <Trash2 size={12} /> Ta bort
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold">Ta bort tjänst?</h3>
            <p className="mb-5 text-sm text-[var(--usha-muted)]">Är du säker på att du vill ta bort &ldquo;{listing.title}&rdquo;?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-xl border border-[var(--usha-border)] py-2.5 text-sm font-medium">Avbryt</button>
              <button onClick={handleDelete} disabled={deleting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Ta bort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
