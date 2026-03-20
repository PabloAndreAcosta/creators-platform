import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import NewMessage, { getNewMessageSubject } from "@/components/emails/NewMessage";

interface SendNewMessageEmailParams {
  to: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
}

export async function sendNewMessageEmail({
  to,
  recipientName,
  senderName,
  messagePreview,
}: SendNewMessageEmailParams): Promise<void> {
  try {
    const resend = getResend();
    const html = await renderEmailToHtml(
      createElement(NewMessage, { recipientName, senderName, messagePreview })
    );

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: getNewMessageSubject(senderName),
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
