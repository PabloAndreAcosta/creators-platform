"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, Calendar, Star } from "lucide-react";

interface CarouselEvent {
  id: string;
  slug?: string | null;
  title: string;
  price: number | null;
  event_date: string | null;
  event_location: string | null;
  image_url: string | null;
  category: string | null;
}

export function EventCarousel({ events }: { events: CarouselEvent[] }) {
  const [current, setCurrent] = useState(0);

  if (events.length === 0) return null;

  function next() {
    setCurrent((c) => (c + 1) % events.length);
  }

  function prev() {
    setCurrent((c) => (c - 1 + events.length) % events.length);
  }

  const event = events[current];

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl">
      {/* Image with gradient overlay */}
      <Link href={`/listing/${event.slug || event.id}`} className="block">
        <div className="relative aspect-[21/9] sm:aspect-[3/1]">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="h-full w-full object-cover transition-transform duration-[5000ms] hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
              <Star size={48} className="text-[var(--usha-gold)]/30" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <span className="mb-2 inline-block rounded-full bg-[var(--usha-gold)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-black">
              Framhävd
            </span>
            <h2 className="text-xl font-bold text-white sm:text-2xl md:text-3xl">
              {event.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/80">
              {event.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(event.event_date).toLocaleDateString("sv-SE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              )}
              {event.event_location && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {event.event_location.split(",")[0]}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-bold text-black">
                {event.price ? `${event.price} kr` : "Gratis"}
              </span>
              <span className="text-sm text-white/60">Mer info →</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Navigation arrows */}
      {events.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); prev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {events.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); setCurrent(i); }}
                className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-[var(--usha-gold)]" : "w-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
