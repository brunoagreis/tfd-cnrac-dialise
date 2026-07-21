import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { extractEmailTriageFields, getEmailTriageConfig } from "@/lib/email-triage-test"

type ParsedAttachment = { filename?: string; contentType?: string; size?: number; content?: Buffer }
type ParsedMailLike = {
  subject?: string
  text?: string
  html?: string | false
  from?: { text?: string; value?: Array<{ name?: string; address?: string }> }
  date?: Date
  messageId?: string
  attachments?: ParsedAttachment[]
}
type DemandMatch = { id: string | null; protocolo: string | null; pacienteNome: string | null; monitoramentoId: string | null; demandaId: string | null; matchSource: string | null }
type RuleMatch = { id: string | null; nome: string; palavras: string[]; users: Array<{ id: string; nome: string; email: string }> }
type ProcessedRow = { id: string; status: string | null }

function text(value: unknown) { return String(value ?? "").trim() }
function onlyDigits(value: unknown) { return text(value).replace(/\D/g, "") }
function buildId(prefix: string) { return `${prefix}${randomUUID().replace(/-/g, "")}` }
function sanitizeSegment(value: string) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180)
}
function normalizeSearch(value: unknown) { return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }
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
function senderText(mail: ParsedMailLike) {
  const first = mail.from?.value?.[0]
  if (first?.address) return text(first.name) ? `${text(first.name)} <${first.address}>` : first.address
  return text(mail.from?.text)
}
function attachmentMetadata(attachments: ParsedAttachment[]) {
  return attachments.map((item) => ({ filename: text(item.filename) || "anexo", contentType: text(item.contentType), size: Number(item.size || 0) }))
}

