import { NextResponse } from "next/server"
import { createHmac } from "node:crypto"
import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ColumnRow = {
  column_name: string
}

type UsuarioRow = {
  id: string
  nome: string | null
  email: string
  ativo: boolean | null
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function pickFirstExisting(candidates: string[], available: Set<string>) {
  return candidates.find((item) => available.has(item)) ?? null
}

function getResetSecret() {
  return (
    process.env.PASSWORD_RESET_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "troque-esta-chave-em-producao"
  )
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function signResetPayload(payload: string) {
  return base64UrlEncode(
    createHmac("sha256", getResetSecret()).update(payload).digest(),
  )
}

function createResetToken(email: string) {
  const payload = {
    email: email.toLowerCase(),
    exp: Date.now() + 1000 * 60 * 30,
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signResetPayload(encodedPayload)

  return `${encodedPayload}.${signature}`
}

function buildResetLink(token: string) {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"

  return `${baseUrl.replace(/\/$/, "")}/resetar-senha?token=${encodeURIComponent(token)}`
}

function buildMailFrom() {
  const fromName = normalizeText(process.env.MAIL_FROM_NAME) || "SIGAJUS"
  const fromAddress =
    normalizeText(process.env.MAIL_FROM_ADDRESS) ||
    normalizeText(process.env.MAIL_USERNAME)

  if (!fromAddress) {
    return null
  }

  return `"${fromName.replace(/"/g, "")}" <${fromAddress}>`
}

async function getUsuariosColumns() {
  const rows = await prisma.$queryRawUnsafe<ColumnRow[]>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
    ORDER BY ordinal_position
  `)

  return new Set(rows.map((row) => row.column_name))
}

async function sendResetEmail(email: string, nome: string | null, link: string) {
  const host = normalizeText(process.env.MAIL_HOST)
  const port = Number(process.env.MAIL_PORT || 587)
  const secure = String(process.env.MAIL_SECURE || "false").toLowerCase() === "true"
  const user = normalizeText(process.env.MAIL_USERNAME)
  const pass = String(process.env.MAIL_PASSWORD || "")
  const from = buildMailFrom()
  const replyTo = normalizeText(process.env.MAIL_REPLY_TO) || undefined

  if (!host || !from || !user || !pass || host.includes("seuprovedor")) {
    console.warn("[FORGOT_PASSWORD] SMTP não configurado. Link gerado:")
    console.warn(link)
    return
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  })

  const firstName = normalizeText(nome).split(" ")[0] || "usuário"

  await transporter.sendMail({
    from,
    to: email,
    replyTo,
    subject: "Redefinição de senha - SIGAJUS",
    text: [
      `Olá, ${firstName}.`,
      ``,
      `Recebemos uma solicitação para redefinir sua senha no SIGAJUS.`,
      `Use o link abaixo para criar uma nova senha:`,
      `${link}`,
      ``,
      `Esse link expira em 30 minutos.`,
      `Se você não solicitou essa alteração, ignore este e-mail.`,
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Redefinição de senha</title>
        </head>
        <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;margin:0;padding:32px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;">
                  <tr>
                    <td align="center" style="padding:0 20px 20px 20px;">
                      <div style="font-size:28px;font-weight:700;color:#0f172a;">
                        SIGAJUS
                      </div>
                      <div style="margin-top:6px;font-size:14px;color:#64748b;">
                        Sistema de Gestão de Ações Judiciais na Saúde
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 20px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 10px 30px rgba(15,23,42,0.08);overflow:hidden;">
                        <tr>
                          <td style="background:linear-gradient(135deg,#0f6fa6 0%,#1d4ed8 100%);padding:28px 32px;">
                            <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;opacity:0.95;">
                              Segurança da conta
                            </div>
                            <div style="margin-top:10px;font-size:26px;line-height:34px;font-weight:700;color:#000000;">
                              Redefinição de senha
                            </div>
                            <div style="margin-top:8px;font-size:15px;line-height:24px;color:#000000;">
                              Recebemos uma solicitação para alterar o acesso da sua conta.
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:32px;">
                            <p style="margin:0 0 16px 0;font-size:16px;line-height:26px;color:#111827;">
                              Olá, <strong>${firstName}</strong>.
                            </p>

                            <p style="margin:0 0 16px 0;font-size:15px;line-height:26px;color:#374151;">
                              Para criar uma nova senha no <strong>SIGAJUS</strong>, clique no botão abaixo:
                            </p>

                            <div style="margin:28px 0;text-align:center;">
                              <a
                                href="${link}"
                                style="display:inline-block;background:#0f6fa6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 26px;border-radius:10px;"
                              >
                                Redefinir minha senha
                              </a>
                            </div>

                            <div style="margin:0 0 18px 0;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                              <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;">
                                Importante
                              </div>
                              <div style="font-size:14px;line-height:24px;color:#475569;">
                                Este link expira em <strong>30 minutos</strong> por segurança.
                              </div>
                            </div>

                            <p style="margin:0 0 10px 0;font-size:14px;line-height:24px;color:#475569;">
                              Se o botão não funcionar, copie e cole este link no navegador:
                            </p>

                            <p style="margin:0 0 22px 0;word-break:break-word;font-size:13px;line-height:22px;color:#2563eb;">
                              <a href="${link}" style="color:#2563eb;text-decoration:underline;">${link}</a>
                            </p>

                            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

                            <p style="margin:0;font-size:13px;line-height:22px;color:#6b7280;">
                              Se você não solicitou esta alteração, ignore este e-mail. Sua senha atual continuará válida até que uma nova seja definida.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:18px 20px 0 20px;">
                      <div style="font-size:12px;line-height:20px;color:#94a3b8;">
                        Esta é uma mensagem automática do SIGAJUS.<br />
                        Não responda este e-mail se ele foi enviado por um remetente sem monitoramento.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = normalizeText(body?.email).toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Informe um e-mail válido." },
        { status: 400 },
      )
    }

    const columns = await getUsuariosColumns()

    const idCol = pickFirstExisting(["id"], columns)
    const nomeCol = pickFirstExisting(["nome"], columns)
    const emailCol = pickFirstExisting(["email"], columns)
    const ativoCol = pickFirstExisting(["ativo"], columns)

    if (!idCol || !emailCol) {
      return NextResponse.json(
        { ok: false, error: "Estrutura da tabela usuarios inválida." },
        { status: 500 },
      )
    }

    const sql = `
      SELECT
        ${quoteIdent(idCol)}::text AS id,
        ${nomeCol ? quoteIdent(nomeCol) : "NULL"} AS nome,
        ${quoteIdent(emailCol)} AS email,
        ${ativoCol ? quoteIdent(ativoCol) : "TRUE"} AS ativo
      FROM public.usuarios
      WHERE LOWER(${quoteIdent(emailCol)}) = LOWER($1)
      LIMIT 1
    `

    const users = await prisma.$queryRawUnsafe<UsuarioRow[]>(sql, email)
    const user = users[0]

    if (user && user.ativo !== false) {
      const token = createResetToken(user.email)
      const resetLink = buildResetLink(token)

      try {
        await sendResetEmail(user.email, user.nome, resetLink)
      } catch (error) {
        console.error("[FORGOT_PASSWORD_SEND_ERROR]", error)
      }
    }

    return NextResponse.json({
      ok: true,
      message:
        "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
    })
  } catch (error) {
    console.error("[FORGOT_PASSWORD_ERROR]", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao processar solicitação." },
      { status: 500 },
    )
  }
}