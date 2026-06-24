import { prisma } from "@/lib/prisma"
import { extractEmailTriageFields, getEmailTriageConfig } from "@/lib/email-triage-test"

type MailAddress = { address?: string; name?: string }
type ParsedMailLike = { subject?: string; text?: string; html?: string | false; from?: { value?: MailAddress[]; text?: string }; date?: Date; messageId?: string; attachments?: Array<{ filename?: string; contentType?: string; size?: number }> }
type DemandMatch = { protocolo: string | null; pacienteNome: string | null; monitoramentoId?: string | null; matchSource?: string | null }

function text(value: unknown) { return String(value ?? "").trim() }
function digits(value: unknown) { return text(value).replace(/\D/g, "") }
function stripHtml(value: unknown) {
  return text(value).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim()
}
function senderText(mail: ParsedMailLike) {
  const first = mail.from?.value?.[0]
  if (first?.address) return text(first.name) ? `${text(first.name)} <${first.address}>` : first.address
  return text(mail.from?.text)
}
function hasSeenFlag(flags: unknown) {
  if (!flags) return false
  const values = Array.isArray(flags) ? flags : Array.from(flags as Iterable<unknown>)
  return values.map((flag) => String(flag).toLowerCase()).includes("\\seen")
}

async function findDemandByProcess(processNumber: string) {
  const processo = text(processNumber)
  const processoDigits = digits(processo)
  if (!processo) return null

  const rows = await prisma.$queryRawUnsafe<DemandMatch[]>(
    `
      SELECT d.protocolo,
             COALESCE(p.nome, b.nome_paciente) AS "pacienteNome",
             b.id::text AS "monitoramentoId",
             CASE WHEN UPPER(COALESCE(pv.tipo, '')) = 'PGE_NET' THEN 'PGE.net em processos vinculados' ELSE 'Processo vinculado' END AS "matchSource"
      FROM public.judicial_processos_vinculados pv
      INNER JOIN public.judicial_monitoramento_base b ON b.id = pv.monitoramento_id
      LEFT JOIN public.demandas d ON d.id = b.demanda_id
      LEFT JOIN public.pacientes p ON p.id = COALESCE(b.paciente_id, d."pacienteId")
      WHERE COALESCE(pv.ativo, TRUE) = TRUE
        AND (pv.numero ILIKE $1 OR regexp_replace(COALESCE(pv.numero, ''), '\\D', '', 'g') = $2)
      ORDER BY b.id DESC
      LIMIT 1
    `,
    `%${processo}%`,
    processoDigits,
  ).catch(() => [] as DemandMatch[])

  return rows[0] || null
}

export async function previewAllEmailTriage() {
  const config = getEmailTriageConfig()
  if (!config.configured) return { ok: false, error: "Configure EMAIL_TRIAGEM_PASSWORD ou MAIL_PASSWORD no .env para ler os e-mails.", items: [] }

  const { ImapFlow } = await import("imapflow")
  const { simpleParser } = await import("mailparser")
  const client = new ImapFlow({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password }, logger: false })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(config.mailbox)
    try {
      const total = client.mailbox?.exists ?? 0
      if (!total) return { ok: true, total: 0, items: [] }
      const items = []
      for await (const message of client.fetch("1:*", { envelope: true, source: true, uid: true, flags: true }, { uid: false })) {
        if (hasSeenFlag(message.flags)) continue
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
          attachments: (parsed.attachments || []).map((attachment) => ({ filename: text(attachment.filename) || "anexo", contentType: text(attachment.contentType), size: Number(attachment.size || 0) })),
          simulatedAction: demand ? { type: "vincular_processo", label: demand.matchSource ? `Processo encontrado (${demand.matchSource}). Vincularia ao processo e criaria monitoramento.` : "Processo encontrado. Vincularia ao processo e criaria monitoramento.", demanda: demand } : { type: "criar_os", label: extracted.processo ? "Processo não encontrado. Criaria ordem de serviço para cadastro/vinculação." : "Nenhum processo/PGE.net detectado. Criaria ordem de serviço para análise manual.", demanda: null },
        })
      }
      return { ok: true, total, items: items.reverse() }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }
}
