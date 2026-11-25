import type { Locale } from "@/i18n/config";
import type { Translate } from "@/lib/i18n/server";
import { formatEmailDate } from "@/lib/email/i18n";

interface Props {
  organiserName: string | null;
  venueName: string;
  eventTitle: string;
  eventDate?: Date;
  /** true = the venue said yes, false = it declined (or withdrew its yes). */
  confirmed: boolean;
  eventUrl: string;
  /** Translator for the `emails` namespace, in the recipient's language. */
  t: Translate;
  locale: Locale;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };

export function getVenueResponseSubject(t: Translate, venueName: string, eventTitle: string, confirmed: boolean): string {
  return t(confirmed ? "venueResponse.confirmedSubject" : "venueResponse.declinedSubject", {
    venue: venueName,
    event: eventTitle,
  });
}

/**
 * The venue answered the organiser's request to hold an event there. Before
 * this mail existed a "no" was invisible: the organiser kept seeing "waiting
 * for the venue" forever.
 */
export default function VenueResponse({ organiserName, venueName, eventTitle, eventDate, confirmed, eventUrl, t, locale }: Props) {
  const date = eventDate ? formatEmailDate(eventDate, locale, DATE_FORMAT) : t("venueResponse.noDate");
  return (
    <html>
      {/* eslint-disable-next-line @next/next/no-head-element -- email, not a page */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#0a0a0b", fontFamily: "'Outfit', Arial, sans-serif" }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#0a0a0b", padding: "40px 16px" }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 560 }}>
                  <tbody>
                    <tr>
                      <td style={{ paddingBottom: 32, textAlign: "center" }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: "#c8a445", letterSpacing: "-0.02em" }}>Usha Platform</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: "#111113", borderRadius: 16, border: "1px solid rgba(200,164,69,0.15)", padding: "32px 28px" }}>
                        <p style={{ fontSize: 18, fontWeight: 600, color: "#fafaf9", margin: "0 0 8px" }}>
                          {organiserName ? t("greeting", { name: organiserName }) : t("greetingNoName")}
                        </p>
                        <p style={{ fontSize: 14, color: "#a3a3a3", margin: "0 0 24px", lineHeight: 1.6 }}>
                          {t(confirmed ? "venueResponse.confirmedBody" : "venueResponse.declinedBody", {
                            venue: venueName,
                            event: eventTitle,
                            date,
                          })}
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: "center" }}>
                                <a
                                  href={eventUrl}
                                  style={{ display: "inline-block", padding: "12px 28px", borderRadius: 999, backgroundColor: "#c8a445", color: "#0a0a0b", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
                                >
                                  {t("venueResponse.cta")}
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ fontSize: 12, color: "#6b6b6b", margin: "24px 0 0", lineHeight: 1.6 }}>{t("venueResponse.footer")}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
