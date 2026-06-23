import { prisma } from "@/lib/prisma"

type EmailTriageConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  mailbox: string
}

type MailAddress = {
  address?: string
  name?: string
}

type ParsedMailLike = {
  subject?: string
  from?: { value?: MailAddress[]; text?: string }
  date?: Date
  messageId?: string
  attachments?: Array<{ filename?: string; contentType?: string; size?: number }>
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function boolEnv(value: unknown, fallback = true) {
  const normalized = text(value).toLowerCase()
  if (["false", "0", "no", "nao", "não"].includes(normalized)) return false
  if (["true", "1", "yes", "sim"].includes(normalized)) return true
  return fallback
}

function envText(...keys: string[]) {
  for (const key of keys) {
    const value = text(process.env[key])
    if (value) return value
  }
  return ""
}

export function getEmailTriageConfig() {
  const config: EmailTriageConfig = {
    host: envText("EMAIL_TRIAGEM_HOST") || "imap.gmail.com",
    port: Number(envText("EMAIL_TRIAGEM_PORT") || 993),
    secure: boolEnv(envText("EMAIL_TRIAGEM_SECURE"), true),
    user: envText("EMAIL_TRIAGEM_USER", "MAIL_USERNAME", "MAIL_FROM_ADDRESS") || "sigajus.ses.ms@gmail.com",
    password: envText("EMAIL_TRIAGEM_PASSWORD", "MAIL_PASSWORD"),
    mailbox: envText("EMAIL_TRIAGEM_MAILBOX") || "INBOX",
  }

  return {
    ...config,
    configured: Boolean(config.host && config.port && config.user && config.password),
  }
}

export function extractEmailTriageFields(subject: string) {
  const cleanSubject = text(subject)
  const processMatches = Array.from(new Set(cleanSubject.match(/\b\d{4}\.\d{2}\.\d{6}\b/g) || []))

  const oficioMatch = cleanSubject.match(/Of[ií]cio\s*-\s*([^\[]+)/i)
  const classifier = text(oficioMatch?.[1]).replace(/[-–—]+$/g, "").trim() || "Não classificado"

  return {
    subject: cleanSubject,
    pgeNet: processMatches[0] || "",
    processo: processMatches[0] || "",
    classifier,
    allProcessNumbers: processMatches,
  }
}

async function findDemandByProcess(processNumber: string) {
  const processo = text(processNumber)
  if (!processo) return null

  const rows = await prisma.$queryRawUnsafe<Array<{ protocolo: string | null; id: string; pacienteNome: string | null }>>(
    `
      SELECT
        d.id::text AS id,
        d.protocolo,
        p.nome AS "pacienteNome"
      FROM public.demandas d
      INNER JOIN public.pacientes p ON p.id = d."pacienteId"
      WHERE d."observacoesUnidade" ILIKE $1
         OR d.protocolo ILIKE $1
      ORDER BY d."createdAt" DESC
      LIMIT 1
    `,
    `%${processo}%`,
  )

  const found = rows[0]
  if (!found) return null

  return {
    id: found.id,
    protocolo: text(found.protocolo),
    pacienteNome: text(found.pacienteNome),
  }
}

function senderText(mail: ParsedMailLike) {
  const first = mail.from?.value?.[0]
  if (first?.address) return [first.name, first.address].map(text).filter(Boolean).join(" <") + (first.name ? ">" : "")
  return text(mail.from?.text)
}

export async function testEmailTriageConnection() {
  const config = getEmailTriageConfig()

  if (!config.configured) {
    return {
      ok: false,
      error: "Configure EMAIL_TRIAGEM_PASSWORD ou MAIL_PASSWORD no .env para testar a conexão.",
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        mailbox: config.mailbox,
        configured: false,
      },
    }
  }

  const { ImapFlow } = await import("imapflow")

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(config.mailbox)
    try {
      return {
        ok: true,
        config: {
          host: config.host,
          port: config.port,
          secure: config.secure,
          user: config.user,
          mailbox: config.mailbox,
          configured: true,
        },
        mailbox: {
          exists: client.mailbox?.exists ?? 0,
          path: client.mailbox?.path ?? config.mailbox,
        },
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }
}

export async function previewEmailTriage(limit = 10) {
  const config = getEmailTriageConfig()

  if (!config.configured) {
    return {
      ok: false,
      error: "Configure EMAIL_TRIAGEM_PASSWORD ou MAIL_PASSWORD no .env para ler os e-mails.",
      items: [],
    }
  }

  const { ImapFlow } = await import("imapflow")
  const { simpleParser } = await import("mailparser")

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(config.mailbox)

    try {
      const total = client.mailbox?.exists ?? 0
      if (!total) return { ok: true, total: 0, items: [] }

      const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 25))
      const start = Math.max(1, total - safeLimit + 1)
      const range = `${start}:*`
      const items = []

      for await (const message of client.fetch(range, { envelope: true, source: true, uid: true }, { uid: false })) {
        const parsed = (await simpleParser(message.source as Buffer)) as ParsedMailLike
        const subject = text(parsed.subject || message.envelope?.subject)
        const extracted = extractEmailTriageFields(subject)
        const demand = extracted.processo ? await findDemandByProcess(extracted.processo) : null

        items.push({
          uid: message.uid,
          messageId: text(parsed.messageId),
          subject,
          from: senderText(parsed),
          date: parsed.date?.toISOString() || message.envelope?.date?.toISOString?.() || "",
          classifier: extracted.classifier,
          pgeNet: extracted.pgeNet,
          processo: extracted.processo,
          attachments: (parsed.attachments || []).map((attachment) => ({
            filename: text(attachment.filename) || "anexo",
            contentType: text(attachment.contentType),
            size: Number(attachment.size || 0),
          })),
          simulatedAction: demand
            ? {
                type: "vincular_processo",
                label: "Processo encontrado. Vincularia ao processo e criaria monitoramento.",
                demanda: demand,
              }
            : {
                type: "criar_os",
                label: "Processo não encontrado. Criaria ordem de serviço para cadastro/vinculação.",
                demanda: null,
              },
        })
      }

      return {
        ok: true,
        total,
        items: items.reverse(),
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }
}
