import { NextRequest, NextResponse } from "next/server"
import { ensureEmailTriageTables } from "@/lib/email-triage-processing"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Row = {
  id: string
  assunto: string | null
  remetente: string | null
  recebidoEm: string | null
  pgeNet: string | null
  processo: string | null
  detectadoEm: string | null
  classificador: string | null
  regraNome: string | null
  status: string | null
  monitoramentoId: string | null
  demandaId: string | null
  osId: string | null
  osProtocolo: string | null
  corpoResumo: string | null
  erro: string | null
  metadata: unknown
  osAnexos: unknown
  processadoEm: string | null
  lidoEm: string | null
}

type CountRow = { total: string | number | bigint }

function text(value: unknown) {
  return String(value ?? "").trim()
}

function obj(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return {}
}

function arr(value: unknown) {
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

function files(row: Row) {
  const meta = obj(row.metadata)
  const movement = obj(meta.movement)
  const os = obj(meta.os)
  const all = [
    ...arr(movement.attachments),
    ...arr(os.attachments),
    ...arr(row.osAnexos),
    ...arr(meta.attachments),
  ]
  const seen = new Set<string>()
  return all.map((item) => {
    const record = obj(item)
    return {
      name: text(record.name || record.filename || record.storedName || "anexo"),
      url: text(record.url || record.relativePath || record.arquivoPath),
      size: Number(record.size || 0),
      mimeType: text(record.mimeType || record.contentType),
    }
  }).filter((item) => {
    const key = `${item.name}|${item.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return item.name || item.url
  })
}

function bodyText(row: Row) {
  const meta = obj(row.metadata)
  return text(row.corpoResumo || meta.bodyText || meta.body || obj(meta.os).bodyText)
}

export async function GET(req: NextRequest) {
  try {
    await ensureEmailTriageTables()
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1))
    const perPage = Math.max(5, Math.min(Number(req.nextUrl.searchParams.get("perPage") || 10), 50))
    const offset = (page - 1) * perPage
    const countRows = await prisma.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) AS total FROM public.judicial_email_processados`)
    const total = Number(countRows[0]?.total || 0)
    const rows = await prisma.$queryRawUnsafe<Row[]>(`
      SELECT
        ep.id::text AS id,
        ep.assunto,
        ep.remetente,
        ep.recebido_em::text AS "recebidoEm",
        ep.pge_net AS "pgeNet",
        ep.processo,
        ep.detectado_em AS "detectadoEm",
        ep.classificador,
        ep.regra_nome AS "regraNome",
        ep.status,
        ep.monitoramento_id::text AS "monitoramentoId",
        ep.demanda_id AS "demandaId",
        ep.os_id::text AS "osId",
        os.protocolo AS "osProtocolo",
        os.corpo_resumo AS "corpoResumo",
        ep.erro,
        ep.raw_metadata AS metadata,
        os.anexos AS "osAnexos",
        ep.processado_em::text AS "processadoEm",
        ep.lido_em::text AS "lidoEm"
      FROM public.judicial_email_processados ep
      LEFT JOIN public.judicial_email_os os ON os.id = ep.os_id
      ORDER BY ep.processado_em DESC, ep.id DESC
      LIMIT $1 OFFSET $2
    `, perPage, offset)

    return NextResponse.json({
      ok: true,
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      items: rows.map((row) => ({
        id: row.id,
        assunto: row.assunto || "",
        remetente: row.remetente || "",
        recebidoEm: row.recebidoEm || "",
        pgeNet: row.pgeNet || "",
        processo: row.processo || "",
        detectadoEm: row.detectadoEm || "",
        classificador: row.classificador || "",
        regraNome: row.regraNome || "",
        status: row.status || "",
        monitoramentoId: row.monitoramentoId || "",
        demandaId: row.demandaId || "",
        osId: row.osId || "",
        osProtocolo: row.osProtocolo || "",
        corpoResumo: bodyText(row),
        erro: row.erro || "",
        processadoEm: row.processadoEm || "",
        lidoEm: row.lidoEm || "",
        attachments: files(row),
      })),
    })
  } catch (error) {
    console.error("[email-integracao/historico] erro:", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao carregar histórico." }, { status: 500 })
  }
}
