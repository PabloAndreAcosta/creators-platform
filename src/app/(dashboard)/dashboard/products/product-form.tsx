"use client";

import { useTransition, useRef, useState } from "react";
import { useToast } from "@/components/ui/toaster";
import { createProduct } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Upload } from "lucide-react";

const inputClass = "w-full min-h-[44px] rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-base sm:text-sm outline-none transition focus:border-[var(--usha-gold)]/40";

export function ProductForm() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024 * 1024) {
      toast.error("För stor fil", "Max 500 MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("creator-media")
      .upload(path, file, { upsert: false });

    if (error) {
      toast.error("Uppladdning misslyckades", error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("creator-media").getPublicUrl(path);
    setVideoUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Video uppladdad");
  }

  function handleSubmit(formData: FormData) {
    formData.set("video_url", videoUrl);

    startTransition(async () => {
      const result = await createProduct(formData);
      if (result.error) {
        toast.error("Kunde inte skapa produkt", result.error);
      } else {
        toast.success("Produkt skapad");
        formRef.current?.reset();
        setVideoUrl("");
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Titel</label>
          <input name="title" type="text" required placeholder="t.ex. Grundkurs i salsa" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Typ</label>
          <select name="product_type" required className={inputClass}>
            <option value="video">Video</option>
            <option value="course">Kurs</option>
            <option value="download">Nedladdning</option>
            <option value="other">Övrigt</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--usha-muted)]">Beskrivning</label>
        <textarea name="description" rows={3} placeholder="Beskriv produkten..." className={`${inputClass} resize-none`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Pris (SEK)</label>
          <input name="price" type="number" min={0} required placeholder="t.ex. 199" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Video</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="URL eller ladda upp"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--usha-border)] px-3 py-2 text-xs text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/40 hover:text-white disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Skapar..." : "Skapa produkt"}
        </button>
      </div>
    </form>
  );
}
