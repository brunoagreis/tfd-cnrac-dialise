import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminRequest } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReportRow = {
  source: string
  id: string
  monitoramentoId: string | null
  demandaId: string | null
  protocolo: string | null
  type: string | null
  pacienteNome: string | null
  municipio: string | null
  valorEstado: string | number | null
  valorMunicipio: string | number | null
  description: string | null
  reason: string | null
  createdByName: string | null
  createdAt: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function money(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function statusLabel(value: unknown) {
  const normalized = text(value).toLowerCase()
  if (normalized === "bloqueio") return "Bloqueio"
  if (normalized === "sequestro") return "Sequestro"
  return text(value) || "Não informado"
}

export async function GET(req: Request) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const rows = await prisma.$queryRawUnsafe<ReportRow[]>(
      `
        WITH eventos AS (
          SELECT
            'finalizacao'::text AS source,
            jf.id::text AS id,
            jf.monitoramento_id::text AS "monitoramentoId",
            jf.demanda_id::text AS "demandaId",
            COALESCE(d.protocolo::text, jf.demanda_id::text, jf.monitoramento_id::text) AS protocolo,
            jf.status::text AS type,
            COALESCE(p.nome, b.nome_paciente) AS "pacienteNome",
            COALESCE(p.municipio, 'Não informado') AS municipio,
            jf.valor_estado AS "valorEstado",
            jf.valor_municipio AS "valorMunicipio",
            NULL::text AS description,
            jf.reason::text AS reason,
            jf.created_by_name::text AS "createdByName",
            jf.created_at::text AS "createdAt"
          FROM public.judicial_finalizacoes jf
          JOIN public.judicial_monitoramento_base b
            ON b.id = jf.monitoramento_id
          LEFT JOIN public.demandas d
            ON d.id = jf.demanda_id
          LEFT JOIN public.pacientes p
            ON p.id = COALESCE(b.paciente_id, d."pacienteId")
          WHERE LOWER(COALESCE(jf.status::text, '')) IN ('bloqueio', 'sequestro')

          UNION ALL

          SELECT
            'movimentacao'::text AS source,
            jm.id::text AS id,
            jm.monitoramento_id::text AS "monitoramentoId",
            jm.demanda_id::text AS "demandaId",
            COALESCE(d.protocolo::text, jm.demanda_id::text, jm.monitoramento_id::text) AS protocolo,
            jm.type::text AS type,
            COALESCE(p.nome, b.nome_paciente) AS "pacienteNome",
            COALESCE(p.municipio, 'Não informado') AS municipio,
            jm.state_amount AS "valorEstado",
            jm.municipality_amount AS "valorMunicipio",
            jm.description::text AS description,
            NULL::text AS reason,
            jm.created_by_name::text AS "createdByName",
            jm.created_at::text AS "createdAt"
          FROM public.judicial_movimentacoes jm
          JOIN public.judicial_monitoramento_base b
            ON b.id = jm.monitoramento_id
          LEFT JOIN public.demandas d
            ON d.id = jm.demanda_id
          LEFT JOIN public.pacientes p
            ON p.id = COALESCE(b.paciente_id, d."pacienteId")
          WHERE LOWER(COALESCE(jm.type::text, '')) IN ('bloqueio', 'sequestro')
        )
        SELECT *
        FROM eventos
        ORDER BY "createdAt" DESC NULLS LAST, id DESC
      `,
    )

    const items = rows.map((row) => ({
      source: text(row.source),
      id: text(row.id),
      monitoramentoId: text(row.monitoramentoId),
      demandaId: text(row.demandaId),
      protocolo: text(row.protocolo),
      type: text(row.type).toLowerCase(),
      typeLabel: statusLabel(row.type),
      pacienteNome: text(row.pacienteNome) || "Não informado",
      municipio: text(row.municipio) || "Não informado",
      valorEstado: money(row.valorEstado),
      valorMunicipio: money(row.valorMunicipio),
      valorTotal: money(row.valorEstado) + money(row.valorMunicipio),
      description: text(row.description),
      reason: text(row.reason),
      createdByName: text(row.createdByName) || "Sistema",
      createdAt: text(row.createdAt),
    }))

    const totals = items.reduce(
      (acc, item) => {
        acc.estado += item.valorEstado
        acc.municipio += item.valorMunicipio
        acc.total += item.valorTotal
        if (item.type === "bloqueio") acc.bloqueio += item.valorTotal
        if (item.type === "sequestro") acc.sequestro += item.valorTotal
        return acc
      },
      { estado: 0, municipio: 0, total: 0, bloqueio: 0, sequestro: 0 },
    )

    const byMunicipality = Array.from(
      items.reduce((map, item) => {
        const current = map.get(item.municipio) ?? {
          municipio: item.municipio,
          valorEstado: 0,
          valorMunicipio: 0,
          valorTotal: 0,
          quantidade: 0,
        }

        current.valorEstado += item.valorEstado
        current.valorMunicipio += item.valorMunicipio
        current.valorTotal += item.valorTotal
        current.quantidade += 1
        map.set(item.municipio, current)
        return map
      }, new Map<string, { municipio: string; valorEstado: number; valorMunicipio: number; valorTotal: number; quantidade: number }>()).values(),
    ).sort((a, b) => b.valorTotal - a.valorTotal)

    return NextResponse.json({
      ok: true,
      totals,
      byMunicipality,
      items,
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/bloqueio-sequestro] erro:", error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar relatório de bloqueio/sequestro.", detail },
      { status: 500 },
    )
  }
}
