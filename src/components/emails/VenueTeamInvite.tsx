import type { Translate } from "@/lib/i18n/server";
import type { VenueCapability } from "@/lib/venues/members";

interface Props {
  venueName: string;
  /** Mottagarens namn om hen redan har konto, annars null. */
  recipientName: string | null;
  capabilities: VenueCapability[];
  token: string;
  /** Översättare för `emails`-namespacet, på mottagarens språk. */
  t: Translate;
}

export function getVenueTeamInviteSubject(t: Translate, venueName: string): string {
  return t("venueTeamInvite.subject", { venue: venueName });
}

/**
 * Inbjudan till ett lokalteam.
 *
 * Mejlet säger vad personen får göra INNAN hen tackar ja, och att ekonomin
 * stannar hos lokalen. Behörigheten börjar gälla först på sidan bakom länken —
 * mejlet i sig ger ingenting, så ett vidarebefordrat mejl är bara en länk som
 * kräver inloggning med rätt adress.
 */
export default function VenueTeamInvite({ venueName, recipientName, capabilities, token, t }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
  const href = `${appUrl}/app/venue-team/join/${encodeURIComponent(token)}`;
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
                        <p style={{ fontSize: 18, fontWeight: 600, color: "#fafaf9", margin: "0 0 8px" }}>
                          {recipientName ? t("greeting", { name: recipientName }) : t("greetingNoName")}
                        </p>
                        <p style={{ fontSize: 14, color: "#a3a3a3", margin: "0 0 20px", lineHeight: 1.6 }}>
                          {t("venueTeamInvite.intro", { venue: venueName })}
                        </p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#fafaf9", margin: "0 0 8px" }}>
                          {t("venueTeamInvite.capsHeading")}
                        </p>
                        {capabilities.length > 0 ? (
                          <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "#d4d4d4", fontSize: 14, lineHeight: 1.7 }}>
                            {capabilities.map((c) => (
                              <li key={c}>{t(`venueTeamInvite.caps.${c}`)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ fontSize: 14, color: "#a3a3a3", margin: "0 0 20px", lineHeight: 1.6 }}>
                            {t("venueTeamInvite.noCaps")}
                          </p>
                        )}
                        <p style={{ fontSize: 13, color: "#a3a3a3", margin: "0 0 24px", padding: "12px 16px", borderLeft: "3px solid #c8a445", backgroundColor: "#0a0a0b", borderRadius: 12, lineHeight: 1.6 }}>
                          {t("venueTeamInvite.moneyNote", { venue: venueName })}
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: "center" }}>
                                <a
                                  href={href}
                                  style={{ display: "inline-block", padding: "12px 28px", borderRadius: 999, backgroundColor: "#c8a445", color: "#0a0a0b", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
                                >
                                  {t("venueTeamInvite.cta")}
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ fontSize: 12, color: "#6b6b6b", margin: "24px 0 0", lineHeight: 1.6 }}>{t("venueTeamInvite.footer")}</p>
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
