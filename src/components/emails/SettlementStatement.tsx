import type { Locale } from '@/i18n/config';
import type { Translate } from '@/lib/i18n/server';
import { formatEmailDate, formatSek } from '@/lib/email/i18n';
import type { MonthlyStatement } from '@/lib/settlements/monthly-statement';

interface SettlementStatementProps {
  partnerName: string;
  statement: MonthlyStatement;
  /** Translator for the `emails` namespace, in the recipient's language. */
  t: Translate;
  locale: Locale;
}

const kr = (ore: number) => `${formatSek(ore / 100)} SEK`;

/** "oktober 2026" in the reader's language. */
export function formatPeriod(period: string, locale: Locale): string {
  const [y, m] = period.split('-').map(Number);
  return formatEmailDate(new Date(Date.UTC(y, m - 1, 15, 12)), locale, { month: 'long', year: 'numeric' });
}

function formatDay(date: string, locale: Locale): string {
  const [y, m, d] = date.split('-').map(Number);
  return formatEmailDate(new Date(Date.UTC(y, m - 1, d, 12)), locale, { day: 'numeric', month: 'short' });
}

export function getSettlementStatementSubject(t: Translate, partnerName: string, period: string, locale: Locale): string {
  return t('statementSubject', { partner: partnerName, period: formatPeriod(period, locale) });
}

const cell = { fontSize: 13, color: '#fafaf9', padding: '8px 0', borderBottom: '1px solid #1f1f23' } as const;
const head = { fontSize: 11, color: '#6b6b6b', padding: '8px 0', borderBottom: '1px solid #1f1f23', textTransform: 'uppercase' as const };

export default function SettlementStatement({ partnerName, statement, t, locale }: SettlementStatementProps) {
  const { rows, earlier, totals } = statement;
  const anyPending = rows.some((r) => r.pending);
  const sum = (label: string, value: string, strong = false) => (
    <tr>
      <td style={{ fontSize: 13, color: strong ? '#fafaf9' : '#6b6b6b', fontWeight: strong ? 600 : 400, padding: '4px 0' }}>{label}</td>
      <td style={{ fontSize: 13, color: strong ? '#c8a445' : '#fafaf9', fontWeight: strong ? 700 : 400, padding: '4px 0', textAlign: 'right' }}>{value}</td>
    </tr>
  );

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
                <table width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 600 }}>
                  <tbody>
                    <tr>
                      <td style={{ paddingBottom: 32, textAlign: 'center' }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: '#c8a445', letterSpacing: '-0.02em' }}>Usha Platform</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#111113', borderRadius: 16, border: '1px solid #1f1f23', padding: '32px 28px' }}>
                        <p style={{ fontSize: 16, color: '#fafaf9', margin: '0 0 8px' }}>{t('greeting', { name: partnerName })}</p>
                        <p style={{ fontSize: 14, color: '#6b6b6b', margin: '0 0 24px', lineHeight: 1.6 }}>
                          {t('statementIntro', {
                            period: formatPeriod(statement.period, locale),
                            evenings: totals.evenings,
                            tickets: totals.tickets,
                          })}
                        </p>

                        {rows.length > 0 && (
                          <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <td style={head}>{t('statementColDate')}</td>
                                <td style={head}>{t('statementColEvening')}</td>
                                <td style={{ ...head, textAlign: 'center' }}>{t('statementColTickets')}</td>
                                <td style={{ ...head, textAlign: 'right' }}>{t('statementColGross')}</td>
                                <td style={{ ...head, textAlign: 'right' }}>{t('statementColShare')}</td>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r) => (
                                <tr key={r.eventDate + r.title}>
                                  <td style={{ ...cell, whiteSpace: 'nowrap', paddingRight: 8 }}>{formatDay(r.eventDate, locale)}</td>
                                  <td style={cell}>{r.title}{r.pending ? ` (${t('statementPending')})` : ''}</td>
                                  <td style={{ ...cell, textAlign: 'center' }}>{r.tickets}</td>
                                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{kr(r.grossOre)}</td>
                                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{kr(r.dueOre)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24, backgroundColor: '#0a0a0b', borderRadius: 12 }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '12px 16px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    {sum(t('statementTotalGross'), kr(totals.grossOre))}
                                    {sum(t('statementTotalVat'), kr(totals.vatOre))}
                                    {sum(t('statementTotalBasis'), kr(totals.basisOre))}
                                    {sum(t('statementTotalShare'), kr(totals.dueOre))}
                                    {sum(t('statementTotalPaid'), kr(totals.paidOre), true)}
                                    {totals.swishGrossOre > 0 && sum(t('statementTotalSwish'), kr(totals.swishGrossOre))}
                                    {totals.swishGrossOre > 0 && sum(t('statementTotalSwishShare'), kr(totals.swishDueOre), true)}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {earlier.length > 0 && (
                          <>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#fafaf9', margin: '0 0 8px' }}>{t('statementEarlierHeading')}</p>
                            <p style={{ fontSize: 13, color: '#6b6b6b', margin: '0 0 8px', lineHeight: 1.6 }}>{t('statementEarlierBody')}</p>
                            <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24, borderCollapse: 'collapse' }}>
                              <tbody>
                                {earlier.map((e) => (
                                  <tr key={e.eventDate + (e.transferId ?? '')}>
                                    <td style={{ ...cell, whiteSpace: 'nowrap', paddingRight: 8 }}>{formatDay(e.eventDate, locale)}</td>
                                    <td style={cell}>{e.title}</td>
                                    <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{kr(e.amountOre)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}

                        {totals.swishGrossOre > 0 && (
                          <p style={{ fontSize: 13, color: '#6b6b6b', margin: '0 0 12px', lineHeight: 1.6 }}>{t('statementSwishNote')}</p>
                        )}
                        {anyPending && (
                          <p style={{ fontSize: 13, color: '#6b6b6b', margin: '0 0 12px', lineHeight: 1.6 }}>{t('statementPendingNote')}</p>
                        )}
                        <p style={{ fontSize: 13, color: '#6b6b6b', margin: 0, lineHeight: 1.6 }}>{t('statementAttachment')}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ paddingTop: 24, textAlign: 'center' }}>
                        <p style={{ fontSize: 12, color: '#6b6b6b', margin: 0 }}>{t('statementFooter')}</p>
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
