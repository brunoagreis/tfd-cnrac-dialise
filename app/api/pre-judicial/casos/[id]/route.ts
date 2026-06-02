import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CaseRow = {
  id: string
  pacienteId: string | null
  patientName: string | null
  cpf: string | null
  municipalityName: string | null
  originModule: string | null
  originProtocol: string | null
  protocolNumber: string | null
  active: boolean | null
  status: string | null
  priority: number | null
  createdAt: string | null
  updatedAt: string | null
  deadlineAt: string | null
  deadlineWarningLevel: string | null
  schedulingStatus: string | null
  schedulingRequestedAt: string | null
  schedulingReservedAt: string | null
  schedulingResponseDeadlineAt: string | null
  appointmentDate: string | null
  receivedAt: string | null
  actionRecords: string | null
  pgeNetNumber: string | null
  deadlineDays: number | null
  municipalityId: string | null
  municipalityIbge: string | null
}

type ProcedureRow = {
  id: string
  sigtapCode: string | null
  description: string | null
  specialty: string | null
  subSpecialty: string | null
  situation: string | null
  active: boolean | null
  createdAt: string | null
  createdByName: string | null
}

type CidRow = {
  id: string
  code: string | null
  description: string | null
  active: boolean | null
  createdAt: string | null
  createdByName: string | null
}

type MovementRow = {
  id: string
  type: string | null
  description: string | null
  dueAt: string | null
  appointmentDate: string | null
  attachments: unknown
  createdAt: string | null
  createdById: string | null
  createdByName: string | null
}

type FinalizationRow = {
  id: string
  status: string | null
  pendingLocation: string | null
  reason: string | null
  valorEstado: string | number | null
  valorMunicipio: string | number | null
  createdAt: string | null
  createdById: string | null
  createdByName: string | null
}

type PgeNetRow = {
  id: string
  numero: string | null
  active: boolean | null
  createdAt: string | null
  createdByName: string | null
}

type ProcessNumberRow = {
  id: string
  numero: string | null
  origem: string | null
  observacao: string | null
  active: boolean | null
  createdAt: string | null
  createdByName: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function diffDays(value: string | null | undefined) {
  if (!value) return 999

  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return 999

  const today = new Date()
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  )

  return Math.ceil(
    (startOfTarget.getTime() - startOfToday.getTime()) / 86400000,
  )
}

function deadlineWarningLevel(value: string | null | undefined) {
  const days = diffDays(value)

  if (days < 0) return "overdue"
  if (days <= 2) return "critical"
  if (days <= 5) return "warning"

  return "ok"
}

