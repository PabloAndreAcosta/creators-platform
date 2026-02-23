import { createElement } from 'react';
import { getResend, getFromEmail } from './resend';
import { renderEmailToHtml } from './render';
import GoldMemberWelcome, { getGoldWelcomeSubject } from '@/components/emails/GoldMemberWelcome';

interface SendWelcomeParams {
  to: string;
  memberName: string;
  expiryDate: Date;
}

/**
 * Renders and sends the Gold Member Welcome email via Resend.
 */
export async function sendGoldWelcomeEmail({
  to,
  memberName,
  expiryDate,
}: SendWelcomeParams): Promise<void> {
  const resend = getResend();

  const html = renderEmailToHtml(
    createElement(GoldMemberWelcome, { memberName, expiryDate })
  );

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: getGoldWelcomeSubject(),
    html,
  });

  if (error) {
    console.error('Failed to send Gold welcome email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log(`Gold welcome email sent to ${to}`);
}
