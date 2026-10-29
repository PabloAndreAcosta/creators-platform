"use client";

import TimeSelect from "@/components/time-select";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toaster";
import { PASS_TYPES, type PassType } from "@/lib/gigs/pass-types";

const inputClass =
  "w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40";

/** En av arrangörens egna kommande kvällar. */
export type OwnEvent = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  venue: string | null;
  address: string | null;
  seriesId: string | null;
};

type EventGroup = { key: string; name: string; events: OwnEvent[] };

/** "The Lab Torsdag – Practica (…)" → "The Lab Torsdag". Kvällarnas undertitlar skiftar, serienamnet gör det inte. */
function seriesName(title: string): string {
  return title.split(" – ")[0].trim();
}

/** En serie blir en grupp med alla sina kvällar; en fristående kväll blir en egen grupp. */
function groupEvents(events: OwnEvent[]): EventGroup[] {
  const groups = new Map<string, EventGroup>();
  for (const e of events) {
    const key = e.seriesId ?? e.id;
    const g = groups.get(key) ?? { key, name: e.seriesId ? seriesName(e.title) : e.title, events: [] };
    g.events.push(e);
    groups.set(key, g);
  }
  return Array.from(groups.values());
}

export function GigForm({
  action,
  events,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  events: OwnEvent[];
}) {
  const t = useTranslations("gigForm");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const groups = useMemo(() => groupEvents(events), [events]);
  const [passType, setPassType] = useState<PassType | null>(null);
  const [groupKey, setGroupKey] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  const group = groups.find((g) => g.key === groupKey) ?? null;

  // Titeln skrivs åt arrangören tills hen själv ändrar den: "Taxidansare – The Lab Torsdag".
  function suggestTitle(type: PassType | null, g: EventGroup | null) {
    if (titleTouched) return;
    const parts = [type && type !== "other" ? t(`passType.${type}`) : null, g?.name ?? null].filter(Boolean);
    setTitle(parts.join(" – "));
  }

  function choosePassType(type: PassType) {
    setPassType(type);
    suggestTitle(type, group);
  }

  function chooseGroup(key: string) {
    setGroupKey(key);
    const g = groups.find((x) => x.key === key) ?? null;
    // Alla kvällar förvalda: vanligast är att samma pass behövs varje gång.
    setPicked(new Set(g?.events.map((e) => e.id) ?? []));
    suggestTitle(passType, g);
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(formData: FormData) {
    if (group && picked.size === 0) {
      toast.error(t("errorPublishTitle"), t("pickAtLeastOne"));
      return;
    }
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result && result.error) {
        toast.error(t("errorPublishTitle"), result.error);
      }
    });
  }

  const dateLabel = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  return (
    <form action={handleSubmit} className="space-y-6 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
      <fieldset>
        <legend className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("passTypeLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {PASS_TYPES.map((type) => (
            <label
              key={type}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                passType === type
                  ? "border-[var(--usha-gold)] bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]"
                  : "border-[var(--usha-border)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
              }`}
            >
              <input
                type="radio"
                name="pass_type"
                value={type}
                checked={passType === type}
                onChange={() => choosePassType(type)}
                className="sr-only"
              />
              {t(`passType.${type}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {groups.length > 0 && (
        <div>
          <label htmlFor="event_group" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            {t("linkEventLabel")} <span className="text-xs">{t("perksOptional")}</span>
          </label>
          <select id="event_group" value={groupKey} onChange={(e) => chooseGroup(e.target.value)} className={inputClass}>
            <option value="">{t("linkEventNone")}</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.events.length > 1 ? t("linkEventSeries", { name: g.name, count: g.events.length }) : `${g.name} · ${g.events[0].date}`}
              </option>
            ))}
          </select>

          {group && (
            <div className="mt-3 space-y-2">
              {group.events.length > 1 && <p className="text-xs text-[var(--usha-muted)]">{t("linkEventPickDates")}</p>}
              <div className="flex flex-wrap gap-2">
                {group.events.map((e) => (
                  <label
                    key={e.id}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
                      picked.has(e.id)
                        ? "border-[var(--usha-gold)] bg-[var(--usha-gold)]/10 text-[var(--usha-white)]"
                        : "border-[var(--usha-border)] text-[var(--usha-muted)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="listing_ids"
                      value={e.id}
                      checked={picked.has(e.id)}
                      onChange={() => toggle(e.id)}
                      className="sr-only"
                    />
                    {dateLabel(e.date)}
                    {e.time ? ` ${e.time}` : ""}
                  </label>
                ))}
              </div>
              <p className="text-xs text-[var(--usha-muted)]">
                {t("linkEventFilled", { venue: group.events[0].venue ?? group.events[0].address ?? "–" })}
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("titleLabel")}</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleTouched(true);
          }}
          placeholder={t("titlePlaceholder")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("descriptionLabel")}</label>
        <textarea id="description" name="description" rows={4} placeholder={t("descriptionPlaceholder")} className={`${inputClass} resize-none`} />
      </div>

      {/* Med en kopplad kväll kommer datum, tid och lokal från kvällen själv. */}
      {!group && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="event_date" className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("dateLabel")}</label>
              <input id="event_date" name="event_date" type="date" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="event_time" className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("timeLabel")}</label>
              <TimeSelect id="event_time" name="event_time" />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="venue" className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("venueLabel")}</label>
              <input id="venue" name="venue" type="text" placeholder={t("venuePlaceholder")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="venue_address" className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("venueAddressLabel")}</label>
              <input id="venue_address" name="venue_address" type="text" placeholder={t("venueAddressPlaceholder")} className={inputClass} />
            </div>
          </div>
        </>
      )}

      <div>
        <label htmlFor="proposed_price" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          {group && picked.size > 1 ? t("proposedPricePerEvening") : t("proposedPriceLabel")}
        </label>
        <input id="proposed_price" name="proposed_price" type="number" min={0} required placeholder={t("proposedPricePlaceholder")} className={inputClass} />
        <p className="mt-1 text-xs text-[var(--usha-muted)]">{t("proposedPriceVolunteerHint")}</p>
      </div>

      <div>
        <label htmlFor="perks" className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("perksLabel")} <span className="text-xs">{t("perksOptional")}</span></label>
        <textarea id="perks" name="perks" rows={2} placeholder={t("perksPlaceholder")} className={`${inputClass} resize-none`} />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending
            ? t("submitPending")
            : group && picked.size > 1
              ? t("submitMany", { count: picked.size })
              : t("submit")}
        </button>
      </div>
    </form>
  );
}
