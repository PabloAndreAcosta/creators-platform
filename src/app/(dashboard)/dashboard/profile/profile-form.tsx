"use client";

import { useRef, useState, useTransition } from "react";
import { updateProfile, updateAvatar } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toaster";
import { Camera, Loader2, X, Plus, Instagram } from "lucide-react";
import Image from "next/image";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";

interface Profile {
  id: string;
  full_name: string | null;
  slug: string | null;
  avatar_url: string | null;
  bio: string | null;
  categories: string[];
  locations: string[];
  rates: Record<string, number>;
  websites: string[];
  social_instagram: string | null;
  social_x: string | null;
  social_facebook: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_public: boolean;
  // Legacy fields (backward compat during migration)
  category?: string | null;
  location?: string | null;
  hourly_rate?: number | null;
  website?: string | null;
}

const inputClass = "w-full min-h-[44px] rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-base sm:text-sm outline-none transition focus:border-[var(--usha-gold)]/40";

export default function ProfileForm({ profile, isPremium }: { profile: Profile; isPremium: boolean }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-value state
  const initCategories = profile.categories?.length ? profile.categories : (profile.category ? [profile.category] : []);
  const initLocations = profile.locations?.length ? profile.locations : (profile.location ? [profile.location] : []);
  const initRates = profile.rates && Object.keys(profile.rates).length ? profile.rates : (profile.category && profile.hourly_rate ? { [profile.category]: profile.hourly_rate } : {});
  const initWebsites = profile.websites?.length ? profile.websites : (profile.website ? [profile.website] : []);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(initCategories);
  const [locations, setLocations] = useState<string[]>(initLocations);
  const [rates, setRates] = useState<Record<string, number>>(initRates);
  const [websites, setWebsites] = useState<string[]>(initWebsites);
  const [newLocation, setNewLocation] = useState("");
  const [newWebsite, setNewWebsite] = useState("");

  function toggleCategory(value: string) {
    setSelectedCategories((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((c) => c !== value);
        // Remove rate for deselected category
        setRates((r) => {
          const { [value]: _, ...rest } = r;
          return rest;
        });
        return next;
      }
      return [...prev, value];
    });
  }

  function addLocation() {
    const trimmed = newLocation.trim();
    if (trimmed && !locations.includes(trimmed)) {
      setLocations((prev) => [...prev, trimmed]);
    }
    setNewLocation("");
  }

  function addWebsite() {
    const trimmed = newWebsite.trim();
    if (trimmed && !websites.includes(trimmed)) {
      setWebsites((prev) => [...prev, trimmed]);
    }
    setNewWebsite("");
  }

  async function resizeImage(file: File, maxSize: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Komprimering misslyckades"))),
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Kunde inte läsa bilden"));
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Ogiltig fil", "Välj en bildfil (JPG, PNG eller WebP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("För stor fil", "Max 10 MB.");
      return;
    }

    setUploading(true);

    try {
      const compressed = await resizeImage(file, 800);
      const supabase = createClient();
      const path = `${profile.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) {
        toast.error("Uppladdning misslyckades", uploadError.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const result = await updateAvatar(newUrl);
      if (result.error) {
        toast.error("Kunde inte spara avatar", result.error);
      } else {
        setAvatarUrl(newUrl);
        toast.success("Avatar uppdaterad");
      }
    } catch (err) {
      toast.error("Något gick fel", (err as Error).message);
    }
    setUploading(false);
  }

  function handleSubmit(formData: FormData) {
    // Inject multi-value fields as JSON
    formData.set("categories", JSON.stringify(selectedCategories));
    formData.set("locations", JSON.stringify(locations));
    formData.set("rates", JSON.stringify(rates));
    formData.set("websites", JSON.stringify(websites));

    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.error) {
        toast.error("Kunde inte spara profil", result.error);
      } else {
        toast.success("Profil sparad");
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
          <p className="text-xs text-[var(--usha-muted)]">JPG, PNG eller WebP. Max 10 MB.</p>
        </div>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="full_name" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Namn
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          defaultValue={profile.full_name || ""}
          className={inputClass}
        />
      </div>

      {/* Slug (vanity URL) - Premium only */}
      <div>
        <label htmlFor="slug" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Profiladress
          {!isPremium && (
            <span className="ml-2 rounded-full bg-[var(--usha-premium)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--usha-premium)]">
              Premium
            </span>
          )}
        </label>
        <div className="flex items-center gap-0">
          <span className="flex h-[44px] items-center rounded-l-xl border border-r-0 border-[var(--usha-border)] bg-[var(--usha-black)]/50 px-3 text-sm text-[var(--usha-muted)]">
            usha.se/
          </span>
          <input
            id="slug"
            name="slug"
            type="text"
            defaultValue={profile.slug || ""}
            placeholder={isPremium ? "dittnamn" : "Uppgradera till Premium"}
            pattern="[a-z0-9_-]+"
            disabled={!isPremium}
            className={`w-full min-h-[44px] rounded-r-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-base sm:text-sm outline-none transition focus:border-[var(--usha-gold)]/40 ${!isPremium ? "opacity-50 cursor-not-allowed" : ""}`}
          />
        </div>
        {isPremium ? (
          <p className="mt-1 text-[10px] text-[var(--usha-muted)]">
            Bara små bokstäver, siffror, bindestreck och understreck. Detta blir din publika länk.
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-[var(--usha-muted)]">
            Egen profiladress är en Premium-funktion.{" "}
            <a href="/dashboard/billing" className="text-[var(--usha-premium)] hover:underline">Uppgradera</a>
          </p>
        )}
      </div>

      {/* Categories (multi-select pills) */}
      <div>
        <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Kategorier
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const selected = selectedCategories.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleCategory(c.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? "bg-[var(--usha-gold)] text-black"
                    : "bg-[var(--usha-card)] text-[var(--usha-muted)] ring-1 ring-[var(--usha-border)] hover:ring-[var(--usha-gold)]/40 hover:text-white"
                }`}
              >
                {c.label}
              </button>
            );
          })}
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

      {/* Locations (tag input) */}
      <div>
        <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Platser
        </label>
        {locations.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {locations.map((loc) => (
              <span
                key={loc}
                className="flex items-center gap-1 rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]"
              >
                {loc}
                <button
                  type="button"
                  onClick={() => setLocations((prev) => prev.filter((l) => l !== loc))}
                  className="ml-0.5 rounded-full p-0.5 transition hover:bg-[var(--usha-gold)]/20"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLocation();
              }
            }}
            placeholder="t.ex. Stockholm"
            className={inputClass}
          />
          <button
            type="button"
            onClick={addLocation}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--usha-border)] px-3 py-2 text-xs text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/40 hover:text-white"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Rates per category */}
      {selectedCategories.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Timpris per kategori (SEK)
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedCategories.map((cat) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-medium text-[var(--usha-muted)]">
                  {CATEGORY_LABELS[cat] || cat}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={rates[cat] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRates((prev) => ({
                      ...prev,
                      [cat]: val ? parseInt(val, 10) : 0,
                    }));
                  }}
                  placeholder="t.ex. 500"
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Websites (tag input) */}
      <div>
        <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Webbplatser
        </label>
        {websites.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {websites.map((url) => (
              <span
                key={url}
                className="flex items-center gap-1 rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]"
              >
                {url}
                <button
                  type="button"
                  onClick={() => setWebsites((prev) => prev.filter((w) => w !== url))}
                  className="ml-0.5 rounded-full p-0.5 transition hover:bg-[var(--usha-gold)]/20"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newWebsite}
            onChange={(e) => setNewWebsite(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addWebsite();
              }
            }}
            placeholder="https://..."
            className={inputClass}
          />
          <button
            type="button"
            onClick={addWebsite}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--usha-border)] px-3 py-2 text-xs text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/40 hover:text-white"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Social media */}
      <div>
        <label className="mb-3 block text-sm text-[var(--usha-muted)]">
          Sociala medier
        </label>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Instagram size={18} className="shrink-0 text-[var(--usha-muted)]" />
            <input
              name="social_instagram"
              type="text"
              defaultValue={profile.social_instagram || ""}
              placeholder="Instagram-användarnamn"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-sm font-bold text-[var(--usha-muted)]">𝕏</span>
            <input
              name="social_x"
              type="text"
              defaultValue={profile.social_x || ""}
              placeholder="X-användarnamn"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-sm font-bold text-[var(--usha-muted)]">f</span>
            <input
              name="social_facebook"
              type="text"
              defaultValue={profile.social_facebook || ""}
              placeholder="Facebook-sida eller användarnamn"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div>
        <label className="mb-3 block text-sm text-[var(--usha-muted)]">
          Kontaktuppgifter
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="contact_email" className="mb-1 block text-xs text-[var(--usha-muted)]">
              E-post (publik)
            </label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={profile.contact_email || ""}
              placeholder="kontakt@exempel.se"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="contact_phone" className="mb-1 block text-xs text-[var(--usha-muted)]">
              Telefon (publik)
            </label>
            <input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              defaultValue={profile.contact_phone || ""}
              placeholder="+46 70 123 45 67"
              className={inputClass}
            />
          </div>
        </div>
        <p className="mt-1 text-[10px] text-[var(--usha-muted)]">
          Visas på din publika profil om du vill bli kontaktad direkt.
        </p>
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
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Sparar..." : "Spara profil"}
        </button>
      </div>
    </form>
  );
}
