interface PayoutEvent {
  title: string;
  attendees: number;
  revenue: number;
}

interface PayoutConfirmationProps {
  creatorName: string;
  amount: number;
  commission: number;
  grossAmount: number;
  type: 'batch' | 'instant';
  transactionDate: Date;
  events: PayoutEvent[];
}

function sek(amount: number): string {
  return Math.round(amount).toLocaleString('sv-SE');
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getPayoutSubject(type: 'batch' | 'instant', amount: number): string {
  return type === 'batch'
    ? `Din veckoutbetalning: ${sek(amount)} SEK från Usha`
    : `Din instant payout: ${sek(amount)} SEK från Usha`;
}

export default function PayoutConfirmation({
  creatorName,
  amount,
  commission,
  grossAmount,
  type,
  transactionDate,
  events,
}: PayoutConfirmationProps) {
  const isBatch = type === 'batch';

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#0a0a0b', fontFamily: "'Outfit', Arial, sans-serif" }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#0a0a0b', padding: '40px 16px' }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 560 }}>
                  <tbody>
                    {/* Logo */}
                    <tr>
                      <td style={{ paddingBottom: 32, textAlign: 'center' }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: '#c8a445', letterSpacing: '-0.02em' }}>
                          Usha
                        </span>
                      </td>
                    </tr>

                    {/* Main Card */}
                    <tr>
                      <td style={{ backgroundColor: '#111113', borderRadius: 16, border: '1px solid #1f1f23', padding: '32px 28px' }}>
                        {/* Badge */}
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ paddingBottom: 20 }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 12px',
                                  borderRadius: 20,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  textTransform: 'uppercase' as const,
                                  letterSpacing: '0.05em',
                                  backgroundColor: isBatch ? 'rgba(200,164,69,0.1)' : 'rgba(168,85,247,0.1)',
                                  color: isBatch ? '#c8a445' : '#a855f7',
                                }}>
                                  {isBatch ? 'Veckoutbetalning' : 'Instant Payout'}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Greeting */}
                        <p style={{ fontSize: 16, color: '#fafaf9', margin: '0 0 8px' }}>
                          Hej {creatorName},
                        </p>
                        <p style={{ fontSize: 14, color: '#6b6b6b', margin: '0 0 24px', lineHeight: 1.6 }}>
                          {isBatch
                            ? `Din veckoutbetalning på ${sek(amount)} SEK är på väg till ditt konto.`
                            : `Din instant payout på ${sek(amount)} SEK är under behandling.`}
                        </p>

                        {/* Amount */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: 'center', padding: '20px 0', borderRadius: 12, backgroundColor: '#0a0a0b' }}>
                                <p style={{ fontSize: 36, fontWeight: 700, color: '#c8a445', margin: 0 }}>
                                  {sek(amount)} SEK
                                </p>
                                <p style={{ fontSize: 12, color: '#6b6b6b', margin: '4px 0 0' }}>
                                  {formatDate(transactionDate)}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Event Summary */}
                        {events.length > 0 && (
                          <>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#fafaf9', margin: '0 0 12px' }}>
                              Eventsammanfattning
                            </p>
                            <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24, borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <td style={{ fontSize: 11, color: '#6b6b6b', padding: '8px 0', borderBottom: '1px solid #1f1f23', textTransform: 'uppercase' as const }}>
                                    Event
                                  </td>
                                  <td style={{ fontSize: 11, color: '#6b6b6b', padding: '8px 0', borderBottom: '1px solid #1f1f23', textAlign: 'center', textTransform: 'uppercase' as const }}>
                                    Deltagare
                                  </td>
                                  <td style={{ fontSize: 11, color: '#6b6b6b', padding: '8px 0', borderBottom: '1px solid #1f1f23', textAlign: 'right', textTransform: 'uppercase' as const }}>
                                    Intäkt
                                  </td>
                                </tr>
                              </thead>
                              <tbody>
                                {events.map((event, i) => (
                                  <tr key={i}>
                                    <td style={{ fontSize: 13, color: '#fafaf9', padding: '10px 0', borderBottom: '1px solid #1f1f23' }}>
                                      {event.title}
                                    </td>
                                    <td style={{ fontSize: 13, color: '#6b6b6b', padding: '10px 0', borderBottom: '1px solid #1f1f23', textAlign: 'center' }}>
                                      {event.attendees}
                                    </td>
                                    <td style={{ fontSize: 13, color: '#fafaf9', padding: '10px 0', borderBottom: '1px solid #1f1f23', textAlign: 'right' }}>
                                      {sek(event.revenue)} SEK
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}

                        {/* Breakdown */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24, backgroundColor: '#0a0a0b', borderRadius: 12, padding: 16 }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '12px 16px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ fontSize: 13, color: '#6b6b6b', padding: '4px 0' }}>Total intäkt</td>
                                      <td style={{ fontSize: 13, color: '#fafaf9', padding: '4px 0', textAlign: 'right' }}>{sek(grossAmount)} SEK</td>
                                    </tr>
                                    <tr>
                                      <td style={{ fontSize: 13, color: '#6b6b6b', padding: '4px 0' }}>Provision</td>
                                      <td style={{ fontSize: 13, color: '#ef4444', padding: '4px 0', textAlign: 'right' }}>-{sek(commission)} SEK</td>
                                    </tr>
                                    <tr>
                                      <td colSpan={2} style={{ borderBottom: '1px solid #1f1f23', padding: '8px 0 0' }} />
                                    </tr>
                                    <tr>
                                      <td style={{ fontSize: 14, fontWeight: 600, color: '#fafaf9', padding: '8px 0 0' }}>Till ditt konto</td>
                                      <td style={{ fontSize: 14, fontWeight: 700, color: '#c8a445', padding: '8px 0 0', textAlign: 'right' }}>{sek(amount)} SEK</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Timeline */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 8 }}>
                          <tbody>
                            <tr>
                              <td style={{
                                padding: '12px 16px',
                                borderRadius: 12,
                                backgroundColor: isBatch ? 'rgba(200,164,69,0.05)' : 'rgba(168,85,247,0.05)',
                                border: `1px solid ${isBatch ? 'rgba(200,164,69,0.15)' : 'rgba(168,85,247,0.15)'}`,
                              }}>
                                <p style={{ fontSize: 13, color: isBatch ? '#c8a445' : '#a855f7', margin: 0, fontWeight: 500 }}>
                                  {isBatch
                                    ? 'Pengarna beräknas vara på ditt konto senast måndag morgon'
                                    : 'Pengarna beräknas vara på ditt konto inom 5–10 minuter'}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={{ padding: '24px 0', textAlign: 'center' }}>
                        <p style={{ fontSize: 12, color: '#6b6b6b', margin: '0 0 4px' }}>
                          Frågor? Kontakta{' '}
                          <a href="mailto:support@usha.se" style={{ color: '#c8a445', textDecoration: 'none' }}>
                            support@usha.se
                          </a>
                        </p>
                        <p style={{ fontSize: 11, color: '#3f3f3f', margin: 0 }}>
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