export async function ensureEmailTriageTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.judicial_email_regras (
      id BIGSERIAL PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      palavras_chave JSONB NOT NULL DEFAULT '[]'::jsonb,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      ordem INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.judicial_email_regra_usuarios (
      id BIGSERIAL PRIMARY KEY,
      regra_id BIGINT NOT NULL REFERENCES public.judicial_email_regras(id) ON DELETE CASCADE,
      usuario_id TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      usuario_email TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (regra_id, usuario_id)
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.judicial_email_processados (
      id BIGSERIAL PRIMARY KEY,
      message_uid TEXT,
      message_id TEXT,
      assunto TEXT,
      remetente TEXT,
      recebido_em TIMESTAMPTZ,
      pge_net TEXT,
      processo TEXT,
      detectado_em TEXT,
      classificador TEXT,
      regra_id BIGINT NULL REFERENCES public.judicial_email_regras(id) ON DELETE SET NULL,
      regra_nome TEXT,
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      monitoramento_id BIGINT,
      demanda_id TEXT,
      os_id BIGINT,
      erro TEXT,
      raw_metadata JSONB,
      processado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lido_em TIMESTAMPTZ,
      deleted_em TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_processados ADD COLUMN IF NOT EXISTS lido_em TIMESTAMPTZ`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_processados ADD COLUMN IF NOT EXISTS deleted_em TIMESTAMPTZ`)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS judicial_email_processados_message_id_uniq
    ON public.judicial_email_processados (message_id)
    WHERE message_id IS NOT NULL AND message_id <> ''
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.judicial_email_atribuicoes (
      id BIGSERIAL PRIMARY KEY,
      monitoramento_id BIGINT NOT NULL REFERENCES public.judicial_monitoramento_base(id) ON DELETE CASCADE,
      email_processado_id BIGINT REFERENCES public.judicial_email_processados(id) ON DELETE SET NULL,
      regra_id BIGINT REFERENCES public.judicial_email_regras(id) ON DELETE SET NULL,
      regra_nome TEXT,
      usuario_id TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      usuario_email TEXT,
      origem_atribuicao TEXT NOT NULL DEFAULT 'EMAIL',
      motivo TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      atribuida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      removida_em TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (monitoramento_id, email_processado_id, usuario_id)
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS judicial_email_atribuicoes_usuario_idx ON public.judicial_email_atribuicoes (usuario_id, ativo, atribuida_em DESC)`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.judicial_email_os (
      id BIGSERIAL PRIMARY KEY,
      protocolo TEXT UNIQUE,
      message_id TEXT,
      assunto TEXT NOT NULL,
      remetente TEXT,
      recebido_em TIMESTAMPTZ,
      pge_net TEXT,
      processo TEXT,
      detectado_em TEXT,
      classificador TEXT,
      regra_id BIGINT REFERENCES public.judicial_email_regras(id) ON DELETE SET NULL,
      regra_nome TEXT,
      corpo_resumo TEXT,
      anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'AGUARDANDO_CADASTRO',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function getProcessed(messageId: string) {
  if (!messageId) return null
  const rows = await prisma.$queryRawUnsafe<ProcessedRow[]>(`SELECT id::text AS id, status FROM public.judicial_email_processados WHERE message_id = $1 LIMIT 1`, messageId)
  return rows[0] ?? null
}

async function findDemandByProcess(processNumber: string): Promise<DemandMatch | null> {
  const processo = text(processNumber)
  const processoDigits = onlyDigits(processo)
  if (!processo) return null
  const linkedRows = await prisma.$queryRawUnsafe<DemandMatch[]>(`
    SELECT COALESCE(d.id::text, b.demanda_id::text, b.origem_registro_id::text, b.id::text) AS id,
           d.protocolo,
           COALESCE(p.nome, b.nome_paciente) AS "pacienteNome",
           b.id::text AS "monitoramentoId",
           b.demanda_id::text AS "demandaId",
           CASE WHEN UPPER(COALESCE(pv.tipo, '')) = 'PGE_NET' THEN 'PGE.net em processos vinculados' ELSE 'Processo vinculado' END AS "matchSource"
    FROM public.judicial_processos_vinculados pv
    INNER JOIN public.judicial_monitoramento_base b ON b.id = pv.monitoramento_id
    LEFT JOIN public.demandas d ON d.id = b.demanda_id
    LEFT JOIN public.pacientes p ON p.id = COALESCE(b.paciente_id, d."pacienteId")
    WHERE COALESCE(pv.ativo, TRUE) = TRUE
      AND (pv.numero ILIKE $1 OR regexp_replace(COALESCE(pv.numero, ''), '\\D', '', 'g') = $2)
    ORDER BY CASE WHEN UPPER(COALESCE(pv.tipo, '')) = 'PGE_NET' THEN 0 ELSE 1 END, b.id DESC
    LIMIT 1
  `, `%${processo}%`, processoDigits).catch(() => [] as DemandMatch[])
  if (linkedRows[0]) return linkedRows[0]

  const rows = await prisma.$queryRawUnsafe<DemandMatch[]>(`
    SELECT d.id::text AS id,
           d.protocolo,
           p.nome AS "pacienteNome",
           b.id::text AS "monitoramentoId",
           d.id::text AS "demandaId",
           'Demanda/observações' AS "matchSource"
    FROM public.demandas d
    INNER JOIN public.pacientes p ON p.id = d."pacienteId"
    LEFT JOIN public.judicial_monitoramento_base b ON b.demanda_id = d.id
    WHERE d."observacoesUnidade" ILIKE $1
       OR d.protocolo ILIKE $1
       OR regexp_replace(COALESCE(d."observacoesUnidade", ''), '\\D', '', 'g') LIKE $2
    ORDER BY d."createdAt" DESC
    LIMIT 1
  `, `%${processo}%`, `%${processoDigits}%`).catch(() => [] as DemandMatch[])
  return rows[0] ?? null
}


function normalizePatientNameKey(value: unknown) {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function findDemandByPatientText(subject: string, body: string): Promise<DemandMatch | null> {
  // EMAIL_TRIAGE_MATCH_BY_PATIENT_NAME
  const haystack = normalizePatientNameKey([subject, body].join(" "))
  if (haystack.length < 8) return null

  const rows = await prisma.$queryRawUnsafe<DemandMatch[]>(`
    SELECT
      d.id::text AS id,
      d.protocolo,
      p.nome AS "pacienteNome",
      b.id::text AS "monitoramentoId",
      d.id::text AS "demandaId",
      'Nome do paciente no e-mail' AS "matchSource"
    FROM public.demandas d
    INNER JOIN public.pacientes p
      ON p.id = d."pacienteId"
    LEFT JOIN public.judicial_monitoramento_base b
      ON b.demanda_id = d.id
    WHERE LOWER(COALESCE(d.modulo::text, '')) = 'judicial'
      AND LENGTH(TRIM(COALESCE(p.nome, ''))) >= 8
    ORDER BY d."createdAt" DESC
    LIMIT 800
  `).catch(() => [] as DemandMatch[])

  const matches = rows.filter((row) => {
    const nameKey = normalizePatientNameKey(row.pacienteNome)
    return nameKey.length >= 8 && haystack.includes(nameKey)
  })

  const uniqueDemandIds = new Set(matches.map((row) => text(row.demandaId || row.id)).filter(Boolean))
  if (uniqueDemandIds.size !== 1) return null

  return matches[0] || null
}

async function matchRule(subject: string, body: string, classifier: string): Promise<RuleMatch> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; nome: string; palavras: unknown }>>(`
    SELECT id::text AS id, nome, palavras_chave AS palavras
    FROM public.judicial_email_regras
    WHERE ativo = TRUE
    ORDER BY ordem ASC, nome ASC
  `)
  const haystack = normalizeSearch([subject, body, classifier].join(" \n "))
  for (const row of rows) {
    const palavras = Array.isArray(row.palavras) ? row.palavras.map(text).filter(Boolean) : []
    if (palavras.some((palavra) => haystack.includes(normalizeSearch(palavra)))) {
      const users = await prisma.$queryRawUnsafe<Array<{ id: string; nome: string; email: string }>>(`
        SELECT usuario_id AS id, usuario_nome AS nome, COALESCE(usuario_email, '') AS email
        FROM public.judicial_email_regra_usuarios
        WHERE regra_id = $1::bigint AND ativo = TRUE
        ORDER BY usuario_nome ASC
      `, row.id)
      return { id: row.id, nome: text(row.nome), palavras, users: users.map((u) => ({ id: text(u.id), nome: text(u.nome), email: text(u.email).toLowerCase() })) }
    }
  }
  return { id: null, nome: classifier || "Não classificado", palavras: [], users: [] }
}

async function saveAttachments(params: { attachments: ParsedAttachment[]; protocolo: string; demandaId?: string | null; emailProcessadoId?: string | null }) {
  const protocoloSeguro = sanitizeSegment(params.protocolo || "email")
  const pastaRelativa = path.posix.join("/uploads", "email-triagem", protocoloSeguro)
  const pastaFisica = path.join(process.cwd(), "public", "uploads", "email-triagem", protocoloSeguro)
  await mkdir(pastaFisica, { recursive: true })
  const saved = []
  for (const attachment of params.attachments || []) {
    const originalName = text(attachment.filename) || "anexo"
    const storedName = `${Date.now()}_${randomUUID().replace(/-/g, "")}_${sanitizeSegment(originalName)}`
    const relativePath = path.posix.join(pastaRelativa, storedName)
    const physicalPath = path.join(pastaFisica, storedName)
    const buffer = Buffer.isBuffer(attachment.content) ? attachment.content : Buffer.from(attachment.content || [])
    await writeFile(physicalPath, buffer)
    const record = {
      id: buildId("email_att_"),
      name: originalName,
      storedName,
      relativePath,
      url: relativePath,
      mimeType: text(attachment.contentType) || "application/octet-stream",
      size: Number(attachment.size || buffer.length || 0),
      source: "email",
      createdById: "sistema-email",
      createdByName: "Integração de e-mail",
    }
    saved.push(record)
    if (params.demandaId) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.anexos (id, "demandaId", nome, tipo, tamanho, categoria, descricao, "criadoPor", "criadoPorNome", "createdAt", "arquivoNomeOriginal", "arquivoPath", "mimeType")
        VALUES ($1, $2, $3, $4, $5, 'outros', $6, 'sistema-email', 'Integração de e-mail', NOW(), $3, $7, $4)
      `, buildId("anx_"), params.demandaId, originalName, record.mimeType, record.size, `Anexo recebido por e-mail${params.emailProcessadoId ? ` #${params.emailProcessadoId}` : ""}.`, relativePath).catch((error) => console.warn("EMAIL_TRIAGE_SAVE_ANEXO_WARNING", error))
    }
  }
  return saved
}

