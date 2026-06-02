import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PreJudicialCaseListRow = {
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
  schedulingStatus: string | null
  schedulingRequestedAt: string | null
  schedulingReservedAt: string | null
  schedulingResponseDeadlineAt: string | null
  appointmentDate: string | null
  procedureCode: string | null
  procedureDescription: string | null
  cidCode: string | null
  cidDescription: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function numberOrNull(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeDate(value: unknown) {
  const raw = text(value)
  if (!raw) return null

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    return null
  }

  return date.toISOString()
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

function deadlineWarningLevel(deadlineAt: string | null | undefined) {
  const days = diffDays(deadlineAt)

  if (days < 0) return "overdue"
  if (days <= 2) return "critical"
  if (days <= 5) return "warning"

  return "ok"
}

function queueDueLabel(deadlineAt: string | null | undefined) {
  const days = diffDays(deadlineAt)

  if (!deadlineAt) return "Sem prazo"
  if (days < 0) return `${Math.abs(days)} dia(s) em atraso`
  if (days === 0) return "Vence hoje"

  return `${days} dia(s)`
}

function queueReason(row: PreJudicialCaseListRow) {
  const days = diffDays(row.deadlineAt)

  if (
    row.schedulingStatus === "reservado" &&
    row.schedulingResponseDeadlineAt &&
    diffDays(row.schedulingResponseDeadlineAt) <= 2
  ) {
    return "reserva_vencendo"
  }

  if (days < 0) return "prazo_vencido"
  if (days === 0) return "prazo_hoje"
  if (days <= 2) return "prazo_critico"

  return "novo_cadastro"
}

function queuePriorityScore(row: PreJudicialCaseListRow) {
  const base = Number(row.priority ?? 100)
  const reason = queueReason(row)

  if (reason === "prazo_vencido") return base + 100
  if (reason === "prazo_hoje") return base + 80
  if (reason === "prazo_critico") return base + 60
  if (reason === "reserva_vencendo") return base + 85

  return base
}

async function nextProtocolNumber() {
  const year = new Date().getFullYear()

  const rows = await prisma.$queryRawUnsafe<Array<{ total: string | number }>>(
    `
      SELECT COUNT(*) AS total
      FROM public.pre_judicial_casos
      WHERE protocol_number LIKE $1
    `,
    `PRE-${year}-%`,
  )

  const total = Number(rows[0]?.total ?? 0) + 1

  return `PRE-${year}-${String(total).padStart(5, "0")}`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const search = text(searchParams.get("search"))
    const status = text(searchParams.get("status"))
    const reason = text(searchParams.get("reason"))
    const somenteAtivos = searchParams.get("somenteAtivos") !== "false"

    const whereParts: string[] = ["1 = 1"]
    const values: unknown[] = []

    if (somenteAtivos) {
      whereParts.push("c.active = TRUE")
    }

    if (status && status !== "todos") {
      values.push(status)
      whereParts.push(`LOWER(COALESCE(c.status, '')) = LOWER($${values.length})`)
    }

    if (search) {
      values.push(`%${search}%`)
      const idx = values.length

      whereParts.push(`
        (
          c.patient_name ILIKE $${idx}
          OR c.cpf ILIKE $${idx}
          OR c.protocol_number ILIKE $${idx}
          OR c.origin_protocol ILIKE $${idx}
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

    const rows = await prisma.$queryRawUnsafe<PreJudicialCaseListRow[]>(
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
          c.scheduling_status AS "schedulingStatus",
          c.scheduling_requested_at::text AS "schedulingRequestedAt",
          c.scheduling_reserved_at::text AS "schedulingReservedAt",
          c.scheduling_response_deadline_at::text AS "schedulingResponseDeadlineAt",
          c.appointment_date::text AS "appointmentDate",
          (
            SELECT p.sigtap_code
            FROM public.pre_judicial_procedimentos p
            WHERE p.caso_id = c.id
              AND COALESCE(p.active, TRUE) = TRUE
            ORDER BY p.created_at ASC
            LIMIT 1
          ) AS "procedureCode",
          (
            SELECT p.description
            FROM public.pre_judicial_procedimentos p
            WHERE p.caso_id = c.id
              AND COALESCE(p.active, TRUE) = TRUE
            ORDER BY p.created_at ASC
            LIMIT 1
          ) AS "procedureDescription",
          (
            SELECT cid.code
            FROM public.pre_judicial_cids cid
            WHERE cid.caso_id = c.id
              AND COALESCE(cid.active, TRUE) = TRUE
            ORDER BY cid.created_at ASC
            LIMIT 1
          ) AS "cidCode",
          (
            SELECT cid.description
            FROM public.pre_judicial_cids cid
            WHERE cid.caso_id = c.id
              AND COALESCE(cid.active, TRUE) = TRUE
            ORDER BY cid.created_at ASC
            LIMIT 1
          ) AS "cidDescription"
        FROM public.pre_judicial_casos c
        WHERE ${whereParts.join(" AND ")}
        ORDER BY
          c.active DESC,
          c.deadline_at ASC NULLS LAST,
          c.priority DESC,
          c.updated_at DESC
        LIMIT 200
      `,
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
          schedulingResponseDeadlineAt:
            row.schedulingResponseDeadlineAt || undefined,
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
      .filter((item) => {
        if (reason && reason !== "todos" && item.queueReason !== reason) {
          return false
        }

        return true
      })
      .sort((a, b) => b.queuePriorityScore - a.queuePriorityScore)

    return NextResponse.json({
      ok: true,
      items,
    })
  } catch (error) {
    console.error("[GET /api/pre-judicial/casos] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar casos do Pré Judicial." },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const patient = body?.patient || {}
    const data = body?.data || {}

    const pacienteId = text(patient?.id || body?.pacienteId)
    const patientName = text(patient?.nome || patient?.name || body?.patientName)
    const cpf = text(patient?.cpf || body?.cpf)

    const receivedAt = normalizeDate(data?.receivedAt || body?.receivedAt)
    const actionRecords = text(data?.actionRecords || body?.actionRecords)
    const pgeNetNumber = text(data?.pgeNetNumber || body?.pgeNetNumber)
    const deadlineDays = numberOrNull(data?.deadlineDays || body?.deadlineDays)
    const deadlineAt = normalizeDate(data?.deadlineAt || body?.deadlineAt)

    const municipalityId = text(data?.municipalityId || body?.municipalityId)
    const municipalityIbge = text(data?.municipalityIbge || body?.municipalityIbge)
    const municipalityName = text(
      data?.municipalityName || body?.municipalityName,
    )

    const procedures = Array.isArray(data?.procedures)
      ? data.procedures
      : Array.isArray(body?.procedures)
        ? body.procedures
        : []

    const cids = Array.isArray(data?.cids)
      ? data.cids
      : Array.isArray(body?.cids)
        ? body.cids
        : []

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail)

    if (!pacienteId || !patientName) {
      return NextResponse.json(
        { ok: false, error: "Paciente não informado." },
        { status: 400 },
      )
    }

    if (!receivedAt || !actionRecords || !pgeNetNumber || !deadlineDays || !deadlineAt) {
      return NextResponse.json(
        { ok: false, error: "Preencha os campos obrigatórios do Pré Judicial." },
        { status: 400 },
      )
    }

    if (!municipalityName) {
      return NextResponse.json(
        { ok: false, error: "Município envolvido não informado." },
        { status: 400 },
      )
    }

    if (procedures.length === 0 && cids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Informe ao menos um procedimento ou um CID." },
        { status: 400 },
      )
    }

    const caseId = `pre_case_${randomUUID()}`
    const protocolNumber = await nextProtocolNumber()

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_casos (
            id,
            paciente_id,
            patient_name,
            cpf,
            municipality_name,
            origin_module,
            origin_protocol,
            protocol_number,
            active,
            status,
            priority,
            received_at,
            action_records,
            pge_net_number,
            deadline_days,
            deadline_at,
            deadline_warning_level,
            scheduling_status,
            municipality_id,
            municipality_ibge,
            created_by,
            created_by_name,
            created_by_email,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'pre_judicial',
            $6,
            $6,
            TRUE,
            'ativo',
            100,
            $7::date,
            $8,
            $9,
            $10::integer,
            $11::timestamptz,
            $12,
            'fora_fila',
            $13,
            $14,
            $15,
            $16,
            $17,
            NOW(),
            NOW()
          )
        `,
        caseId,
        pacienteId,
        patientName,
        cpf || null,
        municipalityName,
        protocolNumber,
        receivedAt,
        actionRecords,
        pgeNetNumber,
        deadlineDays,
        deadlineAt,
        deadlineWarningLevel(deadlineAt),
        municipalityId || null,
        municipalityIbge || null,
        userId,
        userName,
        userEmail || null,
      )

      for (const item of procedures) {
        const code = text(item?.sigtapCode || item?.codigo || item?.code)
        const description = text(item?.description || item?.descricao)
        const specialty = text(item?.specialty || item?.especialidade)
        const subSpecialty = text(item?.subSpecialty || item?.subespecialidade)
        const situation = text(item?.situation || item?.situacao)

        if (!code || !description) continue

        await tx.$executeRawUnsafe(
          `
            INSERT INTO public.pre_judicial_procedimentos (
              id,
              caso_id,
              sigtap_code,
              description,
              specialty,
              sub_specialty,
              situation,
              active,
              created_by,
              created_by_name,
              created_by_email,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              TRUE,
              $8,
              $9,
              $10,
              NOW(),
              NOW()
            )
          `,
          `pre_proc_${randomUUID()}`,
          caseId,
          code,
          description,
          specialty || null,
          subSpecialty || null,
          situation || null,
          userId,
          userName,
          userEmail || null,
        )
      }

      for (const item of cids) {
        const code = text(item?.code || item?.codigo)
        const description = text(item?.description || item?.descricao)

        if (!code || !description) continue

        await tx.$executeRawUnsafe(
          `
            INSERT INTO public.pre_judicial_cids (
              id,
              caso_id,
              code,
              description,
              active,
              created_by,
              created_by_name,
              created_by_email,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              TRUE,
              $5,
              $6,
              $7,
              NOW(),
              NOW()
            )
          `,
          `pre_cid_${randomUUID()}`,
          caseId,
          code,
          description,
          userId,
          userName,
          userEmail || null,
        )
      }

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_movimentacoes (
            id,
            caso_id,
            type,
            description,
            due_at,
            attachments,
            created_by,
            created_by_name,
            created_by_email,
            created_at
          )
          VALUES (
            $1,
            $2,
            'cadastro',
            $3,
            $4::timestamptz,
            '[]'::jsonb,
            $5,
            $6,
            $7,
            NOW()
          )
        `,
        `pre_mov_${randomUUID()}`,
        caseId,
        `Cadastro inicial do Pré Judicial. PGE.net: ${pgeNetNumber}. Prazo final: ${deadlineAt}.`,
        deadlineAt,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.sistema_auditoria (
            tabela_nome,
            acao,
            registro_id,
            usuario_id,
            usuario_nome,
            usuario_email,
            modulo_codigo,
            data_hora,
            dados_anteriores,
            dados_novos,
            campos_alterados,
            observacao
          )
          VALUES (
            'pre_judicial_casos',
            'criar_caso_pre_judicial',
            $1,
            $2,
            $3,
            $4,
            'PRE_JUDICIAL',
            NOW(),
            jsonb_build_object(),
            jsonb_build_object(
              'case_id', $1::text,
              'protocol_number', $5::text,
              'patient_name', $6::text,
              'cpf', $7::text,
              'municipality_name', $8::text,
              'deadline_at', $9::text
            ),
            jsonb_build_array(
              'pre_judicial_casos',
              'pre_judicial_procedimentos',
              'pre_judicial_cids',
              'pre_judicial_movimentacoes'
            ),
            $10
          )
        `,
        caseId,
        userId,
        userName,
        userEmail || null,
        protocolNumber,
        patientName,
        cpf || null,
        municipalityName,
        deadlineAt,
        `Caso Pré Judicial criado: ${protocolNumber}`,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: caseId,
        patientId: pacienteId,
        patientName,
        cpf,
        municipalityName,
        originModule: "pre_judicial",
        originProtocol: protocolNumber,
        protocolNumber,
        active: true,
        status: "ativo",
        priority: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deadlineAt,
        deadlineWarningLevel: deadlineWarningLevel(deadlineAt),
        schedulingStatus: "fora_fila",
      },
    })
  } catch (error) {
    console.error("[POST /api/pre-judicial/casos] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao salvar caso do Pré Judicial." },
      { status: 500 },
    )
  }
}