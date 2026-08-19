import type { Locale } from "@/i18n/config";
import type { Translate } from "@/lib/i18n/server";
import { formatEmailDate } from "@/lib/email/i18n";

type ReminderVariant = "day" | "soon";

interface BookingReminderProps {
  customerName: string;
  serviceName: string;
  scheduledAt: Date;
  creatorName: string;
  location?: string;
  variant?: ReminderVariant;
  /** Translator for the `emails` namespace, in the recipient's language. */
  t: Translate;
  locale: Locale;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

export function getBookingReminderSubject(
  t: Translate,
  serviceName: string,
  variant: ReminderVariant = "day"
): string {
  return t(variant === "soon" ? "reminderSubjectSoon" : "reminderSubjectDay", {
    service: serviceName,
  });
}

export default function BookingReminder({
  customerName,
  serviceName,
  scheduledAt,
  creatorName,
  location,
  variant = "day",
  t,
  locale,
}: BookingReminderProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
  const intro = t(variant === "soon" ? "reminderIntroSoon" : "reminderIntroDay");

  return (
    <html>
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
                        <span style={{ fontSize: 28, fontWeight: 700, color: "#c8a445", letterSpacing: "-0.02em" }}>
                          Usha Platform
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{
                        backgroundColor: "#111113",
                        borderRadius: 16,
                        border: "1px solid rgba(200,164,69,0.15)",
                        padding: "32px 28px",
                      }}>
                        <p style={{ fontSize: 18, fontWeight: 600, color: "#fafaf9", margin: "0 0 8px" }}>
                          {t("greetingExcited", { name: customerName })}
                        </p>
                        <p style={{ fontSize: 14, color: "#6b6b6b", margin: "0 0 24px", lineHeight: 1.6 }}>
                          {intro}
                        </p>

                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: "12px 16px", borderRadius: 12, backgroundColor: "#0a0a0b" }}>
                                <p style={{ fontSize: 15, fontWeight: 600, color: "#c8a445", margin: "0 0 8px" }}>
                                  {serviceName}
                                </p>
                                <p style={{ fontSize: 13, color: "#fafaf9", margin: "0 0 4px" }}>
                                  {t("labelDate", { value: formatEmailDate(scheduledAt, locale, DATE_FORMAT) })}
                                </p>
                                <p style={{ fontSize: 13, color: "#fafaf9", margin: "0 0 4px" }}>
                                  {t("labelTime", { value: formatEmailDate(scheduledAt, locale, TIME_FORMAT) })}
                                </p>
                                <p style={{ fontSize: 13, color: "#fafaf9", margin: "0 0 4px" }}>
                                  {t("labelHost", { value: creatorName })}
                                </p>
                                {location && (
                                  <p style={{ fontSize: 13, color: "#fafaf9", margin: 0 }}>
                                    {t("labelPlace", { value: location })}
                                  </p>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: "center" }}>
                                <a
                                  href={`${appUrl}/app/tickets`}
                                  style={{
                                    display: "inline-block",
                                    padding: "14px 36px",
                                    borderRadius: 10,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#0a0a0b",
                                    backgroundColor: "#c8a445",
                                    textDecoration: "none",
                                  }}
                                >
                                  {t("reminderViewBooking")}
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "24px 0", textAlign: "center" }}>
                        <p style={{ fontSize: 11, color: "#3f3f3f", margin: 0 }}>
                          © {new Date().getFullYear()} Usha Platform
                        </p>
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
