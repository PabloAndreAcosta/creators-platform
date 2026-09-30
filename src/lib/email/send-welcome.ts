import { createElement } from 'react';
import { getResend, getFromEmail } from './resend';
import { renderEmailToHtml } from './render';
import SubscriptionWelcome, { getSubscriptionWelcomeSubject } from '@/components/emails/SubscriptionWelcome';
import { getEmailIntl } from './i18n';
import { planBenefits, planName } from './plan-benefits';
import { resolveRecipientLocale } from '@/lib/i18n/recipient';

interface SendWelcomeParams {
  to: string;
  memberName: string;
  /** Nivån som tecknats, t.ex. "kreator_guld". Avgör vad mejlet räknar upp. */
  planKey: string;
  expiryDate: Date;
  /** Recipient's account, so the mail matches the language they read the app in. */
  memberId?: string | null;
}

/**
 * Välkomstmejl till den som tecknat en betald nivå.
 *
 * Förmånerna kommer från nivån, inte från mallen. Se lib/email/plan-benefits.ts
 * för varför det inte får hårdkodas här.
 */
export async function sendSubscriptionWelcomeEmail({
  to,
  memberName,
  planKey,
  expiryDate,
  memberId,
}: SendWelcomeParams): Promise<void> {
  const namn = planName(planKey);
  if (!namn) {
    // En nivå vi inte känner igen ska inte ge ett mejl med tom förmånslista.
    console.error('Welcome email skipped: unknown plan', planKey);
    return;
  }

  const resend = getResend();
  const { t, locale } = await getEmailIntl(await resolveRecipientLocale({ userId: memberId, email: to }));
  const benefits = await planBenefits(planKey, locale);

  const html = await renderEmailToHtml(
    createElement(SubscriptionWelcome, { memberName, planName: namn, benefits, expiryDate, t, locale })
  );

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: getSubscriptionWelcomeSubject(t, namn),
    html,
  });

  if (error) {
    console.error('Failed to send subscription welcome email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log(`Subscription welcome email sent to ${to} (${planKey})`);
}
