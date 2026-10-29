import type { Locale } from "@/i18n/config";
import type { Translate } from "@/lib/i18n/server";

interface PasswordResetProps {
  resetUrl: string;
  t: Translate;
  locale: Locale;
}

export function getPasswordResetSubject(t: Translate): string {
  return t("passwordResetSubject");
}

/**
 * Länk för att välja nytt lösenord. Länken går till usha.se och förbrukar
 * ingenting när den öppnas — koden används först när man sparar det nya
 * lösenordet. Gmails länkkontroll kan alltså inte bränna den.
 */
export default function PasswordReset({ resetUrl, t }: PasswordResetProps) {
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
                        <span style={{ fontSize: 28, fontWeight: 700, color: "#c8a445", letterSpacing: "-0.02em" }}>Usha Platform</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: "#111113", borderRadius: 16, border: "1px solid rgba(200,164,69,0.15)", padding: "32px 28px" }}>
                        <p style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 600, color: "#f5f5f5" }}>{t("greetingNoName")}</p>
                        <p style={{ margin: "0 0 24px", fontSize: 15, lineHeight: 1.6, color: "#b8b8bd" }}>
                          {t("passwordResetIntro")}
                        </p>
                        <table cellPadding={0} cellSpacing={0} style={{ margin: "0 auto" }}>
                          <tbody>
                            <tr>
                              <td>
                                <a
                                  href={resetUrl}
                                  style={{ display: "inline-block", padding: "14px 36px", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#0a0a0b", backgroundColor: "#c8a445", textDecoration: "none" }}
                                >
                                  {t("passwordResetCta")}
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ margin: "24px 0 0", fontSize: 12, lineHeight: 1.6, color: "#77777d" }}>{t("passwordResetFooter")}</p>
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
