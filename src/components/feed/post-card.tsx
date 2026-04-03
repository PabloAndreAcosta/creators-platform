"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Ticket, Calendar, MapPin, MoreHorizontal, Pencil, Trash2, X, Loader2, ImagePlus, Send, Share2, Check } from "lucide-react";
import { PostLikeButton } from "./post-like-button";
import { updatePost, deletePost } from "@/app/app/feed/actions";
import { createClient } from "@/lib/supabase/client";
import type { FeedPost } from "@/types/database";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

const ROLE_LABELS: Record<string, string> = {
  creator: "Kreatör",
  kreator: "Kreatör",
  experience: "Upplevelse",
  upplevelse: "Upplevelse",
};

interface PostCardProps {
  post: FeedPost;
  isLoggedIn: boolean;
  currentUserId?: string;
}

export function PostCard({ post, isLoggedIn, currentUserId }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [editImageUrl, setEditImageUrl] = useState(post.image_url);
  const [editImagePreview, setEditImagePreview] = useState(post.image_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [shared, setShared] = useState(false);
  const isOwner = currentUserId === post.user_id;
  const isLong = post.text.length > 150;

  async function handleShare() {
    const url = `${window.location.origin}/creators/${post.author.id}`;
    const shareData = {
      title: post.author.full_name || "Inlägg på Usha",
      text: post.text.slice(0, 100) + (post.text.length > 100 ? "..." : ""),
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  async function handleDelete() {
    setDeleted(true);
    const result = await deletePost(post.id);
    if (result?.error) setDeleted(false);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || file.size > 5 * 1024 * 1024) return;
    setUploading(true);
    setEditImagePreview(URL.createObjectURL(file));

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("creator-media").upload(path, file);
    if (error) { setUploading(false); setEditImagePreview(post.image_url); return; }

    const { data: urlData } = supabase.storage.from("creator-media").getPublicUrl(path);
    setEditImageUrl(urlData.publicUrl);
    setUploading(false);
  }

  async function handleSaveEdit() {
    setSaving(true);
    const formData = new FormData();
    formData.set("text", editText);
    if (editImageUrl) formData.set("image_url", editImageUrl);
    if (post.listing_id) formData.set("listing_id", post.listing_id);

    const result = await updatePost(post.id, formData);
    if (!result?.error) {
      setEditing(false);
    }
    setSaving(false);
  }

  if (deleted) return null;

  return (
    <div className="border-b border-[var(--usha-border)] pb-4 md:pb-5">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 md:gap-3">
        <Link href={`/creators/${post.author.id}`}>
          {post.author.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
              <span className="text-sm font-bold text-[var(--usha-gold)]">
                {(post.author.full_name || "?")[0]}
              </span>
            </div>
          )}
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/creators/${post.author.id}`} className="text-sm font-semibold hover:underline">
              {post.author.full_name || "Kreatör"}
            </Link>
            <span className="rounded-full bg-[var(--usha-gold)]/10 px-1.5 py-0.5 text-[9px] font-medium text-[var(--usha-gold)]">
              {ROLE_LABELS[post.author.role] || "Kreatör"}
            </span>
          </div>
          <p className="text-[10px] text-[var(--usha-muted)]">
            {post.author.category ? `${post.author.category} · ` : ""}{timeAgo(post.created_at)}
          </p>
        </div>
        {isOwner && (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-1.5 text-[var(--usha-muted)] transition hover:bg-[var(--usha-card)] hover:text-white">
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-1 shadow-lg">
                <button
                  onClick={() => { setEditing(true); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--usha-muted)] transition hover:bg-[var(--usha-gold)]/10 hover:text-white"
                >
                  <Pencil size={14} /> Redigera
                </button>
                <button
                  onClick={() => { handleDelete(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10"
                >
                  <Trash2 size={14} /> Radera
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit mode */}
      {editing && (
        <div className="px-4 pb-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-sm outline-none focus:border-[var(--usha-gold)]/40"
            autoFocus
          />
          {editImagePreview && (
            <div className="relative mt-2 overflow-hidden rounded-xl">
              <img src={editImagePreview} alt="" className="w-full max-h-[200px] object-cover" />
              <button onClick={() => { setEditImageUrl(null); setEditImagePreview(null); }} className="absolute right-2 top-2 rounded-full bg-black/60 p-1">
                <X size={12} className="text-white" />
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--usha-muted)] hover:text-[var(--usha-gold)]">
                <ImagePlus size={14} /> {uploading ? "Laddar..." : "Bild"}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setEditText(post.text); setEditImageUrl(post.image_url); setEditImagePreview(post.image_url); }} className="rounded-lg px-3 py-1 text-xs text-[var(--usha-muted)]">
                Avbryt
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editText.trim() || saving || uploading}
                className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-1 text-xs font-bold text-black disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Spara
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image — links to listing detail if available */}
      {post.image_url && (
        <Link
          href={post.listing ? `/listing/${post.listing.id}` : `/creators/${post.author.id}`}
          className="relative mx-4 block overflow-hidden rounded-xl"
        >
          <img
            src={post.image_url}
            alt=""
            className="w-full max-h-[280px] object-cover transition hover:opacity-90 md:max-h-[400px]"
            loading="lazy"
          />
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 pt-3">
        <PostLikeButton
          postId={post.id}
          initialLiked={post.is_liked}
          initialCount={post.like_count}
          isLoggedIn={isLoggedIn}
        />
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition hover:text-white"
        >
          {shared ? <Check size={18} className="text-green-400" /> : <Share2 size={18} />}
          <span className="text-xs">{shared ? "Kopierad!" : "Dela"}</span>
        </button>
      </div>

      {/* Text */}
      <div className="px-4 pt-2">
        <p className="text-sm leading-relaxed">
          <Link href={`/creators/${post.author.id}`} className="font-semibold hover:underline">
            {(post.author.full_name || "Kreatör").split(" ")[0]}
          </Link>{" "}
          {isLong && !expanded ? (
            <>
              {post.text.slice(0, 150)}...{" "}
              <button
                onClick={() => setExpanded(true)}
                className="text-[var(--usha-muted)] hover:text-white"
              >
                visa mer
              </button>
            </>
          ) : (
            post.text
          )}
        </p>
      </div>

      {/* CTA — linked listing */}
      {post.listing && (
        <div className="mx-4 mt-3">
          <Link
            href={`/listing/${post.listing.id}`}
            className="flex items-center gap-2.5 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-2.5 transition hover:border-[var(--usha-gold)]/30 md:gap-3 md:p-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10 md:h-10 md:w-10">
              <Ticket size={15} className="text-[var(--usha-gold)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold md:text-sm">{post.listing.title}</p>
              <div className="flex items-center gap-2 text-[10px] text-[var(--usha-muted)]">
                {post.listing.event_date && (
                  <span className="flex items-center gap-0.5">
                    <Calendar size={9} />
                    {new Date(post.listing.event_date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                  </span>
                )}
                {post.listing.event_location && (
                  <span className="flex items-center gap-0.5">
                    <MapPin size={9} />
                    {post.listing.event_location}
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-2.5 py-1 text-[11px] font-bold text-black md:px-3 md:py-1.5 md:text-xs">
              {post.listing.price ? `${post.listing.price} kr` : "Gratis"}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
