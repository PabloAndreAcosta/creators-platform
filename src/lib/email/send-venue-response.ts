import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import VenueResponse, { getVenueResponseSubject } from "@/components/emails/VenueResponse";
import { getEmailIntl } from "./i18n";
import { resolveRecipientLocale } from "@/lib/i18n/recipient";

interface Params {
  to: string;
  organiserId: string;
  organiserName: string | null;
  venueName: string;
  eventTitle: string;
  eventDate?: Date;
  confirmed: boolean;
  eventUrl: string;
}

/**
 * Lokalens ja eller nej till arrangören, på arrangörens språk. Fel loggas och
 * stoppar aldrig svaret — lokalens beslut är redan sparat, och notisen i appen
 * säger samma sak.
 */
export async function sendVenueResponseEmail(p: Params): Promise<boolean> {
  try {
    const resend = getResend();
    const { t, locale } = await getEmailIntl(await resolveRecipientLocale({ userId: p.organiserId, email: p.to }));
    const html = await renderEmailToHtml(
      createElement(VenueResponse, {
        organiserName: p.organiserName?.trim() || null,
        venueName: p.venueName,
        eventTitle: p.eventTitle,
        eventDate: p.eventDate,
        confirmed: p.confirmed,
        eventUrl: p.eventUrl,
        t,
        locale,
      })
    );
    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to: p.to,
      subject: getVenueResponseSubject(t, p.venueName, p.eventTitle, p.confirmed),
      html,
    });
    if (error) {
      console.error("Failed to send venue response email:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email send error (venue response):", e);
    return false;
  }
}
