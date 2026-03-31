"use client";

import { useState, useRef } from "react";
import { ImagePlus, X, Link as LinkIcon, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "@/app/app/feed/actions";
import { useToast } from "@/components/ui/toaster";

interface Listing {
  id: string;
  title: string;
}

interface CreatePostFormProps {
  authorName: string;
  authorAvatar: string | null;
  listings: Listing[];
}

export function CreatePostForm({ authorName, authorAvatar, listings }: CreatePostFormProps) {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [listingId, setListingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Bilden får vara max 5 MB");
      return;
    }

    setUploading(true);
    setImagePreview(URL.createObjectURL(file));

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("creator-media")
      .upload(path, file);

    if (error) {
      toast.error("Kunde inte ladda upp bilden");
      setImagePreview(null);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("creator-media")
      .getPublicUrl(path);

    setImageUrl(urlData.publicUrl);
    setUploading(false);
  }

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.set("text", text);
    if (imageUrl) formData.set("image_url", imageUrl);
    if (listingId) formData.set("listing_id", listingId);

    const result = await createPost(formData);

    if (result?.error) {
      toast.error(result.error);
    } else {
      setText("");
      setImageUrl(null);
      setImagePreview(null);
      setListingId("");
      setExpanded(false);
    }
    setSubmitting(false);
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-left transition hover:border-[var(--usha-gold)]/20"
      >
        {authorAvatar ? (
          <img src={authorAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
            <span className="text-sm font-bold text-[var(--usha-gold)]">{(authorName || "?")[0]}</span>
          </div>
        )}
        <span className="text-sm text-[var(--usha-muted)]">Dela en uppdatering...</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      {/* Text input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Vad vill du dela?"
        rows={3}
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--usha-muted)]"
        autoFocus
      />

      {/* Image preview */}
      {imagePreview && (
        <div className="relative mt-3 overflow-hidden rounded-xl">
          <img src={imagePreview} alt="" className="w-full max-h-[300px] object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 size={24} className="animate-spin text-white" />
            </div>
          )}
          <button
            onClick={() => { setImagePreview(null); setImageUrl(null); }}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1"
          >
            <X size={14} className="text-white" />
          </button>
        </div>
      )}

      {/* Listing picker */}
      {listings.length > 0 && (
        <select
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
          className="mt-3 w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-xs text-[var(--usha-muted)] outline-none"
        >
          <option value="">Koppla till en tjänst/event (valfritt)</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
        </select>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--usha-border)] pt-3">
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--usha-muted)] transition hover:bg-[var(--usha-gold)]/10 hover:text-[var(--usha-gold)]"
          >
            <ImagePlus size={16} />
            Bild
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setExpanded(false); setText(""); setImagePreview(null); setImageUrl(null); }}
            className="rounded-lg px-3 py-1.5 text-xs text-[var(--usha-muted)] transition hover:text-white"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || uploading || submitting}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-1.5 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Publicera
          </button>
        </div>
      </div>
    </div>
  );
}
