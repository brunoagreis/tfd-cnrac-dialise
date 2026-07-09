import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { extractEmailTriageFields, getEmailTriageConfig } from "@/lib/email-triage-test"
import { ensureEmailOsRoutingColumns, inferEmailOsModule } from "@/lib/email-os-routing"
import { pickEmailTriageAssignee } from "@/lib/email-triage-assignment"

type Attachment = { filename?: string; contentType?: string; size?: number; content?: Buffer }
type Mail = { subject?: string; text?: string; html?: string | false; messageId?: string; date?: Date; attachments?: Attachment[]; from?: { text?: string; value?: Array<{ name?: string; address?: string }> } }
type Match = { monitoramentoId: string; demandaId: string; protocolo: string; pacienteNome: string }
type Rule = { id: string | null; nome: string; users: Array<{ id: string; nome: string; email: string }> }

type Progress = {
  mailboxTotal?: number
  unreadTotal?: number
  readCount?: number
  triagedCount?: number
  linkedCount?: number
  osCount?: number
  errorCount?: number
  currentSubject?: string | null
  message?: string
}

const text = (value: unknown) => String(value ?? "").trim()
const digits = (value: unknown) => text(value).replace(/\D/g, "")
const buildId = (prefix: string) => `${prefix}${randomUUID().replace(/-/g, "")}`
const normalize = (value: unknown) => text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

function stripHtml(value: unknown) {
  return text(value)
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

function sender(mail: Mail) {
  const first = mail.from?.value?.[0]
  if (first?.address) return first.name ? `${first.name} <${first.address}>` : first.address
  return text(mail.from?.text)
}

function safeName(value: string) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 170) || "arquivo"
}

function hasSeenFlag(flags: unknown) {
  if (!flags) return false
  const values = Array.isArray(flags) ? flags : Array.from(flags as Iterable<unknown>)
  return values.map((flag) => String(flag).toLowerCase()).includes("\\seen")
}

async function updateProgress(progress: Progress) {
  await prisma.$executeRawUnsafe(
    `UPDATE public.judicial_email_triagem_status
     SET mailbox_total = COALESCE($2, mailbox_total),
         unread_total = COALESCE($3, unread_total),
         read_count = COALESCE($4, read_count),
         triaged_count = COALESCE($5, triaged_count),
         linked_count = COALESCE($6, linked_count),
         os_count = COALESCE($7, os_count),
         error_count = COALESCE($8, error_count),
         current_subject = $9,
         last_message = COALESCE($10, last_message),
         updated_at = NOW()
     WHERE id = 'default'`,
    "default",
    progress.mailboxTotal ?? null,
    progress.unreadTotal ?? null,
    progress.readCount ?? null,
    progress.triagedCount ?? null,
    progress.linkedCount ?? null,
    progress.osCount ?? null,
    progress.errorCount ?? null,
    progress.currentSubject ?? null,
    progress.message ?? null,
  ).catch(() => undefined)
}

async function processed(messageId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string | null }>>(`SELECT id::text AS id, status FROM public.judicial_email_processados WHERE message_id = $1 LIMIT 1`, messageId)
  return rows[0] || null
}

async function findMatch(number: string): Promise<Match | null> {
  const n = text(number)
  if (!n) return null
  const d = digits(n)
  const linked = await prisma.$queryRawUnsafe<Match[]>(`SELECT b.id::text AS "monitoramentoId", COALESCE(b.demanda_id::text, d.id::text, '') AS "demandaId", COALESCE(d.protocolo, b.ficha_core, b.id::text) AS protocolo, COALESCE(p.nome, b.nome_paciente, '') AS "pacienteNome" FROM public.judicial_processos_vinculados pv INNER JOIN public.judicial_monitoramento_base b ON b.id = pv.monitoramento_id LEFT JOIN public.demandas d ON d.id = b.demanda_id LEFT JOIN public.pacientes p ON p.id = COALESCE(b.paciente_id, d."pacienteId") WHERE COALESCE(pv.ativo, TRUE) = TRUE AND (pv.numero ILIKE $1 OR regexp_replace(COALESCE(pv.numero, ''), '\\D', '', 'g') = $2) ORDER BY b.id DESC LIMIT 1`, `%${n}%`, d).catch(() => [] as Match[])
  if (linked[0]) return linked[0]
  const rows = await prisma.$queryRawUnsafe<Match[]>(`SELECT b.id::text AS "monitoramentoId", d.id::text AS "demandaId", d.protocolo, COALESCE(p.nome, b.nome_paciente, '') AS "pacienteNome" FROM public.demandas d LEFT JOIN public.judicial_monitoramento_base b ON b.demanda_id = d.id LEFT JOIN public.pacientes p ON p.id = d."pacienteId" WHERE d.protocolo ILIKE $1 OR d."observacoesUnidade" ILIKE $1 OR regexp_replace(COALESCE(d."observacoesUnidade", ''), '\\D', '', 'g') LIKE $2 ORDER BY d."createdAt" DESC LIMIT 1`, `%${n}%`, `%${d}%`).catch(() => [] as Match[])
  return rows[0] || null
}