async function upsertProcessedEmail(params: {
  uid: string; messageId: string; subject: string; from: string; date: string; pgeNet: string; processo: string; detectedIn: string; classifier: string; rule: RuleMatch; status: string; demand: DemandMatch | null; osId?: string | null; error?: string | null; metadata?: unknown; markRead?: boolean; markDeleted?: boolean
}) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
    INSERT INTO public.judicial_email_processados (message_uid, message_id, assunto, remetente, recebido_em, pge_net, processo, detectado_em, classificador, regra_id, regra_nome, status, monitoramento_id, demanda_id, os_id, erro, raw_metadata, processado_em, lido_em, deleted_em, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10::bigint, $11, $12, $13::bigint, $14, $15::bigint, $16, $17::jsonb, NOW(), CASE WHEN $18::boolean THEN NOW() ELSE NULL END, CASE WHEN $19::boolean THEN NOW() ELSE NULL END, NOW(), NOW())
    ON CONFLICT (message_id) WHERE message_id IS NOT NULL AND message_id <> ''
    DO UPDATE SET message_uid = EXCLUDED.message_uid, assunto = EXCLUDED.assunto, remetente = EXCLUDED.remetente, recebido_em = EXCLUDED.recebido_em, pge_net = EXCLUDED.pge_net, processo = EXCLUDED.processo, detectado_em = EXCLUDED.detectado_em, classificador = EXCLUDED.classificador, regra_id = EXCLUDED.regra_id, regra_nome = EXCLUDED.regra_nome, status = EXCLUDED.status, monitoramento_id = EXCLUDED.monitoramento_id, demanda_id = EXCLUDED.demanda_id, os_id = EXCLUDED.os_id, erro = EXCLUDED.erro, raw_metadata = EXCLUDED.raw_metadata, processado_em = NOW(), lido_em = COALESCE(EXCLUDED.lido_em, public.judicial_email_processados.lido_em), deleted_em = COALESCE(EXCLUDED.deleted_em, public.judicial_email_processados.deleted_em), updated_at = NOW()
    RETURNING id::text AS id
  `,
    params.uid,
    params.messageId || null,
    params.subject,
    params.from,
    params.date || null,
    params.pgeNet || null,
    params.processo || null,
    params.detectedIn || null,
    params.classifier || null,
    params.rule.id || null,
    params.rule.nome || null,
    params.status,
    params.demand?.monitoramentoId || null,
    params.demand?.demandaId || params.demand?.id || null,
    params.osId || null,
    params.error || null,
    JSON.stringify(params.metadata || {}),
    Boolean(params.markRead),
    Boolean(params.markDeleted),
  )
  return rows[0]?.id || ""
}

async function createMovementAndAssignments(params: { emailProcessadoId: string; demand: DemandMatch; subject: string; from: string; date: string; pgeNet: string; processo: string; detectedIn: string; rule: RuleMatch; attachments: ParsedAttachment[] }) {
  const monitoramentoId = text(params.demand.monitoramentoId)
  const demandaId = text(params.demand.demandaId || params.demand.id)
  if (!monitoramentoId) throw new Error("Monitoramento não localizado para vincular o e-mail.")
  const protocolo = text(params.demand.protocolo || demandaId || monitoramentoId)
  const savedAttachments = await saveAttachments({ attachments: params.attachments, protocolo, demandaId, emailProcessadoId: params.emailProcessadoId })
  const movementId = `jmov_email_${randomUUID()}`
  const description = [
    "E-MAIL RECEBIDO AUTOMATICAMENTE",
    `Assunto: ${params.subject}`,
    `Remetente: ${params.from || "Não informado"}`,
    params.date ? `Recebido em: ${params.date}` : "",
    params.pgeNet ? `PGE.net: ${params.pgeNet}` : "",
    params.processo ? `Processo: ${params.processo}` : "",
    params.detectedIn ? `Número detectado em: ${params.detectedIn}` : "",
    params.rule.nome ? `Grupo/regra: ${params.rule.nome}` : "",
    savedAttachments.length ? `Anexos: ${savedAttachments.map((item) => item.name).join(" | ")}` : "Anexos: nenhum",
  ].filter(Boolean).join("\n")

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      INSERT INTO public.judicial_movimentacoes (id, monitoramento_id, demanda_id, type, description, attachments, created_by, created_by_name, created_by_email, created_at)
      VALUES ($1, $2::bigint, $3, 'monitoramento', $4, $5::jsonb, 'sistema-email', 'Integração de e-mail', NULL, NOW())
    `, movementId, monitoramentoId, demandaId || null, description, JSON.stringify(savedAttachments))

    for (const user of params.rule.users) {
      await tx.$executeRawUnsafe(`
        INSERT INTO public.judicial_email_atribuicoes (monitoramento_id, email_processado_id, regra_id, regra_nome, usuario_id, usuario_nome, usuario_email, origem_atribuicao, motivo, ativo, atribuida_em, created_at, updated_at)
        VALUES ($1::bigint, $2::bigint, $3::bigint, $4, $5, $6, $7, 'EMAIL', $8, TRUE, NOW(), NOW(), NOW())
        ON CONFLICT (monitoramento_id, email_processado_id, usuario_id)
        DO UPDATE SET ativo = TRUE, updated_at = NOW(), removida_em = NULL
      `, monitoramentoId, params.emailProcessadoId, params.rule.id || null, params.rule.nome, user.id, user.nome, user.email || null, `Atribuição automática por e-mail. Assunto: ${params.subject}`)
    }

    await tx.$executeRawUnsafe(`
      UPDATE public.judicial_monitoramento_base
      SET status_monitoramento_atual = 'ATRIBUIDO_EMAIL', motivo_proximo_monitoramento = 'EMAIL_RECEBIDO', data_proximo_monitoramento = NULL, prioridade_monitoramento = GREATEST(COALESCE(prioridade_monitoramento, 0), 3), updated_at = NOW()
      WHERE id = $1::bigint
    `, monitoramentoId)
  })
  return { movementId, attachments: savedAttachments, assignedUsers: params.rule.users }
}

