"use client";

import { useState } from "react";
import {
  Clock,
  Edit2,
  Trash2,
  Plus,
  MoreVertical,
  DollarSign,
  BookOpen,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CourseData {
  id: string;
  title: string;
  schedule: string;
  price: string;
  active: boolean;
  image: string;
  level: string;
}

const COURSE_IMAGES = [
  "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=200&fit=crop",
];

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

interface CoursesContentProps {
  listings: ListingData[];
}

function listingToCourse(listing: ListingData, index: number): CourseData {
  return {
    id: listing.id,
    title: listing.title,
    schedule: listing.duration_minutes ? `${listing.duration_minutes} min` : "-",
    price: listing.price ? `${listing.price} kr` : "Gratis",
    active: listing.is_active,
    image: listing.image_url || COURSE_IMAGES[index % COURSE_IMAGES.length],
    level: listing.category || "Övrigt",
  };
}

export function CoursesContent({ listings }: CoursesContentProps) {
  const courses = listings.map(listingToCourse);
  const activeCount = courses.filter((c) => c.active).length;

  if (courses.length === 0) {
    return (
      <div className="px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mina Kurser</h1>
          <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
            0 aktiva
          </span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16">
          <BookOpen size={40} className="mb-4 text-[var(--usha-muted)]" />
          <p className="text-base font-medium text-[var(--usha-muted)]">
            Inga kurser ännu
          </p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            Skapa din första kurs för att komma igång
          </p>
        </div>

        <Link
          href="/dashboard/listings/new"
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
        >
          <Plus size={18} />
          Lägg till ny kurs
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mina Kurser</h1>
        <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
          {activeCount} aktiva
        </span>
      </div>

      {/* Course list */}
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>

      {/* Add new course button */}
      <Link
        href="/dashboard/listings/new"
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
      >
        <Plus size={18} />
        Lägg till ny kurs
      </Link>
    </div>
  );
}

function CourseCard({ course }: { course: CourseData }) {
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/listings/${course.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setShowConfirm(false);
      setShowMenu(false);
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-[var(--usha-card)] ${
        course.active
          ? "border-[var(--usha-border)]"
          : "border-[var(--usha-border)] opacity-70"
      }`}
    >
      {/* Course image */}
      <div className="relative h-36">
        <img
          src={course.image}
          alt={course.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            course.active
              ? "bg-green-500/90 text-white"
              : "bg-[var(--usha-muted)]/80 text-white"
          }`}
        >
          {course.active ? "Aktiv" : "Inaktiv"}
        </span>

        <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          {course.level}
        </span>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-base font-bold text-white">{course.title}</h3>
        </div>
      </div>

      {/* Course info */}
      <div className="p-4">
        <div className="mb-3 flex items-center gap-3 text-xs text-[var(--usha-muted)]">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {course.schedule}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <DollarSign size={14} className="text-[var(--usha-gold)]" />
            <span className="text-sm font-medium">{course.price}</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-2 text-[var(--usha-muted)] hover:bg-[var(--usha-card-hover)] hover:text-white"
            >
              <MoreVertical size={16} />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute bottom-full right-0 z-20 mb-1 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] py-1 shadow-xl">
                  <Link
                    href={`/dashboard/listings/${course.id}/edit`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]"
                    onClick={() => setShowMenu(false)}
                  >
                    <Edit2 size={12} />
                    Redigera
                  </Link>
                  <button
                    onClick={() => { setShowMenu(false); setShowConfirm(true); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-[var(--usha-card-hover)]"
                  >
                    <Trash2 size={12} />
                    Ta bort
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold">Ta bort kurs?</h3>
            <p className="mb-5 text-sm text-[var(--usha-muted)]">
              Är du säker på att du vill ta bort &ldquo;{course.title}&rdquo;? Detta kan inte ångras.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-[var(--usha-border)] py-2.5 text-sm font-medium transition hover:bg-[var(--usha-card-hover)]"
              >
                Avbryt
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
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