async function matchRule(subject: string, body: string, classifier: string): Promise<Rule> {
  const rules = await prisma.$queryRawUnsafe<Array<{ id: string; nome: string; palavras: unknown }>>(`SELECT id::text AS id, nome, palavras_chave AS palavras FROM public.judicial_email_regras WHERE ativo = TRUE AND deleted_at IS NULL ORDER BY ordem ASC, nome ASC`).catch(() => prisma.$queryRawUnsafe<Array<{ id: string; nome: string; palavras: unknown }>>(`SELECT id::text AS id, nome, palavras_chave AS palavras FROM public.judicial_email_regras WHERE ativo = TRUE ORDER BY ordem ASC, nome ASC`))
  const haystack = normalize(`${subject} ${body} ${classifier}`)
  for (const rule of rules) {
    const words = Array.isArray(rule.palavras) ? rule.palavras.map(text).filter(Boolean) : []
    if (!words.some((word) => haystack.includes(normalize(word)))) continue
    const users = await prisma.$queryRawUnsafe<Array<{ id: string; nome: string; email: string }>>(`SELECT usuario_id AS id, usuario_nome AS nome, COALESCE(usuario_email, '') AS email FROM public.judicial_email_regra_usuarios WHERE regra_id = $1::bigint AND ativo = TRUE ORDER BY usuario_nome ASC`, rule.id)
    return { id: rule.id, nome: rule.nome, users: users.map((user) => ({ id: text(user.id), nome: text(user.nome), email: text(user.email) })) }
  }
  return { id: null, nome: classifier || "Não classificado", users: [] }
}

async function saveFiles(files: Attachment[], protocolo: string, demandaId?: string, emailId?: string) {
  const folder = safeName(protocolo || "email")
  const relDir = path.posix.join("/uploads", "email-triagem", folder)
  const absDir = path.join(process.cwd(), "public", "uploads", "email-triagem", folder)
  await mkdir(absDir, { recursive: true })
  const saved = []
  for (const file of files || []) {
    const name = text(file.filename) || "oficio-email.pdf"
    const stored = `${Date.now()}_${randomUUID().replace(/-/g, "")}_${safeName(name)}`
    const rel = path.posix.join(relDir, stored)
    const buffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content || [])
    await writeFile(path.join(absDir, stored), buffer)
    const item = { id: buildId("email_att_"), name, url: rel, relativePath: rel, storedName: stored, mimeType: text(file.contentType) || "application/octet-stream", size: Number(file.size || buffer.length || 0), source: "email" }
    saved.push(item)
    if (demandaId) {
      await prisma.$executeRawUnsafe(`INSERT INTO public.anexos (id, "demandaId", nome, tipo, tamanho, categoria, descricao, "criadoPor", "criadoPorNome", "createdAt", "arquivoNomeOriginal", "arquivoPath", "mimeType") VALUES ($1, $2, $3, $4, $5, 'oficio', $6, 'sistema-email', 'Integração de e-mail', NOW(), $3, $7, $4)`, buildId("anx_"), demandaId, name, item.mimeType, item.size, `Ofício recebido por e-mail${emailId ? ` #${emailId}` : ""}.`, rel).catch(() => undefined)
    }
  }
  return saved
}

async function saveProcessed(p: { uid: string; messageId: string; subject: string; from: string; date: string; fields: any; rule: Rule; status: string; match?: Match | null; osId?: string | null; error?: string; metadata?: unknown; read?: boolean }) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`INSERT INTO public.judicial_email_processados (message_uid, message_id, assunto, remetente, recebido_em, pge_net, processo, detectado_em, classificador, regra_id, regra_nome, status, monitoramento_id, demanda_id, os_id, erro, raw_metadata, processado_em, lido_em, created_at, updated_at) VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9,$10::bigint,$11,$12,$13::bigint,$14,$15::bigint,$16,$17::jsonb,NOW(),CASE WHEN $18::boolean THEN NOW() ELSE NULL END,NOW(),NOW()) ON CONFLICT (message_id) WHERE message_id IS NOT NULL AND message_id <> '' DO UPDATE SET status=EXCLUDED.status, monitoramento_id=EXCLUDED.monitoramento_id, demanda_id=EXCLUDED.demanda_id, os_id=EXCLUDED.os_id, erro=EXCLUDED.erro, raw_metadata=EXCLUDED.raw_metadata, lido_em=COALESCE(EXCLUDED.lido_em, public.judicial_email_processados.lido_em), updated_at=NOW() RETURNING id::text AS id`, p.uid, p.messageId, p.subject, p.from, p.date, p.fields.pgeNet || null, p.fields.processo || null, p.fields.detectedIn || null, p.fields.classifier || null, p.rule.id || null, p.rule.nome || null, p.status, p.match?.monitoramentoId || null, p.match?.demandaId || null, p.osId || null, p.error || null, JSON.stringify(p.metadata || {}), Boolean(p.read))
  return rows[0]?.id || ""
}

