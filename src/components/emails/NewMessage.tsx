interface NewMessageProps {
  recipientName: string;
  senderName: string;
  messagePreview: string;
}

export function getNewMessageSubject(senderName: string): string {
  return `Nytt meddelande från ${senderName} — Usha`;
}

export default function NewMessage({
  recipientName,
  senderName,
  messagePreview,
}: NewMessageProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";

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
                        <span style={{ fontSize: 28, fontWeight: 700, color: "#D4AF37", letterSpacing: "-0.02em" }}>
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
                          Hej {recipientName},
                        </p>
                        <p style={{ fontSize: 14, color: "#6b6b6b", margin: "0 0 24px", lineHeight: 1.6 }}>
                          {senderName} har skickat dig ett meddelande:
                        </p>

                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
                          <tbody>
                            <tr>
                              <td style={{
                                padding: "12px 16px",
                                borderRadius: 12,
                                backgroundColor: "#0a0a0b",
                                borderLeft: "3px solid #D4AF37",
                              }}>
                                <p style={{ fontSize: 14, color: "#fafaf9", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
                                  {messagePreview}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: "center" }}>
                                <a
                                  href={`${appUrl}/app/messages`}
                                  style={{
                                    display: "inline-block",
                                    padding: "14px 36px",
                                    borderRadius: 10,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#0a0a0b",
                                    backgroundColor: "#D4AF37",
                                    textDecoration: "none",
                                  }}
                                >
                                  Svara på meddelandet
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
                          Detta mejl skickades automatiskt från Usha.
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
