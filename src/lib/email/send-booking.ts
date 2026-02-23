import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import BookingConfirmation, { getBookingConfirmationSubject } from "@/components/emails/BookingConfirmation";
import BookingCancellation, { getBookingCancellationSubject } from "@/components/emails/BookingCancellation";

interface SendBookingConfirmationParams {
  to: string;
  customerName: string;
  serviceName: string;
  scheduledAt: Date;
  creatorName: string;
  location?: string;
}

export async function sendBookingConfirmationEmail({
  to,
  customerName,
  serviceName,
  scheduledAt,
  creatorName,
  location,
}: SendBookingConfirmationParams): Promise<void> {
  try {
    const resend = getResend();
    const html = renderEmailToHtml(
      createElement(BookingConfirmation, { customerName, serviceName, scheduledAt, creatorName, location })
    );

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: getBookingConfirmationSubject(serviceName),
      html,
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
    const html = renderEmailToHtml(
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