async function markSeen(client: any, uid: unknown) {
  await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true })
}

async function finalizeMessage(client: any, uid: unknown) {
  await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => undefined)
  const fn = client.messageDelete
  if (typeof fn === "function") await fn.call(client, String(uid), { uid: true }).catch(() => undefined)
}

export async function processUnreadEmailTriageV2(limit = 5000) {
  await ensureEmailOsRoutingColumns()
  const config = getEmailTriageConfig()
  if (!config.configured) return { ok: false, error: "Configuração de e-mail incompleta.", processed: 0, items: [] }

  const { ImapFlow } = await import("imapflow")
  const { simpleParser } = await import("mailparser")
  const client = new ImapFlow({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password }, logger: false })
  const items: any[] = []
  let mailboxTotal = 0
  let unreadTotal = 0
  let readCount = 0
  let triagedCount = 0
  let linkedCount = 0
  let osCount = 0
  let errorCount = 0

  const publish = (message?: string, currentSubject?: string | null) => updateProgress({ mailboxTotal, unreadTotal, readCount, triagedCount, linkedCount, osCount, errorCount, currentSubject: currentSubject ?? null, message })

  try {
    await publish("Conectando na caixa de e-mail")
    await client.connect()
    const lock = await client.getMailboxLock(config.mailbox)
    try {
      mailboxTotal = Number(client.mailbox?.exists || 0)
      if (!mailboxTotal) {
        await publish("Caixa vazia: nenhum e-mail na INBOX")
        return { ok: true, processed: 0, items, total: 0, mailboxTotal, unreadTotal, readCount, triagedCount, linkedCount, osCount, errorCount }
      }

      const metas: Array<{ uid: string; seen: boolean }> = []
      for await (const meta of client.fetch("1:*", { uid: true, flags: true }, { uid: false })) {
        const uid = text(meta.uid)
        if (uid) metas.push({ uid, seen: hasSeenFlag(meta.flags) })
      }

      const safeLimit = Math.max(1, Math.min(Number(limit) || metas.length, metas.length))
      const candidates = metas.slice(0, safeLimit)
      unreadTotal = candidates.filter((item) => !item.seen).length || candidates.length
      await publish(`Identificados ${candidates.length} e-mail(s) para triagem na INBOX`)

      for (const candidate of candidates) {
        const uid = candidate.uid
        let subject = "E-mail sem assunto"
        try {
          await markSeen(client, uid)
          readCount += 1
          await publish(`Marcado como lido ${readCount}/${candidates.length}`)

          const msg: any = await client.fetchOne(uid, { envelope: true, source: true, uid: true }, { uid: true })
          if (!msg?.source) throw new Error("Não foi possível baixar o conteúdo do e-mail.")

          const mail = (await simpleParser(msg.source as Buffer)) as Mail
          subject = text(mail.subject || msg.envelope?.subject) || "E-mail sem assunto"
          await publish(`Triando: ${subject}`, subject)

          const body = text(mail.text) || stripHtml(mail.html)
          const bodyShort = body.slice(0, 10000)
          const messageId = text(mail.messageId || `${config.user}:${uid}`)
          const old = await processed(messageId)
          if (old && ["VINCULADO", "OS_CRIADA", "ERRO_LEITURA"].includes(text(old.status).toUpperCase())) {
            await finalizeMessage(client, uid)
            triagedCount += 1
            items.push({ uid, subject, status: "IGNORADO_PROCESSADO" })
            await publish(`E-mail já processado removido: ${triagedCount}/${candidates.length}`, subject)
            continue
          }

          const fields = extractEmailTriageFields(subject, body)
          const rule = await matchRule(subject, body, fields.classifier)
          const responsible = await pickEmailTriageAssignee(rule.id, rule.users)
          const match = fields.processo ? await findMatch(fields.processo) : null
          const from = sender(mail)
          const date = mail.date?.toISOString() || msg.envelope?.date?.toISOString?.() || new Date().toISOString()
          const files = mail.attachments || []
          const emailId = await saveProcessed({ uid, messageId, subject, from, date, fields, rule, status: "EM_PROCESSAMENTO", match, metadata: { bodyText: bodyShort, attachments: files.map((file) => ({ filename: file.filename, contentType: file.contentType, size: file.size })) } })

          if (match?.monitoramentoId) {
            const saved = await saveFiles(files, match.protocolo || fields.processo, match.demandaId, emailId)
            await prisma.$executeRawUnsafe(`INSERT INTO public.judicial_movimentacoes (id, monitoramento_id, demanda_id, type, description, attachments, created_by, created_by_name, created_at) VALUES ($1, $2::bigint, $3, 'monitoramento', $4, $5::jsonb, 'sistema-email', 'Integração de e-mail', NOW())`, `jmov_email_${randomUUID()}`, match.monitoramentoId, match.demandaId || null, [`E-MAIL AUTOMÁTICO IDENTIFICADO`, `Assunto: ${subject}`, `Remetente: ${from}`, `PGE.net/Processo: ${fields.processo || fields.pgeNet || ""}`, `OS criada: não, processo localizado`, `Responsável direcionado: não definido`, `Corpo do e-mail: ${body.slice(0, 4000)}`, `Anexos: ${saved.map((file) => file.name).join(" | ") || "nenhum"}`].join("\n"), JSON.stringify(saved))
            await prisma.$executeRawUnsafe(`UPDATE public.judicial_monitoramento_base SET status_monitoramento_atual='ATRIBUIDO_EMAIL', motivo_proximo_monitoramento='EMAIL_RECEBIDO', updated_at=NOW() WHERE id=$1::bigint`, match.monitoramentoId)
            // Atribuição automática por e-mail desativada: responsável deve ser definido manualmente pelo administrador.
            await saveProcessed({ uid, messageId, subject, from, date, fields, rule, status: "VINCULADO", match, metadata: { bodyText: bodyShort, responsible: null, movement: { attachments: saved }, attachments: saved }, read: true })
            linkedCount += 1
            items.push({ uid, subject, status: "VINCULADO", found: true, responsible: null })
          } else {
            const modulo = inferEmailOsModule(subject, fields.classifier)
            const saved = await saveFiles(files, `OS-${uid}`)
            const osRows = await prisma.$queryRawUnsafe<Array<{ id: string; protocolo: string }>>(`INSERT INTO public.judicial_email_os (protocolo, assunto, remetente, recebido_em, pge_net, processo, detectado_em, classificador, regra_id, regra_nome, corpo_resumo, anexos, status, modulo_destino, responsavel_id, responsavel_nome, responsavel_email, created_at, updated_at) VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8,$9::bigint,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,NOW(),NOW()) RETURNING id::text AS id, protocolo`, `OS-EMAIL-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`, subject, from, date, fields.pgeNet || null, fields.processo || null, fields.detectedIn || null, fields.classifier || null, rule.id || null, rule.nome || null, bodyShort, JSON.stringify(saved), "AGUARDANDO_CADASTRO", modulo, null, null, null)
            await saveProcessed({ uid, messageId, subject, from, date, fields, rule, status: "OS_CRIADA", match: null, osId: osRows[0]?.id, metadata: { bodyText: bodyShort, responsible: null, os: { attachments: saved, protocolo: osRows[0]?.protocolo }, attachments: saved }, read: true })
            osCount += 1
            items.push({ uid, subject, status: "OS_CRIADA", found: false, os: osRows[0], responsible: null })
          }

          await finalizeMessage(client, uid)
          triagedCount += 1
          await publish(`Triagem em andamento: ${triagedCount}/${candidates.length}`, subject)
        } catch (error) {
          await saveProcessed({ uid, messageId: `${config.user}:${uid}`, subject, from: "", date: new Date().toISOString(), fields: {}, rule: { id: null, nome: "Erro", users: [] }, status: "ERRO", error: error instanceof Error ? error.message : String(error), read: true })
          await finalizeMessage(client, uid)
          errorCount += 1
          triagedCount += 1
          items.push({ uid, subject, status: "ERRO", error: error instanceof Error ? error.message : String(error) })
          await publish(`Erro registrado: ${triagedCount}/${candidates.length}`, subject)
        }
      }

      await publish(`Finalizado: ${triagedCount} e-mail(s) triado(s)`, null)
      return { ok: true, processed: items.length, items, total: mailboxTotal, mailboxTotal, unreadTotal, readCount, triagedCount, linkedCount, osCount, errorCount }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }
}
