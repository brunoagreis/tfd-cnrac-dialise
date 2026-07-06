import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PreJudicialCaseRow = {
  id: string
  protocolNumber: string | null
  patientName: string | null
  statusAnterior: string | null
  activeAnterior: boolean | null
  schedulingStatusAnterior: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeText(value: unknown) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
}

function parseDateTime(value: unknown) {
  const raw = text(value)

  if (!raw) return null

  const date = new Date(raw)

  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

function normalizeAttachments(value: unknown) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") {
        return {
          name: item,
        }
      }

      if (item && typeof item === "object") {
        return item
      }

      return {
        name: String(item ?? ""),
      }
    })
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((name) => ({ name }))
  }

  return []
}

function normalizeMovementType(value: unknown) {
  const type = normalizeText(value)

  if (!type) return "interacao"

  if (type === "interacao") return "interacao"
  if (type === "cadastro") return "cadastro"
  if (type === "anexo") return "anexo"
  if (type === "notificacao_municipio") return "notificacao_municipio"
  if (type === "envio_agendamento_demanda") return "envio_agendamento_demanda"
  if (type === "reserva_agendamento") return "reserva_agendamento"
  if (type === "agendado") return "agendado"
  if (type === "nao_agendado") return "nao_agendado"
  if (type === "manifestacao_automatica_prazo") return "manifestacao_automatica_prazo"
  if (type === "retorno_fila") return "retorno_fila"
  if (type === "encerramento") return "encerramento"
  if (type === "reabertura") return "reabertura"

  if (type === "resolvido" || type === "resolvida") return "resolvido"
  if (type === "cumprido" || type === "cumprida") return "cumprido"
  if (type === "arquivado" || type === "arquivada") return "arquivado"
  if (type === "obito") return "obito"

  return type
}

function movementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    cadastro: "Cadastro",
    interacao: "Interação",
    anexo: "Anexo",
    notificacao_municipio: "Notificação ao município",
    envio_agendamento_demanda: "Envio ao Agendamento da Demanda",
    reserva_agendamento: "Reserva de agenda",
    agendado: "Agendado",
    nao_agendado: "Não agendado",
    manifestacao_automatica_prazo: "Manifestação automática por prazo",
    retorno_fila: "Retorno à fila",
    encerramento: "Encerramento",
    reabertura: "Reabertura",
    resolvido: "Resolvido",
    cumprido: "Cumprido",
    arquivado: "Arquivado",
    obito: "Óbito",
  }

  return labels[type] || type
}

