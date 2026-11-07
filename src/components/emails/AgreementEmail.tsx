import type { Translate } from "@/lib/i18n/server";

export type AgreementEmailKind = "sent" | "signed" | "declined";

interface Props {
  kind: AgreementEmailKind;
  recipientName: string;
  otherName: string;
  title: string;
  agreementId: string;
  reason?: string | null;
  /** Översättare för `emails`-namespacet, på mottagarens språk. */
  t: Translate;
}

export function getAgreementSubject(t: Translate, kind: AgreementEmailKind, title: string): string {
  return t(`agreement.${kind}Subject`, { title });
}

/**
 * Avtalsmejl: skickat (signera), signerat (klart), avböjt.
 * Länken går till avtalet i appen — avtalet självt ligger inte i mejlet, det
 * är inloggningen som gör att rätt person ser rätt dokument.
 */
export default function AgreementEmail({ kind, recipientName, otherName, title, agreementId, reason, t }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
  return (
    <html>
      {/* eslint-disable-next-line @next/next/no-head-element -- mejl, inte en sida */}
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
                        <p style={{ fontSize: 18, fontWeight: 600, color: "#fafaf9", margin: "0 0 8px" }}>{t("greeting", { name: recipientName })}</p>
                        <p style={{ fontSize: 14, color: "#a3a3a3", margin: "0 0 20px", lineHeight: 1.6 }}>
                          {t(`agreement.${kind}Intro`, { name: otherName })}
                        </p>
                        <p style={{ fontSize: 16, fontWeight: 600, color: "#fafaf9", margin: "0 0 20px", padding: "12px 16px", borderLeft: "3px solid #c8a445", backgroundColor: "#0a0a0b", borderRadius: 12 }}>
                          {title}
                        </p>
                        {kind === "declined" && reason && (
                          <p style={{ fontSize: 14, color: "#a3a3a3", margin: "0 0 20px", lineHeight: 1.6 }}>{t("agreement.declinedReason", { reason })}</p>
                        )}
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: "center" }}>
                                <a
                                  href={`${appUrl}/app/avtal/${agreementId}`}
                                  style={{ display: "inline-block", padding: "12px 28px", borderRadius: 999, backgroundColor: "#c8a445", color: "#0a0a0b", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
                                >
                                  {t(`agreement.${kind}Cta`)}
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ fontSize: 12, color: "#6b6b6b", margin: "24px 0 0", lineHeight: 1.6 }}>{t("agreement.footer")}</p>
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
