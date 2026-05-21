import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import { buildBookingIcs } from "./ics";
import BookingReminder, { getBookingReminderSubject } from "@/components/emails/BookingReminder";

interface SendBookingReminderParams {
  to: string;
  customerName: string;
  serviceName: string;
  scheduledAt: Date;
  creatorName: string;
  location?: string;
  bookingId?: string;
  durationMinutes?: number;
}

export async function sendBookingReminderEmail({
  to,
  customerName,
  serviceName,
  scheduledAt,
  creatorName,
  location,
  bookingId,
  durationMinutes,
}: SendBookingReminderParams): Promise<void> {
  try {
    const resend = getResend();
    const html = await renderEmailToHtml(
      createElement(BookingReminder, { customerName, serviceName, scheduledAt, creatorName, location })
    );

    const ics = buildBookingIcs({
      uid: `${bookingId ?? scheduledAt.getTime()}@usha.se`,
      title: serviceName,
      startsAt: scheduledAt,
      durationMinutes,
      location,
      description: `Bokning hos ${creatorName} via Usha`,
    });

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: getBookingReminderSubject(serviceName),
      html,
      attachments: [{ filename: "usha-bokning.ics", content: Buffer.from(ics) }],
    });

    if (error) {
      console.error("Failed to send booking reminder email:", error);
    } else {
      console.log(`Booking reminder email sent to ${to}`);
    }
  } catch (e) {
    console.error("Email send error (booking reminder):", e);
  }
}
