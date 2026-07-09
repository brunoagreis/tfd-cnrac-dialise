import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureEmailOsRoutingColumns, inferEmailOsModule, normalizeEmailOsModule } from "@/lib/email-os-routing"

import { readServerSession } from "@/lib/security/server-session"
import { finalizeEmailMessage } from "@/lib/email-triage-mailbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type OsRow = {
  id: string
  protocolo: string | null
  assunto: string | null
  remetente: string | null
  recebidoEm: string | null
  pgeNet: string | null
  processo: string | null
  classificador: string | null
  regraNome: string | null
  corpoResumo: string | null
  anexos: unknown
  status: string | null
  moduloDestino: string | null
  responsavelId: string | null
  responsavelNome: string | null
  responsavelEmail: string | null
  convertidoProtocolo: string | null
  createdAt: string | null
}

type UserRow = { id: string; nome: string | null; email: string | null }

function text(value: unknown) { return String(value ?? "").trim() }
function parseArray(value: unknown) { if (Array.isArray(value)) return value; if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [] } catch { return [] } } return [] }
function parseObject(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function files(value: unknown) { return parseArray(value).map((item) => { const record = parseObject(item); return { name: text(record.name || record.filename || record.storedName || "anexo"), url: text(record.url || record.relativePath || record.arquivoPath), mimeType: text(record.mimeType || record.contentType), size: Number(record.size || 0) } }) }
async function findUser(id: string) { const rows = await prisma.$queryRawUnsafe<UserRow[]>(`SELECT id::text AS id, nome, email FROM public.usuarios WHERE id::text = $1 LIMIT 1`, id); return rows[0] || null }


function normalizeEmailOsAccessValue(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function isEmailOsAdminSession(session: any) {
  const role = normalizeEmailOsAccessValue(
    session?.role ??
    session?.perfil ??
    session?.tipo ??
    session?.nivel ??
    session?.perfilCodigo ??
    session?.perfil_codigo ??
    "",
  )

  return (
    role === "admin" ||
    role === "administrador" ||
    role.includes("admin") ||
    session?.isAdmin === true
  )
}

function isEmailOsResponsibleForSession(item: any, session: any) {
  if (!item || !session) return false
  if (isEmailOsAdminSession(session)) return true

  const sessionIds = [
    session?.id,
    session?.userId,
    session?.usuarioId,
    session?.usuario_id,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const sessionEmails = [
    session?.email,
    session?.login,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const sessionNames = [
    session?.nome,
    session?.name,
    session?.username,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const responsibleIds = [
    item?.responsavelId,
    item?.responsavel_id,
    item?.responsavelUsuarioId,
    item?.responsavel_usuario_id,
    item?.usuarioResponsavelId,
    item?.usuario_responsavel_id,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const responsibleEmails = [
    item?.responsavelEmail,
    item?.responsavel_email,
    item?.emailResponsavel,
    item?.email_responsavel,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const responsibleNames = [
    item?.responsavelNome,
    item?.responsavel_nome,
    item?.responsavel,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  if (responsibleIds.length) {
    return responsibleIds.some((id) => sessionIds.includes(id))
  }

  if (responsibleEmails.length) {
    return responsibleEmails.some((email) => sessionEmails.includes(email))
  }

  if (responsibleNames.length) {
    return responsibleNames.some((name) => sessionNames.includes(name))
  }

  return false
}

function filterEmailOsItemsForSession<T>(items: T[], session: any): T[] {
  if (!Array.isArray(items)) return []
  if (isEmailOsAdminSession(session)) return items
  return items.filter((item) => isEmailOsResponsibleForSession(item, session))
}

function requireEmailOsSession(req: NextRequest) {
  const session = readServerSession(req)

  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { ok: false, error: "Sessão expirada. Faça login novamente.", items: [] },
        { status: 401 },
      ),
    }
  }

  return { session, response: null }
}

export async function GET(req: NextRequest) {
  try {
    const moduleParam = normalizeEmailOsModule(req.nextUrl.searchParams.get("modulo"))
    const emailOsSessionGuard = requireEmailOsSession(req)
    if (emailOsSessionGuard.response) return emailOsSessionGuard.response
    const emailOsSession = emailOsSessionGuard.session
    const rows = await prisma.$queryRawUnsafe<OsRow[]>(`
      SELECT id::text AS id, protocolo, assunto, remetente, recebido_em::text AS "recebidoEm", pge_net AS "pgeNet", processo, classificador, regra_nome AS "regraNome", corpo_resumo AS "corpoResumo", anexos, status, modulo_destino AS "moduloDestino", responsavel_id AS "responsavelId", responsavel_nome AS "responsavelNome", responsavel_email AS "responsavelEmail", convertido_protocolo AS "convertidoProtocolo", created_at::text AS "createdAt"
      FROM public.judicial_email_os
      WHERE COALESCE(status, 'AGUARDANDO_CADASTRO') NOT IN ('CONVERTIDA', 'INATIVA')
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `).catch((error) => {
      console.error("[GET /api/email-os] erro na consulta:", error)
      return [] as OsRow[]
    })
    const items = rows.map((row) => { const modulo = normalizeEmailOsModule(row.moduloDestino || inferEmailOsModule(row.assunto, row.classificador)); return { id: row.id, protocolo: row.protocolo || `OS-${row.id}`, assunto: row.assunto || "", remetente: row.remetente || "", recebidoEm: row.recebidoEm || "", pgeNet: row.pgeNet || "", processo: row.processo || "", classificador: row.classificador || "", regraNome: row.regraNome || "", corpoResumo: row.corpoResumo || "", status: row.status || "AGUARDANDO_CADASTRO", moduloDestino: modulo, responsavelId: row.responsavelId || "", responsavelNome: row.responsavelNome || "", responsavelEmail: row.responsavelEmail || "", convertidoProtocolo: row.convertidoProtocolo || "", createdAt: row.createdAt || "", anexos: files(row.anexos) } }).filter((item) => item.moduloDestino === moduleParam)
    const authorizedItems = filterEmailOsItemsForSession(items, emailOsSession)
    return NextResponse.json({ ok: true, items: authorizedItems })
  } catch (error) {
    console.error("[GET /api/email-os] erro:", error)
    return NextResponse.json({ ok: true, items: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureEmailOsRoutingColumns()
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "").trim().toLowerCase()

    const emailOsMutationSessionGuard = requireEmailOsSession(req)
    if (emailOsMutationSessionGuard.response) return emailOsMutationSessionGuard.response
    const emailOsMutationSession = emailOsMutationSessionGuard.session

    if (["inativar", "transferir", "atribuir", "reatribuir", "alterar_responsavel"].includes(action) && !isEmailOsAdminSession(emailOsMutationSession)) {
      return NextResponse.json(
        { ok: false, error: "Apenas administradores podem transferir ou inativar ordens de serviço." },
        { status: 403 },
      )
    }

    if (action === "inativar") {
      const user = emailOsMutationSession

      const id = String(body?.id || "").trim()
      if (!id) {
        return NextResponse.json({ ok: false, error: "ID da OS obrigatório." }, { status: 400 })
      }

      await prisma.$executeRawUnsafe("UPDATE public.judicial_email_os SET status = 'INATIVA' WHERE id::text = $1", id)
      return NextResponse.json({ ok: true })
    }
    const osId = text(body?.osId)
    const modulo = normalizeEmailOsModule(body?.modulo)
    const responsavelId = text(body?.responsavelId)
    if (!responsavelId) return NextResponse.json({ ok: false, error: "Informe o responsável." }, { status: 400 })
    const user = await findUser(responsavelId)
    if (!user) return NextResponse.json({ ok: false, error: "Responsável não encontrado." }, { status: 404 })

    if (!osId && text(body?.uid)) {
      const uid = text(body?.uid)
      const messageId = text(body?.messageId || uid)
      const assunto = text(body?.subject) || "E-mail sem assunto"
      const corpoResumo = text(body?.bodyText || body?.corpoResumo || body?.body || `Criado pela prévia da integração de e-mail. UID: ${uid}`).slice(0, 10000)
      const anexos = Array.isArray(body?.attachments) ? body.attachments : []
      const protocolo = `OS-EMAIL-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; protocolo: string }>>(
        `INSERT INTO public.judicial_email_os (protocolo, message_id, assunto, remetente, recebido_em, pge_net, processo, detectado_em, classificador, corpo_resumo, anexos, status, modulo_destino, responsavel_id, responsavel_nome, responsavel_email, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9,$10,$11::jsonb,'ATRIBUIDA',$12,$13,$14,$15,NOW(),NOW())
         RETURNING id::text AS id, protocolo`,
        protocolo,
        messageId,
        assunto,
        text(body?.from),
        text(body?.date) || new Date().toISOString(),
        text(body?.pgeNet) || null,
        text(body?.processo) || null,
        text(body?.detectedIn) || null,
        text(body?.classifier) || null,
        corpoResumo,
        JSON.stringify(anexos),
        modulo,
        user.id,
        user.nome || "Usuário",
        user.email || null,
      )
      const created = rows[0]
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.judicial_email_processados (message_uid, message_id, assunto, remetente, recebido_em, pge_net, processo, detectado_em, classificador, status, os_id, raw_metadata, processado_em, lido_em, deleted_em, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9,'OS_CRIADA',$10::bigint,$11::jsonb,NOW(),NOW(),NOW(),NOW(),NOW())
         ON CONFLICT (message_id) WHERE message_id IS NOT NULL AND message_id <> '' DO UPDATE SET status='OS_CRIADA', os_id=EXCLUDED.os_id, raw_metadata=EXCLUDED.raw_metadata, lido_em=NOW(), deleted_em=NOW(), updated_at=NOW()`,
        uid,
        messageId,
        assunto,
        text(body?.from),
        text(body?.date) || new Date().toISOString(),
        text(body?.pgeNet) || null,
        text(body?.processo) || null,
        text(body?.detectedIn) || null,
        text(body?.classifier) || null,
        created?.id || null,
        JSON.stringify({ manual: true, modulo, responsavelId: user.id, bodyText: corpoResumo, attachments: anexos, os: { protocolo: created?.protocolo, attachments: anexos } }),
      )
      void finalizeEmailMessage(uid).catch((error) => console.error("[POST /api/email-os] finalizacao IMAP:", error))
      return NextResponse.json({ ok: true, os: created })
    }

    if (!osId) return NextResponse.json({ ok: false, error: "Informe a OS." }, { status: 400 })
    await prisma.$executeRawUnsafe(`UPDATE public.judicial_email_os SET modulo_destino = $2, responsavel_id = $3, responsavel_nome = $4, responsavel_email = $5, status = 'ATRIBUIDA', transferido_em = NOW(), updated_at = NOW() WHERE id::text = $1`, osId, modulo, user.id, user.nome || "Usuário", user.email || null)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/email-os] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao transferir OS." }, { status: 500 })
  }
}

