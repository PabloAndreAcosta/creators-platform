const RESEND_API_URL = "https://api.resend.com/emails";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY is not set — skipping email send. Set the env var to enable email delivery."
    );
    return { success: true };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Usha <noreply@usha.se>",
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[email] Resend API error (${response.status}):`, body);
      return {
        success: false,
        error: `Resend API returned ${response.status}: ${body}`,
      };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] Failed to send email:", message);
    return { success: false, error: message };
  }
}
