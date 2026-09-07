/**
 * Outbound email for password reset.
 *
 * Env:
 * - APP_URL — public origin for reset links (e.g. https://app.example.com)
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM — required in staging/production
 *
 * Local/dev without SMTP: reset URL is printed to the server log.
 */

export type SendPasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
};

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

function requireSmtpInDeployedEnv(): boolean {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || "").toLowerCase();
  return env === "production" || env === "staging" || env === "prod";
}

export function getAppBaseUrl(): string {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput
): Promise<{ mode: "smtp" | "log" }> {
  const { to, resetUrl, expiresInMinutes } = input;

  if (!smtpConfigured() || !process.env.SMTP_HOST) {
    if (requireSmtpInDeployedEnv()) {
      console.error(
        "[email] SMTP is not configured — password reset email cannot be sent in staging/production. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM."
      );
      throw new Error("Email delivery is not configured");
    }

    console.log(
      `[email] Password reset for ${to} (SMTP not configured — dev log only):\n${resetUrl}\n(expires in ${expiresInMinutes} minutes)`
    );
    return { mode: "log" };
  }

  // Dynamic import so local/dev without nodemailer still works if we keep it optional.
  // nodemailer is a dependency for staging/production.
  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Reset your Spark & Clean password",
    text: [
      "Reset your Spark & Clean password",
      "",
      `Use this link within ${expiresInMinutes} minutes:`,
      resetUrl,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>Reset your Spark &amp; Clean password</p>
      <p><a href="${resetUrl}">Choose a new password</a></p>
      <p style="color:#6b7280;font-size:13px">This link expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.</p>
    `,
  });

  return { mode: "smtp" };
}
