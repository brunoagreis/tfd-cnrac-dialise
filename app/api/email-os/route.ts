import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureEmailOsRoutingColumns, inferEmailOsModule, normalizeEmailOsModule } from "@/lib/email-os-routing"

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

function text(value: unknown) {
  return String(value ?? "").trim()
}

function parseArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function parseObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function files(value: unknown) {
  return parseArray(value).map((item) => {
    const record = parseObject(item)
    return {
      name: text(record.name || record.filename || record.storedName || "anexo"),
      url: text(record.url || record.relativePath || record.arquivoPath),
      mimeType: text(record.mimeType || record.contentType),
      size: Number(record.size || 0),
    }
  })
}

async function findUser(id: string) {
  const rows = await prisma.$queryRawUnsafe<UserRow[]>(
    `SELECT id::text AS id, nome, email FROM public.usuarios WHERE id::text = $1 LIMIT 1`,
    id,
  )
  return rows[0] || null
}

export async function GET(req: NextRequest) {
  try {
    await ensureEmailOsRoutingColumns()
    const moduleParam = normalizeEmailOsModule(req.nextUrl.searchParams.get("modulo"))

    const rows = await prisma.$queryRawUnsafe<OsRow[]>(`
      SELECT
        id::text AS id,
        protocolo,
        assunto,
        remetente,
        recebido_em::text AS "recebidoEm",
        pge_net AS "pgeNet",
        processo,
        classificador,
        regra_nome AS "regraNome",
        corpo_resumo AS "corpoResumo",
        anexos,
        status,
        modulo_destino AS "moduloDestino",
        responsavel_id AS "responsavelId",
        responsavel_nome AS "responsavelNome",
        responsavel_email AS "responsavelEmail",
        convertido_protocolo AS "convertidoProtocolo",
        created_at::text AS "createdAt"
      FROM public.judicial_email_os
      WHERE COALESCE(status, 'AGUARDANDO_CADASTRO') <> 'CONVERTIDA'
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `)

    const items = rows
      .map((row) => {
        const modulo = normalizeEmailOsModule(row.moduloDestino || inferEmailOsModule(row.assunto, row.classificador))
        return {
          id: row.id,
          protocolo: row.protocolo || `OS-${row.id}`,
          assunto: row.assunto || "",
          remetente: row.remetente || "",
          recebidoEm: row.recebidoEm || "",
          pgeNet: row.pgeNet || "",
          processo: row.processo || "",
          classificador: row.classificador || "",
          regraNome: row.regraNome || "",
          corpoResumo: row.corpoResumo || "",
          status: row.status || "AGUARDANDO_CADASTRO",
          moduloDestino: modulo,
          responsavelId: row.responsavelId || "",
          responsavelNome: row.responsavelNome || "",
          responsavelEmail: row.responsavelEmail || "",
          convertidoProtocolo: row.convertidoProtocolo || "",
          createdAt: row.createdAt || "",
          anexos: files(row.anexos),
        }
      })
      .filter((item) => item.moduloDestino === moduleParam)

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

    if (!osId) return NextResponse.json({ ok: false, error: "Informe a OS." }, { status: 400 })
    if (!responsavelId) return NextResponse.json({ ok: false, error: "Informe o responsável." }, { status: 400 })

    const user = await findUser(responsavelId)
    if (!user) return NextResponse.json({ ok: false, error: "Responsável não encontrado." }, { status: 404 })

    await prisma.$executeRawUnsafe(
      `
        UPDATE public.judicial_email_os
        SET modulo_destino = $2,
            responsavel_id = $3,
            responsavel_nome = $4,
            responsavel_email = $5,
            status = 'ATRIBUIDA',
            transferido_em = NOW(),
            updated_at = NOW()
        WHERE id::text = $1
      `,
      osId,
      modulo,
      user.id,
      user.nome || "Usuário",
      user.email || null,
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/email-os] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao transferir OS." }, { status: 500 })
  }
}