function normalizeOriginModule(value: unknown) {
  const key = text(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")

  if (key === "HEMODIALISE" || key === "HEMODIALISE") return "HEMODIALISE"
  if (key === "PRE_JUDICIAL") return "PRE_JUDICIAL"
  if (["JUDICIAL", "TFD", "CNRAC"].includes(key)) return key

  return key
}

function statusFromMovement(type: string) {
  if (type === "envio_agendamento_demanda") return "enviado_agendamento"
  if (type === "reserva_agendamento") return "reservado"
  if (type === "agendado") return "resolvido"
  if (type === "nao_agendado") return "ativo"
  if (type === "retorno_fila") return "ativo"
  if (type === "reabertura") return "ativo"
  if (type === "encerramento") return "encerrado"
  if (type === "resolvido") return "resolvido"
  if (type === "cumprido") return "cumprido"
  if (type === "arquivado") return "arquivado"
  if (type === "obito") return "obito"

  return null
}

function schedulingStatusFromMovement(type: string) {
  if (type === "envio_agendamento_demanda") return "pendente"
  if (type === "reserva_agendamento") return "reservado"
  if (type === "agendado") return "fora_fila"
  if (type === "nao_agendado") return "fora_fila"
  if (type === "retorno_fila") return "fora_fila"
  if (type === "reabertura") return "fora_fila"

  return null
}

function shouldCloseCase(type: string) {
  return ["encerramento", "resolvido", "cumprido", "arquivado", "obito"].includes(
    type,
  )
}

function shouldReopenCase(type: string) {
  return ["reabertura", "retorno_fila", "nao_agendado"].includes(type)
}

async function findPreJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<PreJudicialCaseRow[]>(
    `
      SELECT
        c.id::text AS id,
        c.protocol_number AS "protocolNumber",
        c.patient_name AS "patientName",
        c.status AS "statusAnterior",
        c.active AS "activeAnterior",
        c.scheduling_status AS "schedulingStatusAnterior"
      FROM public.pre_judicial_casos c
      WHERE
        c.id::text = $1
        OR c.protocol_number::text = $1
        OR c.origin_protocol::text = $1
      LIMIT 1
    `,
    decodedId,
  )

  return rows[0] ?? null
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)

    const body = await req.json().catch(() => ({}))

    const type = normalizeMovementType(body?.type || body?.movementType)
    const description = text(body?.description || body?.descricao)

    const dueAt = parseDateTime(
      body?.dueAt ||
        body?.responseDeadlineAt ||
        body?.response_deadline_at ||
        body?.prazoResposta,
    )

    const appointmentDate = parseDateTime(
      body?.appointmentDate || body?.appointment_date || body?.dataAgendamento,
    )

    const attachments = normalizeAttachments(body?.attachments)

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail)

    if (!description) {
      return NextResponse.json(
        { ok: false, error: "Descreva a movimentação." },
        { status: 400 },
      )
    }

    if (type === "envio_agendamento_demanda" && !dueAt) {
      return NextResponse.json(
        { ok: false, error: "Informe o prazo de resposta do Agendamento." },
        { status: 400 },
      )
    }

    if (type === "agendado" && !appointmentDate) {
      return NextResponse.json(
        { ok: false, error: "Informe a data do agendamento." },
        { status: 400 },
      )
    }

    const caso = await findPreJudicialCase(decodedId)

    if (!caso) {
      return NextResponse.json(
        { ok: false, error: "Processo pré judicial não encontrado." },
        { status: 404 },
      )
    }

    const movementId = `pre_mov_${randomUUID()}`
    const nextStatus = statusFromMovement(type) ?? "respondido" ?? "respondido"
    const nextSchedulingStatus = schedulingStatusFromMovement(type) ?? "fora_fila" ?? "fora_fila"

    const descricaoAuditoria = [
      `MOVIMENTAÇÃO PRÉ JUDICIAL: ${movementTypeLabel(type)}`,
      description,
      dueAt ? `Prazo: ${dueAt}` : "",
      appointmentDate ? `Agendamento: ${appointmentDate}` : "",
      attachments.length > 0
        ? `Anexos: ${attachments
            .map((item: any) => item?.name)
            .filter(Boolean)
            .join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")

    await prisma.$transaction(async (tx) => {
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
            $3,
            $4,
            $5::timestamptz,
            $6::timestamptz,
            $7::jsonb,
            $8,
            $9,
            $10,
            NOW()
          )
        `,
        movementId,
        caso.id,
        type,
        description,
        dueAt,
        appointmentDate,
        JSON.stringify(attachments),
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.pre_judicial_casos
          SET
            status = COALESCE($2, status),
            active = CASE
              WHEN $3 = TRUE THEN FALSE
              WHEN $4 = TRUE THEN TRUE
              ELSE active
            END,
            scheduling_status = COALESCE($5, scheduling_status),
            scheduling_requested_at = CASE
              WHEN $6 = 'envio_agendamento_demanda' THEN NOW()
              ELSE scheduling_requested_at
            END,
            scheduling_reserved_at = CASE
              WHEN $6 = 'reserva_agendamento' THEN NOW()
              ELSE scheduling_reserved_at
            END,
            scheduling_response_deadline_at = CASE
              WHEN $6 = 'envio_agendamento_demanda' THEN $7::timestamptz
              WHEN $6 IN ('agendado', 'nao_agendado', 'retorno_fila') THEN NULL
              ELSE scheduling_response_deadline_at
            END,
            appointment_date = CASE
              WHEN $6 = 'agendado' THEN $8::timestamptz
              ELSE appointment_date
            END,
            deadline_at = CASE
              WHEN $6 = 'envio_agendamento_demanda' THEN $7::timestamptz
              ELSE deadline_at
            END,
            updated_by = $9,
            updated_by_name = $10,
            updated_by_email = $11,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        caso.id,
        nextStatus,
        shouldCloseCase(type),
        shouldReopenCase(type),
        nextSchedulingStatus,
        type,
        dueAt,
        appointmentDate,
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
            'pre_judicial_movimentacoes',
            'registrar_movimentacao_pre_judicial',
            $1,
            $2,
            $3,
            $4,
            'PRE_JUDICIAL',
            NOW(),
            jsonb_build_object(
              'status_anterior', $5::text,
              'active_anterior', $6::boolean,
              'scheduling_status_anterior', $7::text
            ),
            jsonb_build_object(
              'movimentacao_id', $8::text,
              'type', $9::text,
              'description', $10::text,
              'due_at', $11::text,
              'appointment_date', $12::text,
              'attachments', $13::jsonb,
              'status_novo', $14::text,
              'scheduling_status_novo', $15::text
            ),
            jsonb_build_array(
              'pre_judicial_movimentacoes',
              'pre_judicial_casos.status',
              'pre_judicial_casos.active',
              'pre_judicial_casos.scheduling_status'
            ),
            $16
          )
        `,
        caso.id,
        userId,
        userName,
        userEmail || null,
        caso.statusAnterior || null,
        caso.activeAnterior ?? true,
        caso.schedulingStatusAnterior || null,
        movementId,
        type,
        description,
        dueAt,
        appointmentDate,
        JSON.stringify(attachments),
        nextStatus,
        nextSchedulingStatus,
        descricaoAuditoria,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: movementId,
        caseId: caso.id,
        protocolNumber: caso.protocolNumber,
        patientName: caso.patientName,
        type,
        typeLabel: movementTypeLabel(type),
        description,
        dueAt,
        appointmentDate,
        attachments,
        status: nextStatus,
        schedulingStatus: nextSchedulingStatus,
        active: false,
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/pre-judicial/casos/[id]/movimentacoes] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao registrar movimentação pré judicial." },
      { status: 500 },
    )
  }
}