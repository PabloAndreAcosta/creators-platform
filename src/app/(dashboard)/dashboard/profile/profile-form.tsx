"use client";

import { useRef, useState, useTransition } from "react";
import { updateProfile, updateAvatar } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toaster";
import { Camera, Loader2 } from "lucide-react";
import Image from "next/image";
import { CATEGORIES } from "@/lib/categories";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  category: string | null;
  location: string | null;
  hourly_rate: number | null;
  is_public: boolean;
}

export default function ProfileForm({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Ogiltig fil", description: "Välj en bildfil.", variant: "error" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "För stor fil", description: "Max 2 MB.", variant: "error" });
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Uppladdning misslyckades", description: uploadError.message, variant: "error" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const result = await updateAvatar(newUrl);
    if (result.error) {
      toast({ title: "Fel", description: result.error, variant: "error" });
    } else {
      setAvatarUrl(newUrl);
      toast({ title: "Avatar uppdaterad" });
    }
    setUploading(false);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.error) {
        toast({ title: "Fel", description: result.error, variant: "error" });
      } else {
        toast({ title: "Profil sparad" });
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {/* Avatar */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--usha-border)] bg-[var(--usha-card)] transition-colors hover:border-[var(--usha-gold)]/40"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Avatar"
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold text-[var(--usha-muted)]">
              {profile.full_name?.[0]?.toUpperCase() || "?"}
            </span>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Camera size={20} />
            )}
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />
        <div>
          <p className="text-sm font-medium">Profilbild</p>
          <p className="text-xs text-[var(--usha-muted)]">JPG, PNG eller WebP. Max 2 MB.</p>
        </div>
      </div>

      {/* Name + Category */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="full_name" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Namn
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            defaultValue={profile.full_name || ""}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
        <div>
          <label htmlFor="category" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Kategori
          </label>
          <select
            id="category"
            name="category"
            defaultValue={profile.category || ""}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          >
            <option value="">Välj kategori...</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={profile.bio || ""}
          placeholder="Berätta om dig själv och vad du erbjuder..."
          className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Location + Hourly rate */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Plats
          </label>
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={profile.location || ""}
            placeholder="t.ex. Stockholm"
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
        <div>
          <label htmlFor="hourly_rate" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Timpris (SEK)
          </label>
          <input
            id="hourly_rate"
            name="hourly_rate"
            type="number"
            min={0}
            defaultValue={profile.hourly_rate ?? ""}
            placeholder="t.ex. 500"
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
      </div>

      {/* Website */}
      <div>
        <label htmlFor="website" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Webbplats
        </label>
        <input
          id="website"
          name="website"
          type="url"
          defaultValue={profile.website || ""}
          placeholder="https://..."
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Public toggle */}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
        <input
          type="checkbox"
          name="is_public"
          defaultChecked={profile.is_public}
          className="h-4 w-4 rounded border-[var(--usha-border)] accent-[var(--usha-gold)]"
        />
        <div>
          <p className="text-sm font-medium">Publik profil</p>
          <p className="text-xs text-[var(--usha-muted)]">
            Gör din profil synlig i marketplace så att kunder kan hitta dig.
          </p>
        </div>
      </label>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Sparar..." : "Spara profil"}
        </button>
      </div>
    </form>
  );
}
