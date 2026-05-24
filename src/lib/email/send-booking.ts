import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import { buildBookingIcs } from "./ics";
import BookingConfirmation, { getBookingConfirmationSubject } from "@/components/emails/BookingConfirmation";
import BookingCancellation, { getBookingCancellationSubject } from "@/components/emails/BookingCancellation";

interface SendBookingConfirmationParams {
  to: string;
  customerName: string;
  serviceName: string;
  scheduledAt: Date;
  creatorName: string;
  location?: string;
  bookingId?: string;
  durationMinutes?: number;
}

export async function sendBookingConfirmationEmail({
  to,
  customerName,
  serviceName,
  scheduledAt,
  creatorName,
  location,
  bookingId,
  durationMinutes,
}: SendBookingConfirmationParams): Promise<void> {
  try {
    const resend = getResend();
    const html = await renderEmailToHtml(
      createElement(BookingConfirmation, { customerName, serviceName, scheduledAt, creatorName, location })
    );

    const ics = buildBookingIcs({
      uid: `${bookingId ?? scheduledAt.getTime()}@usha.se`,
      title: serviceName,
      startsAt: scheduledAt,
      durationMinutes,
      location,
      description: `Bokning hos ${creatorName} via Usch-Ja`,
    });

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: getBookingConfirmationSubject(serviceName),
      html,
      attachments: [{ filename: "usha-bokning.ics", content: Buffer.from(ics) }],
    });

    if (error) {
      console.error("Failed to send booking confirmation email:", error);
    } else {
      console.log(`Booking confirmation email sent to ${to}`);
    }
  } catch (e) {
    console.error("Email send error (booking confirmation):", e);
  }
}

interface SendBookingCancellationParams {
  to: string;
  recipientName: string;
  serviceName: string;
  scheduledAt: Date;
}

export async function sendBookingCancellationEmail({
  to,
  recipientName,
  serviceName,
  scheduledAt,
}: SendBookingCancellationParams): Promise<void> {
  try {
    const resend = getResend();
    const html = await renderEmailToHtml(
      createElement(BookingCancellation, { recipientName, serviceName, scheduledAt })
    );

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: getBookingCancellationSubject(serviceName),
      html,
    });

    if (error) {
      console.error("Failed to send booking cancellation email:", error);
    } else {
      console.log(`Booking cancellation email sent to ${to}`);
    }
  } catch (e) {
    console.error("Email send error (booking cancellation):", e);
  }
}
