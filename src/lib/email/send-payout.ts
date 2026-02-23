import { createElement } from 'react';
import { getResend, getFromEmail } from './resend';
import { renderEmailToHtml } from './render';
import PayoutConfirmation, { getPayoutSubject } from '@/components/emails/PayoutConfirmation';

interface PayoutEvent {
  title: string;
  attendees: number;
  revenue: number;
}

interface SendPayoutParams {
  to: string;
  creatorName: string;
  amount: number;
  commission: number;
  grossAmount: number;
  type: 'batch' | 'instant';
  transactionDate: Date;
  events?: PayoutEvent[];
}

/**
 * Renders and sends the Payout Confirmation email via Resend.
 */
export async function sendPayoutConfirmationEmail({
  to,
  creatorName,
  amount,
  commission,
  grossAmount,
  type,
  transactionDate,
  events = [],
}: SendPayoutParams): Promise<void> {
  const resend = getResend();

  const html = renderEmailToHtml(
    createElement(PayoutConfirmation, {
      creatorName,
      amount,
      commission,
      grossAmount,
      type,
      transactionDate,
      events,
    })
  );

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: getPayoutSubject(type, amount),
    html,
  });

  if (error) {
    console.error('Failed to send payout confirmation email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log(`Payout confirmation email sent to ${to} (${type}, ${amount} SEK)`);
}
