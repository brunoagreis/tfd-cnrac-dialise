import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"

type MunicipalityContactRow = {
  municipalityName: string | null
  emails: unknown
}

type TemplateRow = {
  subject: string | null
  body: string | null
}

type DemandNotificationInput = {
  module: "tfd" | "cnrac" | "hemodialise" | "judicial" | "pre_judicial"
  protocolo: string
  pacienteNome: string
  pacienteCpf?: string | null
  pacienteCns?: string | null
  municipio: string
  codigoSigtap?: string | null
  descricaoSigtap?: string | null
  cid10?: string | null
  especialidade?: string | null
  subespecialidade?: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeModule(value: string) {
  return text(value).toLowerCase().replace(/\s+/g, "_").replace("-", "_")
}

function normalizeEmails(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean)
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((item) => text(item)).filter(Boolean)
    } catch {
      return value.split(/[;,]/).map((item) => text(item)).filter(Boolean)
    }
  }
  return []
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string") return fallback
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function replaceTokens(template: string, input: DemandNotificationInput) {
  const values: Record<string, string> = {
    protocolo: input.protocolo,
    modulo: input.module.toUpperCase(),
    paciente_nome: input.pacienteNome,
    paciente_cpf: input.pacienteCpf || "",
    paciente_cns: input.pacienteCns || "",
    municipio: input.municipio,
    sigtap: input.codigoSigtap || "",
    sigtap_descricao: input.descricaoSigtap || "",
    cid: input.cid10 || "",
    especialidade: input.especialidade || "",
    subespecialidade: input.subespecialidade || "",
  }

  return template.replace(/\$([a-zA-Z0-9_]+)/g, (_match, key) => values[String(key)] ?? "")
}

async function ensureEmailDispatchColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.admin_judicial_modelos_email
      ADD COLUMN IF NOT EXISTS modulo_disparo TEXT
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.admin_judicial_modelos_email
      ADD COLUMN IF NOT EXISTS disparo_automatico BOOLEAN NOT NULL DEFAULT FALSE
  `)
}

function getMailConfig() {
  const host = process.env.MAIL_HOST?.trim()
  const username = process.env.MAIL_USERNAME?.trim()
  const password = process.env.MAIL_PASSWORD?.trim()
  const fromName = process.env.MAIL_FROM_NAME?.trim() || "SIGAJUS"
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

export async function sendMunicipalityDemandNotification(input: DemandNotificationInput) {
  try {
    await ensureEmailDispatchColumns()

    const municipio = text(input.municipio)
    if (!municipio) return { ok: false, skipped: true, reason: "Município não informado." }

    const [contact] = await prisma.$queryRawUnsafe<MunicipalityContactRow[]>(
      `
        SELECT municipio_nome AS "municipalityName", emails
        FROM public.admin_judicial_municipios_contatos
        WHERE LOWER(TRIM(municipio_nome)) = LOWER(TRIM($1))
        LIMIT 1
      `,
      municipio,
    )

    const recipients = normalizeEmails(contact?.emails)
    if (recipients.length === 0) {
      return { ok: false, skipped: true, reason: "Município sem e-mail cadastrado." }
    }

    const [template] = await prisma.$queryRawUnsafe<TemplateRow[]>(
      `
        SELECT assunto AS subject, corpo_html AS body
        FROM public.admin_judicial_modelos_email
        WHERE disparo_automatico = TRUE
          AND LOWER(COALESCE(modulo_disparo, '')) = LOWER($1)
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `,
      normalizeModule(input.module),
    )

    if (!template?.subject || !template?.body) {
      return { ok: false, skipped: true, reason: "Modelo de e-mail automático não configurado para o módulo." }
    }

    const config = getMailConfig()
    if (!config.isConfigured) {
      return { ok: false, skipped: true, reason: `SMTP não configurado: ${config.missing.join(", ")}` }
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

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: recipients.join(", "),
      subject: replaceTokens(template.subject, input),
      html: replaceTokens(template.body, input),
    })

    return { ok: true, skipped: false, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected }
  } catch (error) {
    console.error("SEND_MUNICIPALITY_DEMAND_NOTIFICATION_ERROR", error)
    return { ok: false, skipped: true, reason: error instanceof Error ? error.message : "Erro ao enviar e-mail." }
  }
}
