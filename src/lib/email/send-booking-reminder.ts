import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import { buildBookingIcs } from "./ics";
import BookingReminder, { getBookingReminderSubject } from "@/components/emails/BookingReminder";
import { getEmailIntl } from "./i18n";
import { resolveRecipientLocale } from "@/lib/i18n/recipient";

interface SendBookingReminderParams {
  to: string;
  customerName: string;
  serviceName: string;
  scheduledAt: Date;
  creatorName: string;
  location?: string;
  bookingId?: string;
  durationMinutes?: number;
  variant?: "day" | "soon";
  /** Recipient's account when they have one; guests resolve by address. */
  customerId?: string | null;
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
  variant = "day",
  customerId,
}: SendBookingReminderParams): Promise<void> {
  try {
    const resend = getResend();
    const { t, locale } = await getEmailIntl(await resolveRecipientLocale({ userId: customerId, email: to }));
    const html = await renderEmailToHtml(
      createElement(BookingReminder, { customerName, serviceName, scheduledAt, creatorName, location, variant, t, locale })
    );

    const ics = buildBookingIcs({
      uid: `${bookingId ?? scheduledAt.getTime()}@usha.se`,
      title: serviceName,
      startsAt: scheduledAt,
      durationMinutes,
      location,
      description: t("reminderIcsDescription", { creator: creatorName }),
    });

    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: getBookingReminderSubject(t, serviceName, variant),
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
