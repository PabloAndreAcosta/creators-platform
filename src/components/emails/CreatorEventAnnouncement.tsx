interface CreatorEventAnnouncementProps {
  followerName: string;
  creatorName: string;
  eventTitle: string;
  eventDate?: Date;
  location?: string;
  eventUrl: string;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function getCreatorEventSubject(creatorName: string, eventTitle: string): string {
  return `${creatorName} har lagt upp: ${eventTitle}`;
}

export default function CreatorEventAnnouncement({
  followerName,
  creatorName,
  eventTitle,
  eventDate,
  location,
  eventUrl,
}: CreatorEventAnnouncementProps) {
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
                          Usha
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
                          Hej {followerName}!
                        </p>
                        <p style={{ fontSize: 14, color: "#6b6b6b", margin: "0 0 24px", lineHeight: 1.6 }}>
                          {creatorName}, som du följer, har lagt upp ett nytt event:
                        </p>

                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: "12px 16px", borderRadius: 12, backgroundColor: "#0a0a0b" }}>
                                <p style={{ fontSize: 15, fontWeight: 600, color: "#c8a445", margin: "0 0 8px" }}>
                                  {eventTitle}
                                </p>
                                {eventDate && (
                                  <p style={{ fontSize: 13, color: "#fafaf9", margin: "0 0 4px" }}>
                                    Datum: {formatDate(eventDate)}
                                  </p>
                                )}
                                {location && (
                                  <p style={{ fontSize: 13, color: "#fafaf9", margin: 0 }}>
                                    Plats: {location}
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
                                  href={eventUrl}
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
                                  Se eventet
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
                          Du får detta för att du följer {creatorName} på Usha.
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
