import type { Locale } from '@/i18n/config';
import type { Translate } from '@/lib/i18n/server';
import { formatEmailDate } from '@/lib/email/i18n';

/**
 * Välkomstmejlet när någon tecknat en betald nivå.
 *
 * Hette GoldMemberWelcome och räknade upp Publik Gulds förmåner för ALLA som
 * tecknade något — även en kreatör som köpt Guld för 299 kr, som då fick läsa
 * om rabatt på bokningar och en prioritetskö som inte gäller hen. Mallen bär
 * numera ingen egen förmånslista alls: den får nivåns namn och dess faktiska
 * förmåner utifrån, från lib/email/plan-benefits.ts.
 */
interface SubscriptionWelcomeProps {
  memberName: string;
  /** Nivåns namn, t.ex. "Guld". Mallen gissar aldrig själv. */
  planName: string;
  /** Nivåns förmåner på mottagarens språk, i ordning. */
  benefits: string[];
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

export function getSubscriptionWelcomeSubject(t: Translate, planName: string): string {
  return t('planWelcomeSubject', { plan: planName });
}

export default function SubscriptionWelcome({
  memberName,
  planName,
  benefits,
  expiryDate,
  t,
  locale,
}: SubscriptionWelcomeProps) {
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
                                  {planName}
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
                          {t('planWelcomeIntro', { plan: planName })}
                        </p>

                        {/* Benefits */}
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#fafaf9', margin: '0 0 16px' }}>
                          {t('planWelcomeBenefitsHeading')}
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 28 }}>
                          <tbody>
                            {benefits.map((benefit, i) => (
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
                                          <span style={{ fontSize: 14, color: '#c8a445' }}>&#10003;</span>
                                        </td>
                                        <td style={{ fontSize: 13, color: '#fafaf9', lineHeight: 1.5 }}>
                                          {benefit}
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
                                  {t('planWelcomeValidUntil')}
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
                          {t('planWelcomeNextSteps')}
                        </p>

                        {/* CTA Button */}
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: 'center' }}>
                                <a
                                  href={`${appUrl}/app`}
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
                                  {t('planWelcomeCta')}
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