function normalizeAttachments(value: unknown) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === "string") {
        return {
          id: `pre_att_${index}`,
          name: item,
          category: "interacao",
          createdAt: new Date().toISOString(),
          createdById: "sistema",
          createdByName: "Sistema",
        }
      }

      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>

        return {
          id: text(obj.id) || `pre_att_${index}`,
          name: text(obj.name) || "Arquivo",
          category: text(obj.category) || "interacao",
          createdAt: text(obj.createdAt) || new Date().toISOString(),
          createdById: text(obj.createdById) || "sistema",
          createdByName: text(obj.createdByName) || "Sistema",
          storedName: text(obj.storedName) || undefined,
          relativePath: text(obj.relativePath) || undefined,
          url:
            text(obj.url) ||
            (text(obj.relativePath)
              ? `/api/files/${text(obj.relativePath)}`
              : undefined),
          mimeType: text(obj.mimeType) || undefined,
          size: Number(obj.size || 0) || undefined,
        }
      }

      return {
        id: `pre_att_${index}`,
        name: String(item ?? "Arquivo"),
        category: "interacao",
        createdAt: new Date().toISOString(),
        createdById: "sistema",
        createdByName: "Sistema",
      }
    })
  }

  return []
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)

    const rows = await prisma.$queryRawUnsafe<CaseRow[]>(
      `
        SELECT
          c.id::text AS id,
          c.paciente_id::text AS "pacienteId",
          c.patient_name AS "patientName",
          c.cpf,
          c.municipality_name AS "municipalityName",
          c.origin_module AS "originModule",
          c.origin_protocol AS "originProtocol",
          c.protocol_number AS "protocolNumber",
          c.active,
          c.status,
          c.priority,
          c.created_at::text AS "createdAt",
          c.updated_at::text AS "updatedAt",
          c.deadline_at::text AS "deadlineAt",
          c.deadline_warning_level AS "deadlineWarningLevel",
          c.scheduling_status AS "schedulingStatus",
          c.scheduling_requested_at::text AS "schedulingRequestedAt",
          c.scheduling_reserved_at::text AS "schedulingReservedAt",
          c.scheduling_response_deadline_at::text AS "schedulingResponseDeadlineAt",
          c.appointment_date::text AS "appointmentDate",
          c.received_at::text AS "receivedAt",
          c.action_records AS "actionRecords",
          c.pge_net_number AS "pgeNetNumber",
          c.deadline_days AS "deadlineDays",
          c.municipality_id AS "municipalityId",
          c.municipality_ibge AS "municipalityIbge"
        FROM public.pre_judicial_casos c
        WHERE
          c.id::text = $1
          OR c.protocol_number::text = $1
          OR c.origin_protocol::text = $1
        LIMIT 1
      `,
      decodedId,
    )

    const row = rows[0]

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Processo pré judicial não encontrado." },
        { status: 404 },
      )
    }

    const proceduresRows = await prisma.$queryRawUnsafe<ProcedureRow[]>(
      `
        SELECT
          id::text AS id,
          sigtap_code AS "sigtapCode",
          description,
          specialty,
          sub_specialty AS "subSpecialty",
          situation,
          active,
          created_at::text AS "createdAt",
          created_by_name AS "createdByName"
        FROM public.pre_judicial_procedimentos
        WHERE caso_id = $1
        ORDER BY active DESC, created_at ASC
      `,
      row.id,
    )

    const cidRows = await prisma.$queryRawUnsafe<CidRow[]>(
      `
        SELECT
          id::text AS id,
          code,
          description,
          active,
          created_at::text AS "createdAt",
          created_by_name AS "createdByName"
        FROM public.pre_judicial_cids
        WHERE caso_id = $1
        ORDER BY active DESC, created_at ASC
      `,
      row.id,
    )

    const movementRows = await prisma.$queryRawUnsafe<MovementRow[]>(
      `
        SELECT
          id::text AS id,
          type,
          description,
          due_at::text AS "dueAt",
          appointment_date::text AS "appointmentDate",
          attachments,
          created_at::text AS "createdAt",
          created_by AS "createdById",
          created_by_name AS "createdByName"
        FROM public.pre_judicial_movimentacoes
        WHERE caso_id = $1
        ORDER BY created_at ASC
      `,
      row.id,
    )

    const finalizationRows = await prisma.$queryRawUnsafe<FinalizationRow[]>(
      `
        SELECT
          id::text AS id,
          status,
          pending_location AS "pendingLocation",
          reason,
          valor_estado AS "valorEstado",
          valor_municipio AS "valorMunicipio",
          created_at::text AS "createdAt",
          created_by AS "createdById",
          created_by_name AS "createdByName"
        FROM public.pre_judicial_finalizacoes
        WHERE caso_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      row.id,
    )

    const pgeRows = await prisma.$queryRawUnsafe<PgeNetRow[]>(
      `
        SELECT
          id::text AS id,
          numero,
          active,
          created_at::text AS "createdAt",
          created_by_name AS "createdByName"
        FROM public.pre_judicial_pgenet
        WHERE caso_id = $1
        ORDER BY active DESC, created_at ASC
      `,
      row.id,
    )

    const processRows = await prisma.$queryRawUnsafe<ProcessNumberRow[]>(
      `
        SELECT
          id::text AS id,
          numero,
          origem,
          observacao,
          active,
          created_at::text AS "createdAt",
          created_by_name AS "createdByName"
        FROM public.pre_judicial_processos_vinculados
        WHERE caso_id = $1
        ORDER BY active DESC, created_at ASC
      `,
      row.id,
    )

    const finalization = finalizationRows[0]

    return NextResponse.json({
      ok: true,
      item: {
        id: row.id,
        patientId: row.pacienteId || "",
        patientName: row.patientName || "Paciente não informado",
        cpf: row.cpf || "",
        municipalityName: row.municipalityName || "Não informado",
        originModule: row.originModule || "pre_judicial",
        originProtocol: row.originProtocol || row.protocolNumber || row.id,
        protocolNumber: row.protocolNumber || row.id,
        active: row.active !== false,
        status: row.status || "ativo",
        priority: Number(row.priority ?? 100),
        createdAt: row.createdAt || "",
        updatedAt: row.updatedAt || "",
        deadlineAt: row.deadlineAt || "",
        deadlineWarningLevel:
          row.deadlineWarningLevel || deadlineWarningLevel(row.deadlineAt),
        schedulingStatus: row.schedulingStatus || "fora_fila",
        schedulingRequestedAt: row.schedulingRequestedAt || undefined,
        schedulingReservedAt: row.schedulingReservedAt || undefined,
        schedulingResponseDeadlineAt:
          row.schedulingResponseDeadlineAt || undefined,
        appointmentDate: row.appointmentDate || undefined,

        pgeNetNumbers: pgeRows.map((item) => ({
          id: item.id,
          numero: item.numero || "",
          active: item.active !== false,
          createdAt: item.createdAt || "",
          createdByName: item.createdByName || "Sistema",
        })),

        processNumbers: processRows.map((item) => ({
          id: item.id,
          numero: item.numero || "",
          origem: item.origem || undefined,
          observacao: item.observacao || undefined,
          active: item.active !== false,
          createdAt: item.createdAt || "",
          createdByName: item.createdByName || "Sistema",
        })),

        procedures: proceduresRows.map((item) => ({
          id: item.id,
          sigtapCode: item.sigtapCode || "",
          description: item.description || "",
          specialty: item.specialty || undefined,
          subSpecialty: item.subSpecialty || undefined,
          situation: item.situation || undefined,
          active: item.active !== false,
          createdAt: item.createdAt || "",
          createdByName: item.createdByName || "Sistema",
        })),

        cids: cidRows.map((item) => ({
          id: item.id,
          code: item.code || "",
          description: item.description || "",
          active: item.active !== false,
          createdAt: item.createdAt || "",
          createdByName: item.createdByName || "Sistema",
        })),

        attachments: [],

        movements: movementRows.map((item) => ({
          id: item.id,
          type: item.type || "interacao",
          description: item.description || "",
          createdAt: item.createdAt || "",
          createdById: item.createdById || "sistema",
          createdByName: item.createdByName || "Sistema",
          dueAt: item.dueAt || undefined,
          appointmentDate: item.appointmentDate || undefined,
          attachments: normalizeAttachments(item.attachments),
        })),

        registration: {
          receivedAt: row.receivedAt || "",
          actionRecords: row.actionRecords || "",
          pgeNetNumber: row.pgeNetNumber || "",
          deadlineDays: Number(row.deadlineDays ?? 0),
          deadlineAt: row.deadlineAt || "",
          municipalityId: row.municipalityId || "",
          municipalityIbge: row.municipalityIbge || "",
          municipalityName: row.municipalityName || "Não informado",
        },

        finalization: finalization
          ? {
              status: finalization.status || "pendente",
              createdAt: finalization.createdAt || "",
              createdById: finalization.createdById || "sistema",
              createdByName: finalization.createdByName || "Sistema",
              pendingLocation: finalization.pendingLocation || undefined,
              reason: finalization.reason || undefined,
              valorEstado:
                finalization.valorEstado === null ||
                finalization.valorEstado === undefined
                  ? undefined
                  : Number(finalization.valorEstado),
              valorMunicipio:
                finalization.valorMunicipio === null ||
                finalization.valorMunicipio === undefined
                  ? undefined
                  : Number(finalization.valorMunicipio),
            }
          : undefined,
      },
    })
  } catch (error) {
    console.error("[GET /api/pre-judicial/casos/[id]] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar detalhe do processo pré judicial." },
      { status: 500 },
    )
  }
}