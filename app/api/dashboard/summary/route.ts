import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CountRow = { count: unknown }
type ModuleRow = { modulo: string | null; total: unknown; pendentes: unknown; resolvidas: unknown }

type Summary = {
  pacientes: number
  pendentes: number
  resolvidas: number
  riscoPrazo: number
  modules: Record<string, { total: number; pendentes: number; resolvidas: number; fila: number }>
  agendamento: number
}

const EMPTY_MODULE = { total: 0, pendentes: 0, resolvidas: 0, fila: 0 }

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeModule(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_")
}

async function countQuery(sql: string, ...params: unknown[]) {
  try {
    const rows = await prisma.$queryRawUnsafe<CountRow[]>(sql, ...params)
    return numberValue(rows[0]?.count)
  } catch (error) {
    console.error("DASHBOARD_SUMMARY_COUNT_ERROR", error)
    return 0
  }
}

async function moduleCounts() {
  try {
    const rows = await prisma.$queryRawUnsafe<ModuleRow[]>(`
      SELECT
        LOWER(COALESCE(d.modulo::text, '')) AS modulo,
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(to_jsonb(d)->>'status', 'pendente')) NOT IN (
            'resolvido', 'resolvida', 'cumprido', 'cumprida', 'finalizado', 'finalizada', 'concluido', 'concluida', 'cancelado', 'cancelada'
          )
        ) AS pendentes,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(to_jsonb(d)->>'status', '')) IN (
            'resolvido', 'resolvida', 'cumprido', 'cumprida', 'finalizado', 'finalizada', 'concluido', 'concluida'
          )
        ) AS resolvidas
      FROM public.demandas d
      GROUP BY LOWER(COALESCE(d.modulo::text, ''))
    `)

    const result: Summary["modules"] = {
      tfd: { ...EMPTY_MODULE },
      cnrac: { ...EMPTY_MODULE },
      hemodialise: { ...EMPTY_MODULE },
      judicial: { ...EMPTY_MODULE },
      pre_judicial: { ...EMPTY_MODULE },
    }

    for (const row of rows) {
      const module = normalizeModule(row.modulo)
      if (!result[module]) result[module] = { ...EMPTY_MODULE }
      result[module] = {
        ...result[module],
        total: numberValue(row.total),
        pendentes: numberValue(row.pendentes),
        resolvidas: numberValue(row.resolvidas),
      }
    }

    return result
  } catch (error) {
    console.error("DASHBOARD_SUMMARY_MODULES_ERROR", error)
    return {
      tfd: { ...EMPTY_MODULE },
      cnrac: { ...EMPTY_MODULE },
      hemodialise: { ...EMPTY_MODULE },
      judicial: { ...EMPTY_MODULE },
      pre_judicial: { ...EMPTY_MODULE },
    }
  }
}

async function monitoringCount(moduleCode: string) {
  return countQuery(
    `
      SELECT COUNT(*) AS count
      FROM public.judicial_monitoramento_base b
      WHERE b.ativo_monitoramento = TRUE
        AND UPPER(COALESCE(b.modulo_codigo, '')) = UPPER($1)
    `,
    moduleCode,
  )
}

async function riskCount() {
  return countQuery(`
    SELECT COUNT(*) AS count
    FROM public.judicial_monitoramento_base b
    WHERE b.ativo_monitoramento = TRUE
      AND (
        COALESCE(b.pendente_dia_anterior, FALSE) = TRUE
        OR UPPER(COALESCE(b.status_monitoramento_atual, '')) IN (
          'DESCUMPRIDO', 'INERCIA_MUNICIPIO', 'INTERACAO_MUNICIPIO', 'RISCO', 'PRAZO_VENCIDO'
        )
        OR NULLIF(to_jsonb(b)->>'data_proximo_monitoramento', '')::date <= CURRENT_DATE
      )
  `)
}

export async function GET() {
  try {
    const modules = await moduleCounts()

    const judicialFila = await monitoringCount("JUDICIAL")
    const preJudicialFila = await monitoringCount("PRE_JUDICIAL")

    modules.judicial = { ...(modules.judicial || EMPTY_MODULE), fila: judicialFila || modules.judicial?.pendentes || 0 }
    modules.pre_judicial = { ...(modules.pre_judicial || EMPTY_MODULE), fila: preJudicialFila || modules.pre_judicial?.pendentes || 0 }

    const pacientes = await countQuery(`SELECT COUNT(*) AS count FROM public.pacientes`)
    const pendentes = await countQuery(`
      SELECT COUNT(*) AS count
      FROM public.demandas d
      WHERE LOWER(COALESCE(to_jsonb(d)->>'status', 'pendente')) NOT IN (
        'resolvido', 'resolvida', 'cumprido', 'cumprida', 'finalizado', 'finalizada', 'concluido', 'concluida', 'cancelado', 'cancelada'
      )
    `)
    const resolvidas = await countQuery(`
      SELECT COUNT(*) AS count
      FROM public.demandas d
      WHERE LOWER(COALESCE(to_jsonb(d)->>'status', '')) IN (
        'resolvido', 'resolvida', 'cumprido', 'cumprida', 'finalizado', 'finalizada', 'concluido', 'concluida'
      )
    `)
    const riscoPrazo = await riskCount()

    const agendamento = await countQuery(`
      SELECT COUNT(*) AS count
      FROM public.demandas d
      WHERE LOWER(COALESCE(to_jsonb(d)->>'status', '')) IN ('em_agendamento', 'agendamento', 'em_analise', 'em análise')
    `)

    return NextResponse.json({
      ok: true,
      summary: {
        pacientes,
        pendentes,
        resolvidas,
        riscoPrazo,
        modules,
        agendamento,
      } satisfies Summary,
    })
  } catch (error) {
    console.error("[GET /api/dashboard/summary] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao carregar resumo do dashboard." }, { status: 500 })
  }
}