async function createEmailOs(params: { subject: string; from: string; date: string; pgeNet: string; processo: string; detectedIn: string; classifier: string; rule: RuleMatch; body: string; attachments: ParsedAttachment[] }) {
  const protocolo = `OS-EMAIL-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`
  const savedAttachments = await saveAttachments({ attachments: params.attachments, protocolo })
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; protocolo: string }>>(`
    INSERT INTO public.judicial_email_os (protocolo, assunto, remetente, recebido_em, pge_net, processo, detectado_em, classificador, regra_id, regra_nome, corpo_resumo, anexos, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8, $9::bigint, $10, $11, $12::jsonb, 'AGUARDANDO_CADASTRO', NOW(), NOW())
    RETURNING id::text AS id, protocolo
  `, protocolo, params.subject, params.from, params.date || null, params.pgeNet || null, params.processo || null, params.detectedIn || null, params.classifier || null, params.rule.id || null, params.rule.nome || null, params.body.slice(0, 4000), JSON.stringify(savedAttachments))
  return { id: rows[0]?.id || "", protocolo: rows[0]?.protocolo || protocolo, attachments: savedAttachments }
}

async function markSeen(client: any, uid: unknown) {
  await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(async () => {
    await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true }).catch(() => undefined)
  })
}
async function markDeleted(client: any, uid: unknown) {
  await client.messageFlagsAdd(String(uid), ["\\Deleted"], { uid: true }).catch(() => undefined)
}

