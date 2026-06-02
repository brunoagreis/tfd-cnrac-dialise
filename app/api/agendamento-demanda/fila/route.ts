import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QueueRow = {
  id: string
  modulo: string
  protocolo: string | null
  pacienteNome: string | null
  cpf: string | null
  municipio: string | null
  statusAgendamento: string | null
  statusCaso: string | null
  solicitadoEm: string | null
  prazoResposta: string | null
  reservadoEm: string | null
  dataAgendamento: string | null
  procedimentoCodigo: string | null
  procedimentoDescricao: string | null
  cidCodigo: string | null
  cidDescricao: string | null
  atualizadoEm: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function formatStatus(status: string) {
  if (status === "pendente") return "Pendente"
  if (status === "reservado") return "Reservado"
  if (status === "fora_fila") return "Fora da fila"
  return status || "Não informado"
}

function diffDays(value: string | null | undefined) {
  if (!value) return 999

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 999

  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  return Math.ceil((startTarget.getTime() - startToday.getTime()) / 86400000)
}

function prazoLabel(value: string | null | undefined) {
  if (!value) return "Sem prazo"

  const days = diffDays(value)

  if (days < 0) return `${Math.abs(days)} dia(s) em atraso`
  if (days === 0) return "Vence hoje"

  return `${days} dia(s)`
}

function priorityScore(row: QueueRow) {
  const days = diffDays(row.prazoResposta)

  if (days < 0) return 1000 + Math.abs(days)
  if (days === 0) return 900
  if (days <= 2) return 800
  if (row.statusAgendamento === "reservado") return 700

  return 100
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const search = text(searchParams.get("search"))
    const status = text(searchParams.get("status"))
    const origem = text(searchParams.get("origem"))

    const whereParts: string[] = [
      "c.scheduling_status IN ('pendente', 'reservado')",
      "COALESCE(c.active, TRUE) = TRUE",
    ]

    const values: unknown[] = []

    if (status && status !== "todos") {
      values.push(status)
      whereParts.push(`c.scheduling_status = $${values.length}`)
    }

    if (search) {
      values.push(`%${search}%`)
      const idx = values.length

      whereParts.push(`
        (
          c.patient_name ILIKE $${idx}
          OR c.cpf ILIKE $${idx}
          OR c.protocol_number ILIKE $${idx}
          OR c.municipality_name ILIKE $${idx}
          OR EXISTS (
            SELECT 1
            FROM public.pre_judicial_procedimentos p
            WHERE p.caso_id = c.id
              AND COALESCE(p.active, TRUE) = TRUE
              AND (
                p.sigtap_code ILIKE $${idx}
                OR p.description ILIKE $${idx}
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.pre_judicial_cids cid
            WHERE cid.caso_id = c.id
              AND COALESCE(cid.active, TRUE) = TRUE
              AND (
                cid.code ILIKE $${idx}
                OR cid.description ILIKE $${idx}
              )
          )
        )
      `)
    }

    if (origem && origem !== "todos") {
      if (origem !== "pre_judicial") {
        return NextResponse.json({
          ok: true,
          items: [],
          stats: {
            total: 0,
            pendentes: 0,
            reservados: 0,
            vencidos: 0,
            preJudicial: 0,
          },
        })
      }
    }

    const rows = await prisma.$queryRawUnsafe<QueueRow[]>(
      `
        SELECT
          c.id::text AS id,
          'pre_judicial' AS modulo,
          c.protocol_number AS protocolo,
          c.patient_name AS "pacienteNome",
          c.cpf,
          c.municipality_name AS municipio,
          c.scheduling_status AS "statusAgendamento",
          c.status AS "statusCaso",
          c.scheduling_requested_at::text AS "solicitadoEm",
          c.scheduling_response_deadline_at::text AS "prazoResposta",
          c.scheduling_reserved_at::text AS "reservadoEm",
          c.appointment_date::text AS "dataAgendamento",
          (
            SELECT p.sigtap_code
            FROM public.pre_judicial_procedimentos p
            WHERE p.caso_id = c.id
              AND COALESCE(p.active, TRUE) = TRUE
            ORDER BY p.created_at ASC
            LIMIT 1
          ) AS "procedimentoCodigo",
          (
            SELECT p.description
            FROM public.pre_judicial_procedimentos p
            WHERE p.caso_id = c.id
              AND COALESCE(p.active, TRUE) = TRUE
            ORDER BY p.created_at ASC
            LIMIT 1
          ) AS "procedimentoDescricao",
          (
            SELECT cid.code
            FROM public.pre_judicial_cids cid
            WHERE cid.caso_id = c.id
              AND COALESCE(cid.active, TRUE) = TRUE
            ORDER BY cid.created_at ASC
            LIMIT 1
          ) AS "cidCodigo",
          (
            SELECT cid.description
            FROM public.pre_judicial_cids cid
            WHERE cid.caso_id = c.id
              AND COALESCE(cid.active, TRUE) = TRUE
            ORDER BY cid.created_at ASC
            LIMIT 1
          ) AS "cidDescricao",
          c.updated_at::text AS "atualizadoEm"
        FROM public.pre_judicial_casos c
        WHERE ${whereParts.join(" AND ")}
        ORDER BY
          c.scheduling_response_deadline_at ASC NULLS LAST,
          c.scheduling_requested_at ASC NULLS LAST,
          c.updated_at DESC
        LIMIT 300
      `,
      ...values,
    )

    const items = rows
      .map((row) => ({
        id: row.id,
        modulo: row.modulo,
        moduloLabel: "Pré Judicial",
        protocolo: row.protocolo || row.id,
        pacienteNome: row.pacienteNome || "Paciente não informado",
        cpf: row.cpf || "",
        municipio: row.municipio || "Não informado",
        statusAgendamento: row.statusAgendamento || "pendente",
        statusAgendamentoLabel: formatStatus(row.statusAgendamento || "pendente"),
        statusCaso: row.statusCaso || "",
        solicitadoEm: row.solicitadoEm || "",
        prazoResposta: row.prazoResposta || "",
        prazoLabel: prazoLabel(row.prazoResposta),
        reservadoEm: row.reservadoEm || "",
        dataAgendamento: row.dataAgendamento || "",
        procedimentoCodigo: row.procedimentoCodigo || "",
        procedimentoDescricao: row.procedimentoDescricao || "",
        cidCodigo: row.cidCodigo || "",
        cidDescricao: row.cidDescricao || "",
        atualizadoEm: row.atualizadoEm || "",
        prioridade: priorityScore(row),
        detalheHref: `/pre-judicial/${encodeURIComponent(row.id)}`,
      }))
      .sort((a, b) => b.prioridade - a.prioridade)

    const stats = {
      total: items.length,
      pendentes: items.filter((item) => item.statusAgendamento === "pendente").length,
      reservados: items.filter((item) => item.statusAgendamento === "reservado").length,
      vencidos: items.filter((item) => diffDays(item.prazoResposta) < 0).length,
      preJudicial: items.filter((item) => item.modulo === "pre_judicial").length,
    }

    return NextResponse.json({
      ok: true,
      items,
      stats,
    })
  } catch (error) {
    console.error("[GET /api/agendamento-demanda/fila] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar fila do Agendamento da Demanda." },
      { status: 500 },
    )
  }
}