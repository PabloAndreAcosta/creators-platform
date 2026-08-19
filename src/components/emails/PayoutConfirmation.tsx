import type { Locale } from '@/i18n/config';
import type { Translate } from '@/lib/i18n/server';
import { formatEmailDate, formatSek } from '@/lib/email/i18n';

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
  /** Translator for the `emails` namespace, in the recipient's language. */
  t: Translate;
  locale: Locale;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

export function getPayoutSubject(t: Translate, type: 'batch' | 'instant', amount: number): string {
  return t(type === 'batch' ? 'payoutSubjectBatch' : 'payoutSubjectInstant', {
    amount: formatSek(amount),
  });
}

export default function PayoutConfirmation({
  creatorName,
  amount,
  commission,
  grossAmount,
  type,
  transactionDate,
  events,
  t,
  locale,
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
                          Usha Platform
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
                                  {t(isBatch ? 'payoutBadgeBatch' : 'payoutBadgeInstant')}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Greeting */}
                        <p style={{ fontSize: 16, color: '#fafaf9', margin: '0 0 8px' }}>
                          {t('greeting', { name: creatorName })}
                        </p>
                        <p style={{ fontSize: 14, color: '#6b6b6b', margin: '0 0 24px', lineHeight: 1.6 }}>
                          {t(isBatch ? 'payoutIntroBatch' : 'payoutIntroInstant', {
                            amount: formatSek(amount),
                          })}
                        </p>

                        {/* Amount */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: 'center', padding: '20px 0', borderRadius: 12, backgroundColor: '#0a0a0b' }}>
                                <p style={{ fontSize: 36, fontWeight: 700, color: '#c8a445', margin: 0 }}>
                                  {formatSek(amount)} SEK
                                </p>
                                <p style={{ fontSize: 12, color: '#6b6b6b', margin: '4px 0 0' }}>
                                  {formatEmailDate(transactionDate, locale, DATE_FORMAT)}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Event Summary */}
                        {events.length > 0 && (
                          <>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#fafaf9', margin: '0 0 12px' }}>
                              {t('payoutEventSummary')}
                            </p>
                            <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24, borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <td style={{ fontSize: 11, color: '#6b6b6b', padding: '8px 0', borderBottom: '1px solid #1f1f23', textTransform: 'uppercase' as const }}>
                                    {t('payoutColEvent')}
                                  </td>
                                  <td style={{ fontSize: 11, color: '#6b6b6b', padding: '8px 0', borderBottom: '1px solid #1f1f23', textAlign: 'center', textTransform: 'uppercase' as const }}>
                                    {t('payoutColAttendees')}
                                  </td>
                                  <td style={{ fontSize: 11, color: '#6b6b6b', padding: '8px 0', borderBottom: '1px solid #1f1f23', textAlign: 'right', textTransform: 'uppercase' as const }}>
                                    {t('payoutColRevenue')}
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
                                      {formatSek(event.revenue)} SEK
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
                                      <td style={{ fontSize: 13, color: '#6b6b6b', padding: '4px 0' }}>{t('payoutTotalRevenue')}</td>
                                      <td style={{ fontSize: 13, color: '#fafaf9', padding: '4px 0', textAlign: 'right' }}>{formatSek(grossAmount)} SEK</td>
                                    </tr>
                                    <tr>
                                      <td style={{ fontSize: 13, color: '#6b6b6b', padding: '4px 0' }}>{t('payoutCommission')}</td>
                                      <td style={{ fontSize: 13, color: '#ef4444', padding: '4px 0', textAlign: 'right' }}>-{formatSek(commission)} SEK</td>
                                    </tr>
                                    <tr>
                                      <td colSpan={2} style={{ borderBottom: '1px solid #1f1f23', padding: '8px 0 0' }} />
                                    </tr>
                                    <tr>
                                      <td style={{ fontSize: 14, fontWeight: 600, color: '#fafaf9', padding: '8px 0 0' }}>{t('payoutToYourAccount')}</td>
                                      <td style={{ fontSize: 14, fontWeight: 700, color: '#c8a445', padding: '8px 0 0', textAlign: 'right' }}>{formatSek(amount)} SEK</td>
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
                                  {t(isBatch ? 'payoutTimelineBatch' : 'payoutTimelineInstant')}
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
                          {t('questionsContact')}{' '}
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
