import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import CreatorEventAnnouncement, { getCreatorEventSubject } from "@/components/emails/CreatorEventAnnouncement";

interface SendCreatorEventParams {
  to: string;
  followerName: string;
  creatorName: string;
  eventTitle: string;
  eventDate?: Date;
  location?: string;
  eventUrl: string;
}

export async function sendCreatorEventEmail({
  to,
  followerName,
  creatorName,
  eventTitle,
  eventDate,
  location,
  eventUrl,
}: SendCreatorEventParams): Promise<void> {
  try {
    const resend = getResend();
    const html = await renderEmailToHtml(
      createElement(CreatorEventAnnouncement, { followerName, creatorName, eventTitle, eventDate, location, eventUrl })
    );

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: getCreatorEventSubject(creatorName, eventTitle),
      html,
    });

    if (error) {
      console.error("Failed to send creator event email:", error);
    } else {
      console.log(`Creator event email sent to ${to}`);
    }
  } catch (e) {
    console.error("Email send error (creator event):", e);
  }
}
