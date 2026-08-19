import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { createTranslator } from "next-intl";
import { NOTIFICATION_NS, renderNotification, resolveParams } from "../text";
import type { Translate } from "@/lib/i18n/server";

const LOCALES = ["sv", "en", "es"] as const;
const MESSAGES_DIR = join(process.cwd(), "src/i18n/messages");

function messagesFor(locale: (typeof LOCALES)[number]) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8"));
}

/** The same translator shape the browser hands `renderNotification`. */
function translatorFor(locale: (typeof LOCALES)[number]): Translate {
  const messages = messagesFor(locale);
  const t = createTranslator({ locale, messages, namespace: NOTIFICATION_NS, onError: () => {} });
  const fn = ((key: string, params?: Record<string, string | number>) =>
    t(key as never, params as never) as unknown as string) as Translate;
  fn.has = (key: string) => messages[NOTIFICATION_NS]?.[key] != null;
  return fn;
}

describe("notification text renders in the reader's language", () => {
  it("translates a keyed row per locale instead of freezing one language", () => {
    const row = {
      title: "",
      message: "",
      title_key: "bookingCanceledTitle",
      body_key: "bookingCanceledMsg",
      params: { service: "Salsa 101" },
    };
    const sv = renderNotification(row, translatorFor("sv"));
    const en = renderNotification(row, translatorFor("en"));
    const es = renderNotification(row, translatorFor("es"));

    expect(sv.title).toBe("Bokning avbokad");
    expect(en.title).toBe("Booking cancelled");
    expect(es.title).toBe("Reserva cancelada");
    // The event's own name is data, so it survives untranslated in all three.
    for (const r of [sv, en, es]) expect(r.message).toContain("Salsa 101");
  });

  it("translates a param that is itself a phrase", () => {
    const row = {
      title: "",
      message: "",
      title_key: "paidBookingTitle",
      body_key: "paidBookingMsg",
      params: { service: { key: "fallbackService" } },
    };
    expect(renderNotification(row, translatorFor("sv")).message).toContain("din tjänst");
    expect(renderNotification(row, translatorFor("en")).message).toContain("your service");
    expect(renderNotification(row, translatorFor("es")).message).toContain("tu servicio");
  });

  it("pluralises the ticket count the way each language does", () => {
    const params = { count: 1, title: "Bugg Night", amount: "250" };
    const one = renderNotification(
      { title: "", message: "", title_key: "ticketSoldTitle", body_key: "ticketSoldMsg", params },
      translatorFor("sv")
    );
    const many = renderNotification(
      {
        title: "",
        message: "",
        title_key: "ticketSoldTitle",
        body_key: "ticketSoldMsg",
        params: { ...params, count: 3 },
      },
      translatorFor("sv")
    );
    expect(one.message).toContain("1 biljett");
    expect(one.message).not.toContain("biljetter");
    expect(many.message).toContain("3 biljetter");
  });

  it("keeps the stored text when there is nothing to translate", () => {
    // A chat preview is the sender's own words — no key, so it stays verbatim.
    const row = {
      title: "Paulina",
      message: "hej, kommer du på torsdag?",
      title_key: null,
      body_key: null,
      params: null,
    };
    const r = renderNotification(row, translatorFor("es"));
    expect(r).toEqual({ title: "Paulina", message: "hej, kommer du på torsdag?" });
  });

  it("falls back to the stored text for a key this client doesn't know", () => {
    // A row written by a newer deploy must never render a raw key to a user.
    const row = {
      title: "Something happened",
      message: "Details here",
      title_key: "keyFromTheFuture",
      body_key: "alsoFromTheFuture",
      params: null,
    };
    expect(renderNotification(row, translatorFor("en"))).toEqual({
      title: "Something happened",
      message: "Details here",
    });
  });

  it("passes plain values through untouched", () => {
    const t = translatorFor("en");
    expect(resolveParams({ a: "raw", b: 7 }, t)).toEqual({ a: "raw", b: 7 });
  });
});

describe("every notification key used in code exists in every locale", () => {
  // Catches the failure this whole mechanism exists to prevent: a notification
  // written with a key that one language is missing, which would show the
  // reader a bare key.
  const SRC = join(process.cwd(), "src");

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        if (entry !== "node_modules" && entry !== "__tests__") sourceFiles(p, out);
      } else if (/\.tsx?$/.test(entry)) {
        out.push(p);
      }
    }
    return out;
  }

  // Scanned only in the files that actually write notifications, so the
  // name-shaped match below can't be fooled by an unrelated string elsewhere.
  // Matching by name rather than by `titleKey:` position is what catches the
  // keys chosen in a ternary or handed over in a variable.
  const KEY_SHAPE = /"([a-z][A-Za-z0-9]*(?:Title|Msg[A-Za-z]*)|fallback[A-Za-z]+|collabRole[A-Za-z]+|levelName[A-Za-z0-9]+)"/g;

  const used = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("@/lib/notifications/create") && !file.includes("lib/notifications/")) continue;
    for (const m of src.matchAll(KEY_SHAPE)) used.add(m[1]);
  }

  it("finds the keys the code actually writes", () => {
    expect(used.size).toBeGreaterThan(20);
  });

  for (const locale of LOCALES) {
    it(`${locale}.json defines all of them`, () => {
      const ns = messagesFor(locale)[NOTIFICATION_NS] ?? {};
      expect([...used].filter((k) => ns[k] == null).sort()).toEqual([]);
    });
  }
});
