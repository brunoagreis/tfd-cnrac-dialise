import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureEmailOsRoutingColumns, inferEmailOsModule, normalizeEmailOsModule } from "@/lib/email-os-routing"
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

export async function GET(req: NextRequest) {
  try {
    await ensureEmailOsRoutingColumns()
    const moduleParam = normalizeEmailOsModule(req.nextUrl.searchParams.get("modulo"))
    const rows = await prisma.$queryRawUnsafe<OsRow[]>(`
      SELECT id::text AS id, protocolo, assunto, remetente, recebido_em::text AS "recebidoEm", pge_net AS "pgeNet", processo, classificador, regra_nome AS "regraNome", corpo_resumo AS "corpoResumo", anexos, status, modulo_destino AS "moduloDestino", responsavel_id AS "responsavelId", responsavel_nome AS "responsavelNome", responsavel_email AS "responsavelEmail", convertido_protocolo AS "convertidoProtocolo", created_at::text AS "createdAt"
      FROM public.judicial_email_os
      WHERE COALESCE(status, 'AGUARDANDO_CADASTRO') <> 'CONVERTIDA'
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `)
    const items = rows.map((row) => { const modulo = normalizeEmailOsModule(row.moduloDestino || inferEmailOsModule(row.assunto, row.classificador)); return { id: row.id, protocolo: row.protocolo || `OS-${row.id}`, assunto: row.assunto || "", remetente: row.remetente || "", recebidoEm: row.recebidoEm || "", pgeNet: row.pgeNet || "", processo: row.processo || "", classificador: row.classificador || "", regraNome: row.regraNome || "", corpoResumo: row.corpoResumo || "", status: row.status || "AGUARDANDO_CADASTRO", moduloDestino: modulo, responsavelId: row.responsavelId || "", responsavelNome: row.responsavelNome || "", responsavelEmail: row.responsavelEmail || "", convertidoProtocolo: row.convertidoProtocolo || "", createdAt: row.createdAt || "", anexos: files(row.anexos) } }).filter((item) => item.moduloDestino === moduleParam)
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error("[GET /api/email-os] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao listar OS de e-mail." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureEmailOsRoutingColumns()
    const body = await req.json().catch(() => ({}))
    const osId = text(body?.osId)
    const modulo = normalizeEmailOsModule(body?.modulo)
    const responsavelId = text(body?.responsavelId)
    if (!responsavelId) return NextResponse.json({ ok: false, error: "Informe o responsável." }, { status: 400 })
    const user = await findUser(responsavelId)
    if (!user) return NextResponse.json({ ok: false, error: "Responsável não encontrado." }, { status: 404 })

    if (!osId && text(body?.uid)) {
      const protocolo = `OS-EMAIL-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; protocolo: string }>>(
        `INSERT INTO public.judicial_email_os (protocolo, message_id, assunto, remetente, recebido_em, pge_net, processo, detectado_em, classificador, corpo_resumo, anexos, status, modulo_destino, responsavel_id, responsavel_nome, responsavel_email, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9,$10,$11::jsonb,'ATRIBUIDA',$12,$13,$14,$15,NOW(),NOW())
         RETURNING id::text AS id, protocolo`,
        protocolo,
        text(body?.messageId || body?.uid),
        text(body?.subject) || "E-mail sem assunto",
        text(body?.from),
        text(body?.date) || new Date().toISOString(),
        text(body?.pgeNet) || null,
        text(body?.processo) || null,
        text(body?.detectedIn) || null,
        text(body?.classifier) || null,
        `Criado pela prévia da integração de e-mail. UID: ${text(body?.uid)}`,
        JSON.stringify(Array.isArray(body?.attachments) ? body.attachments : []),
        modulo,
        user.id,
        user.nome || "Usuário",
        user.email || null,
      )
      await finalizeEmailMessage(body?.uid).catch(() => undefined)
      return NextResponse.json({ ok: true, os: rows[0] })
    }

    if (!osId) return NextResponse.json({ ok: false, error: "Informe a OS." }, { status: 400 })
    await prisma.$executeRawUnsafe(`UPDATE public.judicial_email_os SET modulo_destino = $2, responsavel_id = $3, responsavel_nome = $4, responsavel_email = $5, status = 'ATRIBUIDA', transferido_em = NOW(), updated_at = NOW() WHERE id::text = $1`, osId, modulo, user.id, user.nome || "Usuário", user.email || null)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/email-os] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao transferir OS." }, { status: 500 })
  }
}
