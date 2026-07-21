import { randomUUID } from "crypto"
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
        (
          SELECT m.type::text
          FROM public.pre_judicial_movimentacoes m
          WHERE
            m.caso_id = c.id
            AND m.type IN (
              'envio_agendamento_demanda',
              'analise_viabilidade_apta_agendamento',
              'analise_viabilidade_nao_rede',
              'analise_viabilidade_complementacao',
              'reserva_agendamento',
              'agendado',
              'nao_agendado',
              'retorno_fila',
              'reabertura'
            )
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS "latestSchedulingMovementType",
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
          latestSchedulingMovementType: row.latestSchedulingMovementType || "",
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

function onlyDigits(value: unknown) {
  return text(value).replace(/\D/g, "")
}

function normalizeDateOnly(value: unknown) {
  const raw = text(value)
  if (!raw) return ""
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : raw
}

function normalizeDateTime(value: unknown) {
  const raw = text(value)
  if (!raw) return ""
  return raw
}

function normalizeUser(body: any) {
  const user = body?.user ?? {}

  return {
    id: text(user?.id ?? user?.userId ?? user?.usuarioId),
    nome: text(user?.nome ?? user?.name ?? user?.usuarioNome) || "Usuário",
    email: text(user?.email ?? user?.mail ?? user?.usuarioEmail),
  }
}

function normalizePatient(body: any) {
  const patient = body?.patient ?? body?.paciente ?? {}

  return {
    id: text(patient?.id ?? body?.pacienteId ?? body?.patientId),
    nome: text(patient?.nome ?? patient?.name ?? patient?.patientName),
    cpf: onlyDigits(patient?.cpf ?? body?.cpf),
    municipio: text(patient?.municipio ?? patient?.cidade ?? patient?.municipalityName),
  }
}

function normalizeProcedure(item: any) {
  return {
    sigtapCode: text(item?.sigtapCode ?? item?.codigo ?? item?.code),
    description: text(item?.description ?? item?.descricao),
    specialty: text(item?.specialty ?? item?.especialidade),
    subSpecialty: text(item?.subSpecialty ?? item?.subespecialidade),
    situation: text(item?.situation ?? item?.situacao) || "determinado",
  }
}

function normalizeCid(item: any) {
  return {
    code: text(item?.code ?? item?.codigo),
    description: text(item?.description ?? item?.descricao),
  }
}

async function nextPreJudicialProtocol(tx: any) {
  const year = new Date().getFullYear()
  const prefix = `PRE-${year}-`

  const rows = await tx.$queryRawUnsafe<Array<{ protocol_number: string }>>(
    `
      SELECT protocol_number
      FROM public.pre_judicial_casos
      WHERE protocol_number LIKE $1
      ORDER BY protocol_number DESC
      LIMIT 1
    `,
    prefix + "%",
  )

  const last = text(rows[0]?.protocol_number)
  const match = last.match(/^(?:PRE-)\d{4}-(\d+)$/)
  const next = match ? Number(match[1]) + 1 : 1

  return prefix + String(next).padStart(5, "0")
}

export async function POST(req: NextRequest) {
  try {
    await ensurePreJudicialSchema()

    const body = await req.json().catch(() => ({}))
    const user = normalizeUser(body)
    const patient = normalizePatient(body)
    const data = body?.data ?? {}

    const receivedAt = normalizeDateOnly(data?.receivedAt)
    const actionRecords = text(data?.actionRecords)
    const pgeNetNumber = text(data?.pgeNetNumber)
    const deadlineDays = Number(data?.deadlineDays)
    const deadlineAt = normalizeDateTime(data?.deadlineAt)
    const municipalityId = text(data?.municipalityId)
    const municipalityIbge = text(data?.municipalityIbge)
    const municipalityName = text(data?.municipalityName) || patient.municipio

    const procedures = Array.isArray(data?.procedures)
      ? data.procedures.map(normalizeProcedure).filter((item: any) => item.sigtapCode && item.description)
      : []

    const cids = Array.isArray(data?.cids)
      ? data.cids.map(normalizeCid).filter((item: any) => item.code && item.description)
      : []

    if (!patient.id) {
      return NextResponse.json(
        { ok: false, error: "Paciente não informado." },
        { status: 400 },
      )
    }

    if (!patient.nome) {
      return NextResponse.json(
        { ok: false, error: "Nome do paciente não informado." },
        { status: 400 },
      )
    }

    if (!receivedAt || !actionRecords || !pgeNetNumber || !deadlineDays || !deadlineAt || !municipalityName) {
      return NextResponse.json(
        { ok: false, error: "Campos obrigatórios do Pré Judicial não preenchidos." },
        { status: 400 },
      )
    }

    if (!Number.isFinite(deadlineDays) || deadlineDays <= 0) {
      return NextResponse.json(
        { ok: false, error: "Prazo em dias inválido." },
        { status: 400 },
      )
    }

    if (procedures.length === 0 && cids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Informe ao menos 1 procedimento ou 1 CID." },
        { status: 400 },
      )
    }

    const created = await prisma.$transaction(async (tx) => {
      const caseId = "pre_case_" + randomUUID()
      const protocolNumber = await nextPreJudicialProtocol(tx)
      const warningLevel = deadlineWarningLevel(deadlineAt)

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
            updated_by,
            updated_by_name,
            updated_by_email,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            NULLIF($4, ''),
            NULLIF($5, ''),
            'pre_judicial',
            $6,
            $6,
            TRUE,
            'ativo',
            100,
            $7::date,
            $8,
            $9,
            $10::int,
            $11::timestamptz,
            $12,
            'fora_fila',
            NULLIF($13, ''),
            NULLIF($14, ''),
            NULLIF($15, ''),
            NULLIF($16, ''),
            NULLIF($17, ''),
            NOW(),
            NULLIF($15, ''),
            NULLIF($16, ''),
            NULLIF($17, ''),
            NOW()
          )
        `,
        caseId,
        patient.id,
        patient.nome,
        patient.cpf,
        municipalityName,
        protocolNumber,
        receivedAt,
        actionRecords,
        pgeNetNumber,
        deadlineDays,
        deadlineAt,
        warningLevel,
        municipalityId,
        municipalityIbge,
        user.id,
        user.nome,
        user.email,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_pgenet (
            id,
            caso_id,
            numero,
            active,
            created_by,
            created_by_name,
            created_by_email,
            created_at,
            updated_by,
            updated_by_name,
            updated_by_email,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            TRUE,
            NULLIF($4, ''),
            NULLIF($5, ''),
            NULLIF($6, ''),
            NOW(),
            NULLIF($4, ''),
            NULLIF($5, ''),
            NULLIF($6, ''),
            NOW()
          )
        `,
        "pre_pge_" + randomUUID(),
        caseId,
        pgeNetNumber,
        user.id,
        user.nome,
        user.email,
      )

      for (const procedure of procedures) {
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
              updated_by,
              updated_by_name,
              updated_by_email,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              NULLIF($5, ''),
              NULLIF($6, ''),
              NULLIF($7, ''),
              TRUE,
              NULLIF($8, ''),
              NULLIF($9, ''),
              NULLIF($10, ''),
              NOW(),
              NULLIF($8, ''),
              NULLIF($9, ''),
              NULLIF($10, ''),
              NOW()
            )
          `,
          "pre_proc_" + randomUUID(),
          caseId,
          procedure.sigtapCode,
          procedure.description,
          procedure.specialty,
          procedure.subSpecialty,
          procedure.situation,
          user.id,
          user.nome,
          user.email,
        )
      }

      for (const cid of cids) {
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
              updated_by,
              updated_by_name,
              updated_by_email,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              TRUE,
              NULLIF($5, ''),
              NULLIF($6, ''),
              NULLIF($7, ''),
              NOW(),
              NULLIF($5, ''),
              NULLIF($6, ''),
              NULLIF($7, ''),
              NOW()
            )
          `,
          "pre_cid_" + randomUUID(),
          caseId,
          cid.code,
          cid.description,
          user.id,
          user.nome,
          user.email,
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
            appointment_date,
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
            NULL,
            '[]'::jsonb,
            NULLIF($5, ''),
            NULLIF($6, ''),
            NULLIF($7, ''),
            NOW()
          )
        `,
        "pre_mov_" + randomUUID(),
        caseId,
        `Cadastro inicial do Pré Judicial. PGE.net: ${pgeNetNumber}. Prazo final: ${deadlineAt}.`,
        deadlineAt,
        user.id,
        user.nome,
        user.email,
      )

      return {
        id: caseId,
        protocolNumber,
      }
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: created.id,
        patientId: patient.id,
        patientName: patient.nome,
        cpf: patient.cpf,
        municipalityName,
        originModule: "pre_judicial",
        originProtocol: created.protocolNumber,
        protocolNumber: created.protocolNumber,
        protocolo: created.protocolNumber,
        active: true,
        status: "ativo",
        priority: 100,
        receivedAt,
        actionRecords,
        pgeNetNumber,
        deadlineDays,
        deadlineAt,
        schedulingStatus: "fora_fila",
      },
    })
  } catch (error) {
    console.error("[POST /api/pre-judicial/casos] erro:", error)

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao cadastrar caso Pré Judicial.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
