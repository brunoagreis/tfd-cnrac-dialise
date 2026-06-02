import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type HistoricoRow = {
  id: string
  protocolo: string
  modulo: string
  createdAt: string | null
  statusMonitoramentoAtual: string | null
}

function moduleLabel(value: string) {
  switch (String(value ?? "").toLowerCase()) {
    case "tfd":
      return "TFD"
    case "cnrac":
      return "CNRAC"
    case "hemodialise":
      return "Hemodiálise"
    case "judicial":
      return "Judicial"
    case "pre_judicial":
      return "Pré Judicial"
    default:
      return String(value ?? "")
  }
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? "").trim().toLowerCase()

  if (status === "finalizado" || status === "resolvido") return "resolvido"
  if (status === "devolvida" || status === "devolvido") return "devolvida"

  return "pendente"
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const pacienteId = decodeURIComponent(id)

    const rows = await prisma.$queryRawUnsafe<HistoricoRow[]>(
      `
        SELECT
          d.id::text AS id,
          d.protocolo::text AS protocolo,
          LOWER(COALESCE(d.modulo::text, '')) AS modulo,
          d."createdAt"::text AS "createdAt",
          b.status_monitoramento_atual AS "statusMonitoramentoAtual"
        FROM public.demandas d
        LEFT JOIN public.judicial_monitoramento_base b
          ON b.origem_tabela = 'demandas'
         AND b.origem_registro_id = d.id::text
        WHERE d."pacienteId"::text = $1
        ORDER BY COALESCE(d."createdAt", NOW()) DESC, d.id DESC
      `,
      pacienteId,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        label: row.protocolo,
        href: `/protocolo/${row.protocolo}`,
        moduleLabel: moduleLabel(row.modulo),
        createdAt: row.createdAt ?? "",
        status: normalizeStatus(row.statusMonitoramentoAtual),
      })),
    })
  } catch (error) {
    console.error("[GET /api/pacientes/[id]/historico] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar histórico do paciente." },
      { status: 500 },
    )
  }
}