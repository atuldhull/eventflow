import nodemailer from "nodemailer"
import { Resend } from "resend"
import { reportError } from "@/lib/error-reporting"
import { htmlToText } from "@/lib/html-to-text"

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
}

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

function getTransporter() {
  if (process.env.RESEND_API_KEY) {
    return null // Use Resend in production
  }

  const port = parseInt(process.env.SMTP_PORT || "1025")
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port,
    // 465 is TLS from the first byte; other ports (587) upgrade with STARTTLS when offered
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  })
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<SendEmailResult> {
  if (process.env.NODE_ENV === "production" && !process.env.EMAIL_FROM) {
    console.error("EMAIL_FROM is not configured — refusing to send from Resend's shared sandbox domain in production")
    return { success: false, error: "Email sender is not configured" }
  }

  // Use Resend's test sender in development only (no domain verification needed).
  const from = process.env.EMAIL_FROM || "EventFlow <onboarding@resend.dev>"

  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text: text || htmlToText(html),
      })

      if (error) {
        console.error("Resend error:", error)
        void reportError(new Error("Email not sent (Resend): " + error.message), { where: "email", level: "warning" })
        return { success: false, error: error.message }
      }

      return { success: true, messageId: data?.id }
    }

    const transporter = getTransporter()
    if (!transporter) {
      console.error("No email transport configured")
      return { success: false, error: "No email transport configured" }
    }

    const info = await transporter.sendMail({ from, to, subject, html, text: text || htmlToText(html) })
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Email send error:", error)
    void reportError(new Error("Email not sent: " + (error instanceof Error ? error.message : String(error))), { where: "email", level: "warning" })
    return { success: false, error: "Failed to send email" }
  }
}

function emailLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" style="width:100%;max-width:480px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background-color:#09090b;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">EventFlow</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;text-align:center;background-color:#f4f4f5;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#71717a;">
                &copy; ${new Date().getFullYear()} EventFlow. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">
                You're receiving this email because you have an EventFlow account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendOTPEmail(email: string, otp: string, purpose: string): Promise<SendEmailResult> {
  const purposeText: Record<string, { subject: string; heading: string; description: string }> = {
    VERIFY_EMAIL: {
      subject: "Verify your email - EventFlow",
      heading: "Verify your email address",
      description: "Enter this code to verify your email address and complete your registration.",
    },
    LOGIN: {
      subject: "Your login code - EventFlow",
      heading: "Your login code",
      description: "Enter this code to sign in to your EventFlow account.",
    },
    RESET_PASSWORD: {
      subject: "Reset your password - EventFlow",
      heading: "Reset your password",
      description: "Enter this code to reset your password. If you didn't request this, you can safely ignore this email.",
    },
  }

  const config = purposeText[purpose] || purposeText.VERIFY_EMAIL

  const content = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#09090b;">${config.heading}</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.5;">${config.description}</p>
    <div style="text-align:center;padding:24px;background-color:#f4f4f5;border-radius:8px;margin:0 0 24px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#09090b;font-family:monospace;">${otp}</span>
    </div>
    <p style="margin:0;font-size:13px;color:#a1a1aa;text-align:center;">
      This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
    </p>`

  return sendEmail({
    to: email,
    subject: config.subject,
    html: emailLayout(content),
    text: `${config.heading}\n\nYour code: ${otp}\n\nThis code expires in 10 minutes.`,
  })
}

export async function sendWelcomeEmail(email: string, name: string): Promise<SendEmailResult> {
  const content = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#09090b;">Welcome to EventFlow!</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;line-height:1.5;">
      Hi ${name}, your account has been verified successfully. You're all set to discover and manage events.
    </p>
    <ul style="margin:0 0 24px;padding:0 0 0 20px;font-size:14px;color:#52525b;line-height:1.8;">
      <li>Browse and register for events</li>
      <li>Create and manage your own events</li>
      <li>Get certificates and track attendance</li>
    </ul>
    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/events" style="display:inline-block;padding:10px 24px;background-color:#09090b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
        Explore Events
      </a>
    </div>`

  return sendEmail({
    to: email,
    subject: "Welcome to EventFlow!",
    html: emailLayout(content),
    text: `Welcome to EventFlow!\n\nHi ${name}, your account has been verified successfully.\n\nExplore events at ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/events`,
  })
}

export async function sendPasswordResetEmail(email: string, otp: string): Promise<SendEmailResult> {
  return sendOTPEmail(email, otp, "RESET_PASSWORD")
}
