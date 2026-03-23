import { createElement } from 'react';
import { getResend, getFromEmail } from './resend';
import { renderEmailToHtml } from './render';
import TrialEnding, { getTrialEndingSubject } from '@/components/emails/TrialEnding';

interface SendTrialEndingParams {
  to: string;
  memberName: string;
  trialEndDate: Date;
  daysLeft: number;
}

export async function sendTrialEndingEmail({
  to,
  memberName,
  trialEndDate,
  daysLeft,
}: SendTrialEndingParams): Promise<void> {
  const resend = getResend();

  const html = await renderEmailToHtml(
    createElement(TrialEnding, { memberName, trialEndDate, daysLeft })
  );

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: getTrialEndingSubject(daysLeft),
    html,
  });

  if (error) {
    console.error('Failed to send trial ending email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log(`Trial ending email (${daysLeft} days) sent to ${to}`);
}
