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
  active: boolean | null
  source: string
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

function normalizeStatus(value: unknown, active?: boolean | null) {
  const status = String(value ?? "").trim().toLowerCase()

  if (active === false) return "encerrado"
  if (status === "encerrado" || status === "encerramento") return "encerrado"
  if (status === "finalizado" || status === "resolvido") return "resolvido"
  if (status === "devolvida" || status === "devolvido") return "devolvida"
  if (status) return status

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
          COALESCE(d."createdAt", d."updatedAt")::text AS "createdAt",
          b.status_monitoramento_atual AS "statusMonitoramentoAtual",
          TRUE::boolean AS active,
          'demandas'::text AS source
        FROM public.demandas d
        LEFT JOIN public.judicial_monitoramento_base b
          ON b.origem_tabela = 'demandas'
         AND b.origem_registro_id = d.id::text
        WHERE d."pacienteId"::text = $1

        UNION ALL

        SELECT
          c.id::text AS id,
          COALESCE(c.protocol_number::text, c.id::text) AS protocolo,
          'pre_judicial'::text AS modulo,
          COALESCE(c.created_at, c.updated_at)::text AS "createdAt",
          c.status::text AS "statusMonitoramentoAtual",
          COALESCE(c.active, TRUE)::boolean AS active,
          'pre_judicial_casos'::text AS source
        FROM public.pre_judicial_casos c
        WHERE c.paciente_id::text = $1
          AND NOT EXISTS (
            SELECT 1
            FROM public.demandas d2
            WHERE d2."pacienteId"::text = $1
              AND (
                d2.id::text = c.origin_protocol::text
                OR d2.protocolo::text = c.origin_protocol::text
                OR d2.protocolo::text = c.protocol_number::text
              )
          )

        ORDER BY "createdAt" DESC NULLS LAST, id DESC
      `,
      pacienteId,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        label: row.protocolo,
        href:
          row.modulo === "judicial"
            ? `/judicial/${row.id}`
            : row.modulo === "pre_judicial"
              ? `/pre-judicial/${row.id}`
              : `/protocolo/${row.protocolo}`,
        module: row.modulo,
        moduleLabel: moduleLabel(row.modulo),
        createdAt: row.createdAt ?? "",
        status: normalizeStatus(row.statusMonitoramentoAtual, row.active),
        active: row.active !== false,
        source: row.source,
        canReopen: row.modulo === "pre_judicial" && row.active === false,
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
