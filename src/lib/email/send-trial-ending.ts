import { createElement } from 'react';
import { getResend, getFromEmail } from './resend';
import { renderEmailToHtml } from './render';
import TrialEnding, { getTrialEndingSubject } from '@/components/emails/TrialEnding';
import { getEmailIntl } from './i18n';
import { resolveRecipientLocale } from '@/lib/i18n/recipient';

interface SendTrialEndingParams {
  to: string;
  memberName: string;
  trialEndDate: Date;
  daysLeft: number;
  /** Recipient's account, so the mail matches the language they read the app in. */
  memberId?: string | null;
}

export async function sendTrialEndingEmail({
  to,
  memberName,
  trialEndDate,
  daysLeft,
  memberId,
}: SendTrialEndingParams): Promise<void> {
  const resend = getResend();
  const { t, locale } = await getEmailIntl(await resolveRecipientLocale({ userId: memberId, email: to }));

  const html = await renderEmailToHtml(
    createElement(TrialEnding, { memberName, trialEndDate, daysLeft, t, locale })
  );

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: getTrialEndingSubject(t, daysLeft),
    html,
  });

  if (error) {
    console.error('Failed to send trial ending email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log(`Trial ending email (${daysLeft} days) sent to ${to}`);
}
