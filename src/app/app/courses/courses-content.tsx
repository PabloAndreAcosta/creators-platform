"use client";

import { useState } from "react";
import {
  Users,
  Clock,
  Edit2,
  Trash2,
  Plus,
  MoreVertical,
  DollarSign,
} from "lucide-react";

interface Course {
  id: string;
  title: string;
  schedule: string;
  students: number;
  maxStudents: number;
  price: string;
  active: boolean;
  image: string;
  level: string;
}

const MOCK_COURSES: Course[] = [
  {
    id: "1",
    title: "Salsa Nybörjare",
    schedule: "Mån & Ons, 18:00 - 19:30",
    students: 12,
    maxStudents: 20,
    price: "1,200 kr/mån",
    active: true,
    image:
      "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=200&fit=crop",
    level: "Nybörjare",
  },
  {
    id: "2",
    title: "Bachata Medel",
    schedule: "Tis & Tor, 19:00 - 20:30",
    students: 8,
    maxStudents: 15,
    price: "1,400 kr/mån",
    active: true,
    image:
      "https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=200&fit=crop",
    level: "Medel",
  },
  {
    id: "3",
    title: "Street Dance Avancerad",
    schedule: "Fre, 17:00 - 18:30",
    students: 15,
    maxStudents: 15,
    price: "1,600 kr/mån",
    active: true,
    image:
      "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400&h=200&fit=crop",
    level: "Avancerad",
  },
  {
    id: "4",
    title: "Kizomba Workshop",
    schedule: "Lör, 14:00 - 17:00",
    students: 0,
    maxStudents: 25,
    price: "499 kr",
    active: false,
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=200&fit=crop",
    level: "Alla nivåer",
  },
];

export function CoursesContent() {
  const [courses] = useState(MOCK_COURSES);

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mina Kurser</h1>
        <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
          {courses.filter((c) => c.active).length} aktiva
        </span>
      </div>

      {/* Course list */}
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>

      {/* Add new course button */}
      <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]">
        <Plus size={18} />
        Lägg till ny kurs
      </button>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  const [showMenu, setShowMenu] = useState(false);

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

        {/* Status badge */}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            course.active
              ? "bg-green-500/90 text-white"
              : "bg-[var(--usha-muted)]/80 text-white"
          }`}
        >
          {course.active ? "Aktiv" : "Inaktiv"}
        </span>

        {/* Level badge */}
        <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          {course.level}
        </span>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-base font-bold text-white">{course.title}</h3>
        </div>
      </div>

      {/* Course info */}
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-[var(--usha-muted)]">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {course.schedule}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-[var(--usha-gold)]" />
              <span className="text-sm font-medium">
                {course.students}
                <span className="text-[var(--usha-muted)]">
                  /{course.maxStudents}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-[var(--usha-gold)]" />
              <span className="text-sm font-medium">{course.price}</span>
            </div>
          </div>

          {/* Actions */}
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
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]">
                    <Edit2 size={12} />
                    Redigera
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-[var(--usha-card-hover)]">
                    <Trash2 size={12} />
                    Ta bort
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--usha-border)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)]"
              style={{
                width: `${(course.students / course.maxStudents) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
