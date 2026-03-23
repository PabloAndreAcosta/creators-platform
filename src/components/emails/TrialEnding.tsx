interface TrialEndingProps {
  memberName: string;
  trialEndDate: Date;
  daysLeft: number;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getTrialEndingSubject(daysLeft: number): string {
  if (daysLeft <= 1) return 'Din provperiod slutar imorgon';
  return `Din provperiod slutar om ${daysLeft} dagar`;
}

export default function TrialEnding({
  memberName,
  trialEndDate,
  daysLeft,
}: TrialEndingProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usha.se';
  const isUrgent = daysLeft <= 2;

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
                      <td style={{
                        backgroundColor: '#111113',
                        borderRadius: 16,
                        border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.3)' : 'rgba(200,164,69,0.2)'}`,
                        padding: '32px 28px',
                      }}>
                        {/* Icon */}
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: 'center', paddingBottom: 20 }}>
                                <div style={{ fontSize: 48, lineHeight: 1 }}>
                                  {isUrgent ? '⏰' : '📅'}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p style={{ fontSize: 18, fontWeight: 600, color: '#fafaf9', margin: '0 0 8px', textAlign: 'center' }}>
                          Hej {memberName}!
                        </p>
                        <p style={{ fontSize: 14, color: '#6b6b6b', margin: '0 0 24px', lineHeight: 1.6, textAlign: 'center' }}>
                          {daysLeft <= 1
                            ? 'Din gratis provperiod slutar imorgon.'
                            : `Din gratis provperiod slutar om ${daysLeft} dagar.`}
                          {' '}För att fortsätta använda alla Premium-funktioner behöver du uppgradera din plan.
                        </p>

                        {/* Date box */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 28 }}>
                          <tbody>
                            <tr>
                              <td style={{
                                padding: '12px 16px',
                                borderRadius: 12,
                                backgroundColor: '#0a0a0b',
                                textAlign: 'center',
                              }}>
                                <p style={{ fontSize: 12, color: '#6b6b6b', margin: '0 0 2px' }}>
                                  Provperioden slutar
                                </p>
                                <p style={{
                                  fontSize: 15,
                                  fontWeight: 600,
                                  color: isUrgent ? '#ef4444' : '#c8a445',
                                  margin: 0,
                                }}>
                                  {formatDate(trialEndDate)}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p style={{ fontSize: 13, color: '#6b6b6b', margin: '0 0 20px', lineHeight: 1.6, textAlign: 'center' }}>
                          Om du inte uppgraderar återgår ditt konto till gratisplanen och du förlorar
                          tillgång till Premium-funktioner som lägre kommission, toppsynlighet och dedikerad support.
                        </p>

                        {/* CTA Button */}
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: 'center' }}>
                                <a
                                  href={`${appUrl}/dashboard/billing`}
                                  style={{
                                    display: 'inline-block',
                                    padding: '14px 36px',
                                    borderRadius: 10,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: '#0a0a0b',
                                    backgroundColor: '#c8a445',
                                    textDecoration: 'none',
                                  }}
                                >
                                  Uppgradera nu
                                </a>
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
