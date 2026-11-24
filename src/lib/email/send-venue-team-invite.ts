import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import VenueTeamInvite, { getVenueTeamInviteSubject } from "@/components/emails/VenueTeamInvite";
import { getEmailIntl } from "./i18n";
import { resolveRecipientLocale } from "@/lib/i18n/recipient";
import type { VenueCapability } from "@/lib/venues/members";

interface Params {
  to: string;
  recipientId?: string | null;
  recipientName?: string | null;
  venueName: string;
  capabilities: VenueCapability[];
  token: string;
}

/**
 * Inbjudan till lokalteamet, på mottagarens språk.
 *
 * Returnerar om mejlet gick iväg, så att ägaren får veta när hen måste dela
 * länken själv. Fel loggas och stoppar aldrig inbjudan — raden finns redan,
 * och länken går att kopiera från teamsidan.
 */
export async function sendVenueTeamInviteEmail(p: Params): Promise<boolean> {
  try {
    const resend = getResend();
    const { t } = await getEmailIntl(await resolveRecipientLocale({ userId: p.recipientId, email: p.to }));
    const html = await renderEmailToHtml(
      createElement(VenueTeamInvite, {
        venueName: p.venueName,
        recipientName: p.recipientName?.trim() || null,
        capabilities: p.capabilities,
        token: p.token,
        t,
      })
    );
    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to: p.to,
      subject: getVenueTeamInviteSubject(t, p.venueName),
      html,
    });
    if (error) {
      console.error("Failed to send venue team invite:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email send error (venue team invite):", e);
    return false;
  }
}
