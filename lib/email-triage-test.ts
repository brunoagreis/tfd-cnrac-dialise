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
  text?: string
  html?: string | false
  from?: { value?: MailAddress[]; text?: string }
  date?: Date
  messageId?: string
  attachments?: Array<{ filename?: string; contentType?: string; size?: number }>
}

type DemandMatch = {
  id: string
  protocolo: string | null
  pacienteNome: string | null
  monitoramentoId?: string | null
  matchSource?: string | null
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

function onlyDigits(value: unknown) {
  return text(value).replace(/\D/g, "")
}

function stripHtml(value: unknown) {
  return text(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
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

export function extractEmailTriageFields(subject: string, body = "") {
  const cleanSubject = text(subject)
  const cleanBody = text(body)
  const combined = [cleanSubject, cleanBody].filter(Boolean).join("\n")

  const subjectMatches = Array.from(new Set(cleanSubject.match(/\b\d{4}\.\d{2}\.\d{6}\b/g) || []))
  const bodyMatches = Array.from(new Set(cleanBody.match(/\b\d{4}\.\d{2}\.\d{6}\b/g) || []))
  const allMatches = Array.from(new Set(combined.match(/\b\d{4}\.\d{2}\.\d{6}\b/g) || []))
  const detected = subjectMatches[0] || bodyMatches[0] || allMatches[0] || ""

  const oficioMatch = cleanSubject.match(/Of[ií]cio\s*-\s*([^\[]+)/i)
  const classifier = text(oficioMatch?.[1]).replace(/[-–—]+$/g, "").trim() || "Não classificado"

  return {
    subject: cleanSubject,
    pgeNet: detected,
    processo: detected,
    classifier,
    detectedIn: subjectMatches.length ? "assunto" : bodyMatches.length ? "corpo" : "não detectado",
    allProcessNumbers: allMatches,
  }
}

async function findDemandByProcess(processNumber: string) {
  const processo = text(processNumber)
  const processoDigits = onlyDigits(processo)
  if (!processo) return null

  const linkedRows = await prisma.$queryRawUnsafe<DemandMatch[]>(
    `
      SELECT
        COALESCE(d.id::text, b.demanda_id::text, b.origem_registro_id::text, b.id::text) AS id,
        d.protocolo,
        COALESCE(p.nome, b.nome_paciente) AS "pacienteNome",
        b.id::text AS "monitoramentoId",
        CASE
          WHEN UPPER(COALESCE(pv.tipo, '')) = 'PGE_NET' THEN 'PGE.net em processos vinculados'
          ELSE 'Processo vinculado'
        END AS "matchSource"
      FROM public.judicial_processos_vinculados pv
      INNER JOIN public.judicial_monitoramento_base b
        ON b.id = pv.monitoramento_id
      LEFT JOIN public.demandas d
        ON d.id = b.demanda_id
      LEFT JOIN public.pacientes p
        ON p.id = COALESCE(b.paciente_id, d."pacienteId")
      WHERE COALESCE(pv.ativo, TRUE) = TRUE
        AND (
          pv.numero ILIKE $1
          OR regexp_replace(COALESCE(pv.numero, ''), '\\D', '', 'g') = $2
        )
      ORDER BY
        CASE WHEN UPPER(COALESCE(pv.tipo, '')) = 'PGE_NET' THEN 0 ELSE 1 END,
        b.id DESC
      LIMIT 1
    `,
    `%${processo}%`,
    processoDigits,
  ).catch(() => [] as DemandMatch[])

  const linkedFound = linkedRows[0]
  if (linkedFound) {
    return {
      id: text(linkedFound.id),
      protocolo: text(linkedFound.protocolo),
      pacienteNome: text(linkedFound.pacienteNome),
      monitoramentoId: text(linkedFound.monitoramentoId),
      matchSource: text(linkedFound.matchSource),
    }
  }

  const rows = await prisma.$queryRawUnsafe<DemandMatch[]>(
    `
      SELECT
        d.id::text AS id,
        d.protocolo,
        p.nome AS "pacienteNome",
        b.id::text AS "monitoramentoId",
        'Demanda/observações' AS "matchSource"
      FROM public.demandas d
      INNER JOIN public.pacientes p
        ON p.id = d."pacienteId"
      LEFT JOIN public.judicial_monitoramento_base b
        ON b.demanda_id = d.id
      WHERE d."observacoesUnidade" ILIKE $1
         OR d.protocolo ILIKE $1
         OR regexp_replace(COALESCE(d."observacoesUnidade", ''), '\\D', '', 'g') LIKE $3
      ORDER BY d."createdAt" DESC
      LIMIT 1
    `,
    `%${processo}%`,
    processoDigits,
    `%${processoDigits}%`,
  ).catch(() => [] as DemandMatch[])

  const found = rows[0]
  if (!found) return null

  return {
    id: text(found.id),
    protocolo: text(found.protocolo),
    pacienteNome: text(found.pacienteNome),
    monitoramentoId: text(found.monitoramentoId),
    matchSource: text(found.matchSource),
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
        const body = text(parsed.text) || stripHtml(parsed.html)
        const extracted = extractEmailTriageFields(subject, body)
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
          detectedIn: extracted.detectedIn,
          allProcessNumbers: extracted.allProcessNumbers,
          attachments: (parsed.attachments || []).map((attachment) => ({
            filename: text(attachment.filename) || "anexo",
            contentType: text(attachment.contentType),
            size: Number(attachment.size || 0),
          })),
          simulatedAction: demand
            ? {
                type: "vincular_processo",
                label: demand.matchSource
                  ? `Processo encontrado (${demand.matchSource}). Vincularia ao processo e criaria monitoramento.`
                  : "Processo encontrado. Vincularia ao processo e criaria monitoramento.",
                demanda: demand,
              }
            : {
                type: "criar_os",
                label: extracted.processo
                  ? "Processo não encontrado. Criaria ordem de serviço para cadastro/vinculação."
                  : "Nenhum processo/PGE.net detectado. Criaria ordem de serviço para análise manual.",
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
