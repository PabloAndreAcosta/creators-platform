import type { Locale } from '@/i18n/config';
import type { Translate } from '@/lib/i18n/server';
import { formatEmailDate } from '@/lib/email/i18n';

interface TrialEndingProps {
  memberName: string;
  trialEndDate: Date;
  daysLeft: number;
  /** Translator for the `emails` namespace, in the recipient's language. */
  t: Translate;
  locale: Locale;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

export function getTrialEndingSubject(t: Translate, daysLeft: number): string {
  return daysLeft <= 1
    ? t('trialSubjectTomorrow')
    : t('trialSubjectDays', { days: daysLeft });
}

export default function TrialEnding({
  memberName,
  trialEndDate,
  daysLeft,
  t,
  locale,
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
                          Usha Platform
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
                          {t('greetingExcited', { name: memberName })}
                        </p>
                        <p style={{ fontSize: 14, color: '#6b6b6b', margin: '0 0 24px', lineHeight: 1.6, textAlign: 'center' }}>
                          {daysLeft <= 1
                            ? t('trialIntroTomorrow')
                            : t('trialIntroDays', { days: daysLeft })}
                          {' '}{t('trialIntroUpgrade')}
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
                                  {t('trialEndsLabel')}
                                </p>
                                <p style={{
                                  fontSize: 15,
                                  fontWeight: 600,
                                  color: isUrgent ? '#ef4444' : '#c8a445',
                                  margin: 0,
                                }}>
                                  {formatEmailDate(trialEndDate, locale, DATE_FORMAT)}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p style={{ fontSize: 13, color: '#6b6b6b', margin: '0 0 20px', lineHeight: 1.6, textAlign: 'center' }}>
                          {t('trialWarning')}
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
                                  {t('trialCta')}
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
