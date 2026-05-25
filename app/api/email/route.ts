import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { z } from "zod"

const emailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  cc: z.union([z.string().email(), z.array(z.string().email()).min(1)]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email()).min(1)]).optional(),
  replyTo: z.string().email().optional(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  text: z.string().optional(),
})

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string") return fallback
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function normalizeRecipients(value?: string | string[]) {
  if (!value) return undefined
  return Array.isArray(value) ? value.join(", ") : value
}

function getMailConfig() {
  const host = process.env.MAIL_HOST?.trim()
  const username = process.env.MAIL_USERNAME?.trim()
  const password = process.env.MAIL_PASSWORD?.trim()
  const fromName = process.env.MAIL_FROM_NAME?.trim() || "SIS Regulação"
  const fromAddress = process.env.MAIL_FROM_ADDRESS?.trim()
  const port = Number(process.env.MAIL_PORT || 587)
  const secure = parseBoolean(process.env.MAIL_SECURE, port === 465)

  const missing = [
    !host ? "MAIL_HOST" : null,
    !username ? "MAIL_USERNAME" : null,
    !password ? "MAIL_PASSWORD" : null,
    !fromAddress ? "MAIL_FROM_ADDRESS" : null,
  ].filter(Boolean) as string[]

  return {
    isConfigured: missing.length === 0,
    missing,
    host,
    username,
    password,
    fromName,
    fromAddress,
    port,
    secure,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = emailSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos para envio de e-mail.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      )
    }

    const config = getMailConfig()

    if (!config.isConfigured) {
      return NextResponse.json(
        {
          error: "SMTP não configurado.",
          missing: config.missing,
        },
        { status: 500 },
      )
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    })

    const { to, cc, bcc, replyTo, subject, html, text } = parsed.data

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: normalizeRecipients(to),
      cc: normalizeRecipients(cc),
      bcc: normalizeRecipients(bcc),
      replyTo,
      subject,
      html,
      text,
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao enviar e-mail."

    console.error("[API /api/email] erro no envio:", error)

    return NextResponse.json(
      {
        error: "Falha ao enviar e-mail.",
        details: message,
      },
      { status: 500 },
    )
  }
}
