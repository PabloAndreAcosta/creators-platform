import type { Locale } from '@/i18n/config';
import type { Translate } from '@/lib/i18n/server';
import { formatEmailDate } from '@/lib/email/i18n';

interface GoldMemberWelcomeProps {
  memberName: string;
  expiryDate: Date;
  /** Translator for the `emails` namespace, in the recipient's language. */
  t: Translate;
  locale: Locale;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

export function getGoldWelcomeSubject(t: Translate): string {
  return t('goldSubject');
}

const BENEFITS = [
  { key: 'goldBenefitDiscount', icon: '💰' },
  { key: 'goldBenefitEarlyAccess', icon: '⏰' },
  { key: 'goldBenefitPriorityQueue', icon: '🎯' },
  { key: 'goldBenefitPrioritySupport', icon: '🎓' },
];

export default function GoldMemberWelcome({
  memberName,
  expiryDate,
  t,
  locale,
}: GoldMemberWelcomeProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usha.se';

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
                        border: '1px solid rgba(200,164,69,0.2)',
                        padding: '32px 28px',
                        backgroundImage: 'linear-gradient(135deg, rgba(200,164,69,0.06) 0%, transparent 50%)',
                      }}>
                        {/* Gold Badge */}
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: 'center', paddingBottom: 24 }}>
                                {/* Star icon */}
                                <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>
                                  ★
                                </div>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '6px 16px',
                                  borderRadius: 20,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  textTransform: 'uppercase' as const,
                                  letterSpacing: '0.08em',
                                  backgroundColor: 'rgba(200,164,69,0.15)',
                                  color: '#c8a445',
                                  border: '1px solid rgba(200,164,69,0.2)',
                                }}>
                                  {t('goldBadge')}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Greeting */}
                        <p style={{ fontSize: 18, fontWeight: 600, color: '#fafaf9', margin: '0 0 8px', textAlign: 'center' }}>
                          {t('greetingExcited', { name: memberName })}
                        </p>
                        <p style={{ fontSize: 14, color: '#6b6b6b', margin: '0 0 28px', lineHeight: 1.6, textAlign: 'center' }}>
                          {t('goldIntro')}
                        </p>

                        {/* Benefits */}
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#fafaf9', margin: '0 0 16px' }}>
                          {t('goldBenefitsHeading')}
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 28 }}>
                          <tbody>
                            {BENEFITS.map((benefit, i) => (
                              <tr key={i}>
                                <td style={{
                                  padding: '10px 12px',
                                  borderRadius: 10,
                                  backgroundColor: i % 2 === 0 ? 'rgba(200,164,69,0.04)' : 'transparent',
                                }}>
                                  <table cellPadding={0} cellSpacing={0}>
                                    <tbody>
                                      <tr>
                                        <td style={{ width: 28, verticalAlign: 'top', paddingTop: 1 }}>
                                          <span style={{ fontSize: 14 }}>{benefit.icon}</span>
                                        </td>
                                        <td style={{ fontSize: 13, color: '#fafaf9', lineHeight: 1.5 }}>
                                          {t(benefit.key)}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Validity */}
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
                                  {t('goldValidUntil')}
                                </p>
                                <p style={{ fontSize: 15, fontWeight: 600, color: '#c8a445', margin: 0 }}>
                                  {formatEmailDate(expiryDate, locale, DATE_FORMAT)}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Next Steps */}
                        <p style={{ fontSize: 14, color: '#6b6b6b', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
                          {t('goldNextSteps')}
                        </p>

                        {/* CTA Button */}
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: 'center' }}>
                                <a
                                  href={`${appUrl}/marketplace`}
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
                                  {t('goldCta')}
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