export async function processUnreadEmailTriage(limit = 10) {
  await ensureEmailTriageTables()
  const config = getEmailTriageConfig()
  if (!config.configured) return { ok: false, error: "Configuração de e-mail incompleta.", processed: 0, items: [] }

  const { ImapFlow } = await import("imapflow")
  const { simpleParser } = await import("mailparser")
  const client = new ImapFlow({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password }, logger: false })
  const items = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock(config.mailbox)
    try {
      const total = client.mailbox?.exists ?? 0
      if (!total) return { ok: true, processed: 0, items: [], total, unread: 0 }
      const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 25))
      let uids = await client.search({ seen: false }, { uid: true }).catch(() => [] as number[])
      if (!Array.isArray(uids)) uids = []
      const targetUids = uids.slice(0, safeLimit)
      if (!targetUids.length) return { ok: true, processed: 0, items: [], total, unread: 0 }

      for await (const message of client.fetch(targetUids, { envelope: true, source: true, uid: true, flags: true }, { uid: true })) {
        const uid = text(message.uid)
        let parsed: ParsedMailLike | null = null
        try {
          parsed = (await simpleParser(message.source as Buffer)) as ParsedMailLike
        } catch (parseError) {
          const subject = text(message.envelope?.subject) || "E-mail sem assunto"
          const messageId = `${config.user}:${uid}`
          await upsertProcessedEmail({ uid, messageId, subject, from: "", date: new Date().toISOString(), pgeNet: "", processo: "", detectedIn: "não lido", classifier: "Erro de leitura", rule: { id: null, nome: "Erro de leitura", palavras: [], users: [] }, status: "ERRO_LEITURA", demand: null, error: parseError instanceof Error ? parseError.message : String(parseError), metadata: { uid }, markRead: true, markDeleted: true })
          await markSeen(client, message.uid)
          await markDeleted(client, message.uid)
          items.push({ uid, subject, status: "ERRO_LEITURA", error: "E-mail não pôde ser lido e foi marcado para exclusão." })
          continue
        }

        const subject = text(parsed.subject || message.envelope?.subject) || "E-mail sem assunto"
        const body = text(parsed.text) || stripHtml(parsed.html)
        const from = senderText(parsed)
        const receivedAt = parsed.date?.toISOString() || message.envelope?.date?.toISOString?.() || new Date().toISOString()
        const messageId = text(parsed.messageId || `${config.user}:${uid}`)
        const existing = await getProcessed(messageId)
        if (existing && ["VINCULADO", "OS_CRIADA", "ERRO_LEITURA"].includes(text(existing.status).toUpperCase())) {
          await markSeen(client, message.uid)
          items.push({ uid, subject, status: "IGNORADO_JA_PROCESSADO", processedId: existing.id })
          continue
        }

        const extracted = extractEmailTriageFields(subject, body)
        const rule = await matchRule(subject, body, extracted.classifier)
        const demand = (extracted.processo ? await findDemandByProcess(extracted.processo) : null) ?? await findDemandByPatientText(subject, body)
        const attachments = parsed.attachments || []
        let emailProcessadoId = ""
        let status = "PROCESSADO"
        let os = null as null | { id: string; protocolo: string; attachments: unknown[] }
        let movement = null as null | { movementId: string; attachments: unknown[]; assignedUsers: unknown[] }
        let error = ""

        try {
          emailProcessadoId = await upsertProcessedEmail({ uid, messageId, subject, from, date: receivedAt, pgeNet: extracted.pgeNet, processo: extracted.processo, detectedIn: extracted.detectedIn, classifier: extracted.classifier, rule, status: "EM_PROCESSAMENTO", demand, metadata: { attachments: attachmentMetadata(attachments) } })
          if (demand?.monitoramentoId) {
            movement = await createMovementAndAssignments({ emailProcessadoId, demand, subject, from, date: receivedAt, pgeNet: extracted.pgeNet, processo: extracted.processo, detectedIn: extracted.detectedIn, rule, attachments })
            status = "VINCULADO"
          } else {
            os = await createEmailOs({ subject, from, date: receivedAt, pgeNet: extracted.pgeNet, processo: extracted.processo, detectedIn: extracted.detectedIn, classifier: extracted.classifier, rule, body, attachments })
            status = "OS_CRIADA"
          }

          await upsertProcessedEmail({ uid, messageId, subject, from, date: receivedAt, pgeNet: extracted.pgeNet, processo: extracted.processo, detectedIn: extracted.detectedIn, classifier: extracted.classifier, rule, status, demand, osId: os?.id || null, metadata: { movement, os, attachments: attachmentMetadata(attachments) }, markRead: true })
          await markSeen(client, message.uid)
        } catch (itemError) {
          error = itemError instanceof Error ? itemError.message : String(itemError)
          status = "ERRO"
          await upsertProcessedEmail({ uid, messageId, subject, from, date: receivedAt, pgeNet: extracted.pgeNet, processo: extracted.processo, detectedIn: extracted.detectedIn, classifier: extracted.classifier, rule, status, demand, error, metadata: { attachments: attachmentMetadata(attachments) }, markRead: true })
          await markSeen(client, message.uid)
        }

        items.push({ uid, subject, pgeNet: extracted.pgeNet, processo: extracted.processo, detectedIn: extracted.detectedIn, rule: rule.nome, found: Boolean(demand?.monitoramentoId), status, os, movement, error })
      }
      return { ok: true, processed: items.length, items, total, unread: targetUids.length }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }
}
