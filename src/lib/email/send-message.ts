import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import NewMessage, { getNewMessageSubject } from "@/components/emails/NewMessage";
import { getEmailIntl } from "./i18n";
import { resolveRecipientLocale } from "@/lib/i18n/recipient";

interface SendNewMessageEmailParams {
  to: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
  /** Recipient's account, so the mail matches the language they read the app in. */
  recipientId?: string | null;
}

export async function sendNewMessageEmail({
  to,
  recipientName,
  senderName,
  messagePreview,
  recipientId,
}: SendNewMessageEmailParams): Promise<void> {
  try {
    const resend = getResend();
    const { t } = await getEmailIntl(await resolveRecipientLocale({ userId: recipientId, email: to }));
    const html = await renderEmailToHtml(
      createElement(NewMessage, { recipientName, senderName, messagePreview, t })
    );

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: getNewMessageSubject(t, senderName),
      html,
    });

    if (error) {
      console.error("Failed to send new message email:", error);
    } else {
      console.log(`New message notification email sent to ${to}`);
    }
  } catch (e) {
    console.error("Email send error (new message):", e);
  }
}
