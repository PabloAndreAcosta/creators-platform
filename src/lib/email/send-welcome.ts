import { createElement } from 'react';
import { getResend, getFromEmail } from './resend';
import { renderEmailToHtml } from './render';
import GoldMemberWelcome, { getGoldWelcomeSubject } from '@/components/emails/GoldMemberWelcome';
import { getEmailIntl } from './i18n';
import { resolveRecipientLocale } from '@/lib/i18n/recipient';

interface SendWelcomeParams {
  to: string;
  memberName: string;
  expiryDate: Date;
  /** Recipient's account, so the mail matches the language they read the app in. */
  memberId?: string | null;
}

/**
 * Renders and sends the Gold Member Welcome email via Resend.
 */
export async function sendGoldWelcomeEmail({
  to,
  memberName,
  expiryDate,
  memberId,
}: SendWelcomeParams): Promise<void> {
  const resend = getResend();
  const { t, locale } = await getEmailIntl(await resolveRecipientLocale({ userId: memberId, email: to }));

  const html = await renderEmailToHtml(
    createElement(GoldMemberWelcome, { memberName, expiryDate, t, locale })
  );

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: getGoldWelcomeSubject(t),
    html,
  });

  if (error) {
    console.error('Failed to send Gold welcome email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log(`Gold welcome email sent to ${to}`);
}
