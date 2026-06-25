import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensurePreJudicialSchema } from "@/lib/pre-judicial-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Row = Record<string, any>

function text(value: unknown) {
  return String(value ?? "").trim()
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

function deadlineWarningLevel(value: string | null | undefined) {
  const days = diffDays(value)
  if (days < 0) return "overdue"
  if (days <= 2) return "critical"
  if (days <= 5) return "warning"
  return "ok"
}

function queueDueLabel(value: string | null | undefined) {
  const days = diffDays(value)
  if (!value) return "Sem prazo"
  if (days < 0) return `${Math.abs(days)} dia(s) em atraso`
  if (days === 0) return "Vence hoje"
  return `${days} dia(s)`
}

function queueReason(row: Row) {
  const days = diffDays(row.deadlineAt)
  if (row.schedulingStatus === "reservado" && row.schedulingResponseDeadlineAt && diffDays(row.schedulingResponseDeadlineAt) <= 2) return "reserva_vencendo"
  if (days < 0) return "prazo_vencido"
  if (days === 0) return "prazo_hoje"
  if (days <= 2) return "prazo_critico"
  return "novo_cadastro"
}

function queuePriorityScore(row: Row) {
  const base = Number(row.priority ?? 100)
  const reason = queueReason(row)
  if (reason === "prazo_vencido") return base + 100
  if (reason === "prazo_hoje") return base + 80
  if (reason === "prazo_critico") return base + 60
  if (reason === "reserva_vencendo") return base + 85
  return base
}

async function getColumns(table: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    table,
  )
  return new Set(rows.map((row) => row.column_name))
}

function col(cols: Set<string>, name: string, alias: string, type: "text" | "bool" | "int" = "text") {
  if (cols.has(name)) {
    if (type === "bool") return `c.${name} AS "${alias}"`
    if (type === "int") return `c.${name} AS "${alias}"`
    return `c.${name}::text AS "${alias}"`
  }
  if (type === "bool") return `TRUE AS "${alias}"`
  if (type === "int") return `100 AS "${alias}"`
  return `NULL::text AS "${alias}"`
}

export async function GET(req: NextRequest) {
  try {
    await ensurePreJudicialSchema().catch((error) => console.error("[GET /api/pre-judicial/casos] ensure:", error))

    const cols = await getColumns("pre_judicial_casos")
    if (!cols.has("id")) return NextResponse.json({ ok: true, items: [] })

    const { searchParams } = new URL(req.url)
    const search = text(searchParams.get("search"))
    const status = text(searchParams.get("status"))
    const reason = text(searchParams.get("reason"))
    const somenteAtivos = searchParams.get("somenteAtivos") !== "false"

    const values: unknown[] = []
    const whereParts: string[] = ["1 = 1"]

    if (somenteAtivos && cols.has("active")) whereParts.push("COALESCE(c.active, TRUE) = TRUE")
    if (status && status !== "todos" && cols.has("status")) {
      values.push(status)
      whereParts.push(`LOWER(COALESCE(c.status, '')) = LOWER($${values.length})`)
    }
    if (search) {
      const searchable = ["patient_name", "cpf", "protocol_number", "origin_protocol", "municipality_name"].filter((name) => cols.has(name))
      if (searchable.length) {
        values.push(`%${search}%`)
        const idx = values.length
        whereParts.push(`(${searchable.map((name) => `c.${name} ILIKE $${idx}`).join(" OR ")})`)
      }
    }

    const orderParts = []
    if (cols.has("active")) orderParts.push("c.active DESC")
    if (cols.has("deadline_at")) orderParts.push("c.deadline_at ASC NULLS LAST")
    if (cols.has("priority")) orderParts.push("c.priority DESC")
    if (cols.has("updated_at")) orderParts.push("c.updated_at DESC")
    orderParts.push("c.id DESC")

    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT
        c.id::text AS id,
        ${col(cols, "paciente_id", "pacienteId")},
        ${col(cols, "patient_name", "patientName")},
        ${col(cols, "cpf", "cpf")},
        ${col(cols, "municipality_name", "municipalityName")},
        ${col(cols, "origin_module", "originModule")},
        ${col(cols, "origin_protocol", "originProtocol")},
        ${col(cols, "protocol_number", "protocolNumber")},
        ${col(cols, "active", "active", "bool")},
        ${col(cols, "status", "status")},
        ${col(cols, "priority", "priority", "int")},
        ${col(cols, "created_at", "createdAt")},
        ${col(cols, "updated_at", "updatedAt")},
        ${col(cols, "deadline_at", "deadlineAt")},
        ${col(cols, "scheduling_status", "schedulingStatus")},
        ${col(cols, "scheduling_requested_at", "schedulingRequestedAt")},
        ${col(cols, "scheduling_reserved_at", "schedulingReservedAt")},
        ${col(cols, "scheduling_response_deadline_at", "schedulingResponseDeadlineAt")},
        ${col(cols, "appointment_date", "appointmentDate")},
        NULL::text AS "procedureCode",
        NULL::text AS "procedureDescription",
        NULL::text AS "cidCode",
        NULL::text AS "cidDescription"
       FROM public.pre_judicial_casos c
       WHERE ${whereParts.join(" AND ")}
       ORDER BY ${orderParts.join(", ")}
       LIMIT 200`,
      ...values,
    )

    const items = rows
      .map((row) => {
        const computedReason = queueReason(row)
        return {
          id: row.id,
          patientId: row.pacienteId || "",
          patientName: row.patientName || "Paciente não informado",
          cpf: row.cpf || "",
          municipalityName: row.municipalityName || "Não informado",
          originModule: row.originModule || "pre_judicial",
          originProtocol: row.originProtocol || "",
          protocolNumber: row.protocolNumber || row.id,
          active: row.active !== false,
          status: row.status || "ativo",
          priority: Number(row.priority ?? 100),
          createdAt: row.createdAt || "",
          updatedAt: row.updatedAt || "",
          deadlineAt: row.deadlineAt || "",
          deadlineWarningLevel: deadlineWarningLevel(row.deadlineAt),
          schedulingStatus: row.schedulingStatus || "fora_fila",
          schedulingRequestedAt: row.schedulingRequestedAt || undefined,
          schedulingReservedAt: row.schedulingReservedAt || undefined,
          schedulingResponseDeadlineAt: row.schedulingResponseDeadlineAt || undefined,
          appointmentDate: row.appointmentDate || undefined,
          procedureCode: row.procedureCode || "",
          procedureDescription: row.procedureDescription || "",
          cidCode: row.cidCode || "",
          cidDescription: row.cidDescription || "",
          queueReason: computedReason,
          queuePriorityScore: queuePriorityScore(row),
          queueDueLabel: queueDueLabel(row.deadlineAt),
        }
      })
      .filter((item) => !reason || reason === "todos" || item.queueReason === reason)
      .sort((a, b) => b.queuePriorityScore - a.queuePriorityScore)

    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error("[GET /api/pre-judicial/casos] erro:", error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "Erro ao carregar casos do Pré Judicial.", detail }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json({ ok: false, error: "Cadastro do Pré Judicial temporariamente indisponível até estabilização do schema." }, { status: 503 })
}
