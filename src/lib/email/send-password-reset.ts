import { createElement } from "react";
import { getResend, getFromEmail } from "./resend";
import { renderEmailToHtml } from "./render";
import PasswordReset, { getPasswordResetSubject } from "@/components/emails/PasswordReset";
import { getEmailIntl } from "./i18n";
import { resolveRecipientLocale } from "@/lib/i18n/recipient";

/** Mejlet med länken för att välja nytt lösenord. */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
  locale,
}: {
  to: string;
  resetUrl: string;
  locale?: string | null;
}): Promise<void> {
  const resend = getResend();
  const { t, locale: l } = await getEmailIntl(await resolveRecipientLocale({ email: to, preferred: locale }));
  const html = await renderEmailToHtml(createElement(PasswordReset, { resetUrl, t, locale: l }));
  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: getPasswordResetSubject(t),
    html,
  });
  if (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}
