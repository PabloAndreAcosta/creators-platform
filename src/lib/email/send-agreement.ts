import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import AgreementEmail, { getAgreementSubject, type AgreementEmailKind } from "@/components/emails/AgreementEmail";
import { getEmailIntl } from "./i18n";
import { resolveRecipientLocale } from "@/lib/i18n/recipient";

interface Params {
  kind: AgreementEmailKind;
  to: string;
  recipientId?: string | null;
  recipientName: string;
  otherName: string;
  title: string;
  agreementId: string;
  reason?: string | null;
}

/** Avtalsmejl på mottagarens språk. Fel loggas, stoppar aldrig flödet. */
export async function sendAgreementEmail(p: Params): Promise<void> {
  try {
    const resend = getResend();
    const { t } = await getEmailIntl(await resolveRecipientLocale({ userId: p.recipientId, email: p.to }));
    const html = await renderEmailToHtml(
      createElement(AgreementEmail, {
        kind: p.kind, recipientName: p.recipientName || "", otherName: p.otherName, title: p.title, agreementId: p.agreementId, reason: p.reason, t,
      })
    );
    const { error } = await resend.emails.send({ from: getFromEmail(), to: p.to, subject: getAgreementSubject(t, p.kind, p.title), html });
    if (error) console.error("Failed to send agreement email:", error);
  } catch (e) {
    console.error("Email send error (agreement):", e);
  }
}
