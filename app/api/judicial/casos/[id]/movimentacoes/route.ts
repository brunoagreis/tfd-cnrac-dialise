import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JudicialBaseRow = {
  monitoramentoId: string
  demandaId: string | null
  pacienteNome: string | null
  protocolo: string | null
}

type ReturnRule = {
  nextDate: string | null
  reason: string | null
  days: number | null
}

const TERMINAL_MOVEMENT_STATUS: Record<string, string> = {
  cumprimento: "CUMPRIDO",
  cumprido: "CUMPRIDO",
  resolvido: "RESOLVIDO",
  arquivado: "ARQUIVADO",
  falta_paciente: "FALTA_PACIENTE",
  obito: "OBITO",
  bloqueio: "BLOQUEIO",
  sequestro: "SEQUESTRO",
  encerramento_processo: "ARQUIVADO",
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function parseMoney(value: unknown) {
  const raw = text(value)

  if (!raw) return null

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")

  const number = Number(normalized)

  if (!Number.isFinite(number)) return null

  return number
}

function parseDateTime(value: unknown) {
  const raw = text(value)

  if (!raw) return null

  const date = new Date(raw)

  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

function addDaysIso(baseDate: string | Date, days: number) {
  const date = baseDate instanceof Date ? new Date(baseDate) : new Date(baseDate)

  if (Number.isNaN(date.getTime())) return null

  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function resolveReturnRule(params: {
  type: string
  appointmentDate: string | null
  responseRequestedAt: string | null
  terminal: boolean
}): ReturnRule {
  const { type, appointmentDate, responseRequestedAt, terminal } = params

  if (terminal) {
    return {
      nextDate: null,
      reason: null,
      days: null,
    }
  }

  if (type === "envio_agendamento_demanda") {
    return {
      nextDate: addDaysIso(new Date(), 5),
      reason: "RETORNO_ENVIO_AGENDAMENTO_5_DIAS",
      days: 5,
    }
  }

  if (type === "agendamento") {
    return {
      nextDate: appointmentDate ? addDaysIso(appointmentDate, 7) : null,
      reason: "RETORNO_7_DIAS_APOS_AGENDAMENTO",
      days: 7,
    }
  }

  if (type === "solicitacao_inclusao") {
    return {
      nextDate: responseRequestedAt ? addDaysIso(responseRequestedAt, 3) : null,
      reason: "RETORNO_3_DIAS_APOS_SOLICITACAO_INCLUSAO",
      days: 3,
    }
  }

  return {
    nextDate: addDaysIso(new Date(), 20),
    reason: "RETORNO_MONITORAMENTO_20_DIAS",
    days: 20,
  }
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

function movementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    monitoramento: "Monitoramento",
    envio_agendamento_demanda: "Envio ao Agendamento da Demanda",
    agendamento: "Agendamento",
    solicitacao_inclusao: "Solicitação de inclusão",
    reiteracao: "Reiteração",
    descumprimento: "Descumprimento",
    cumprimento: "Cumprimento",
    falta_paciente: "Falta do paciente",
    obito: "Óbito",
    bloqueio: "Bloqueio",
    sequestro: "Sequestro",
    encerramento_processo: "Encerramento do processo",
    cumprido: "Cumprido",
    resolvido: "Resolvido",
    arquivado: "Arquivado",
    manifestacao_municipio: "Manifestação do município",
    encaminhar_demanda_municipio: "Encaminhamento de Demanda ao Munic\u00edpio",
  }

  return labels[type] || type
}

async function findJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<JudicialBaseRow[]>(
    `
      SELECT
        b.id::text AS "monitoramentoId",
        b.demanda_id::text AS "demandaId",
        b.nome_paciente AS "pacienteNome",
        COALESCE(d.protocolo::text, b.demanda_id::text) AS protocolo
      FROM public.judicial_monitoramento_base b
      LEFT JOIN public.demandas d
        ON d.id = b.demanda_id
      WHERE UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'
        AND (
          b.id::text = $1
          OR b.demanda_id::text = $1
          OR b.origem_registro_id::text = $1
          OR d.id::text = $1
          OR d.protocolo::text = $1
        )
      ORDER BY b.id DESC
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

    const type = text(body?.type || body?.movementType || "monitoramento")
    const description = text(body?.description || body?.descricao)

    const appointmentDate = parseDateTime(
      body?.appointmentDate || body?.appointment_date,
    )
    const responseRequestedAt = parseDateTime(
      body?.responseRequestedAt || body?.response_requested_at,
    )

    const stateAmount = parseMoney(body?.stateAmount || body?.state_amount)
    const municipalityAmount = parseMoney(
      body?.municipalityAmount || body?.municipality_amount,
    )

    const attachments = normalizeAttachments(body?.attachments)

    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(
      body?.user?.nome ||
        body?.user?.name ||
        body?.userName ||
        "Sistema",
    )
    const userEmail = text(body?.user?.email || body?.userEmail).toLowerCase()

    if (!description) {
      return NextResponse.json(
        { ok: false, error: "Descreva a movimentação." },
        { status: 400 },
      )
    }

    if (type === "agendamento" && !appointmentDate) {
      return NextResponse.json(
        { ok: false, error: "Informe a data do agendamento." },
        { status: 400 },
      )
    }

    if (type === "solicitacao_inclusao" && !responseRequestedAt) {
      return NextResponse.json(
        { ok: false, error: "Informe a data da solicitação de inclusão." },
        { status: 400 },
      )
    }

    if (["bloqueio", "sequestro"].includes(type)) {
      if (stateAmount === null || stateAmount <= 0) {
        return NextResponse.json(
          { ok: false, error: "Informe o valor do Estado." },
          { status: 400 },
        )
      }

      if (municipalityAmount === null || municipalityAmount <= 0) {
        return NextResponse.json(
          { ok: false, error: "Informe o valor do Município." },
          { status: 400 },
        )
      }
    }

    const processo = await findJudicialCase(decodedId)

    if (!processo) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    const movementId = `jmov_${randomUUID()}`
    const nextMonitoringStatus = TERMINAL_MOVEMENT_STATUS[type] || null
    const isTerminal = Boolean(nextMonitoringStatus)
    const returnRule = resolveReturnRule({
      type,
      appointmentDate,
      responseRequestedAt,
      terminal: isTerminal,
    })

    if (!isTerminal && !returnRule.nextDate) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível calcular a data de retorno do monitoramento." },
        { status: 400 },
      )
    }

    const descricaoAuditoria = [
      `MOVIMENTAÇÃO JUDICIAL: ${movementTypeLabel(type)}`,
      description,
      appointmentDate ? `Agendamento: ${appointmentDate}` : "",
      responseRequestedAt ? `Solicitado em: ${responseRequestedAt}` : "",
      returnRule.nextDate ? `Próximo monitoramento: ${returnRule.nextDate}` : "",
      returnRule.reason ? `Motivo retorno: ${returnRule.reason}` : "",
      stateAmount !== null ? `Valor Estado: R$ ${stateAmount.toFixed(2)}` : "",
      municipalityAmount !== null
        ? `Valor Município: R$ ${municipalityAmount.toFixed(2)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_movimentacoes (
            id,
            monitoramento_id,
            demanda_id,
            type,
            description,
            appointment_date,
            response_requested_at,
            state_amount,
            municipality_amount,
            attachments,
            created_by,
            created_by_name,
            created_by_email,
            created_at
          )
          VALUES (
            $1,
            $2::bigint,
            $3,
            $4,
            $5,
            $6::timestamptz,
            $7::timestamptz,
            $8::numeric,
            $9::numeric,
            $10::jsonb,
            $11,
            $12,
            $13,
            NOW()
          )
        `,
        movementId,
        processo.monitoramentoId,
        processo.demandaId || null,
        type,
        description,
        appointmentDate,
        responseRequestedAt,
        stateAmount,
        municipalityAmount,
        JSON.stringify(attachments),
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            status_monitoramento_atual = CASE WHEN $3 = TRUE THEN $2 ELSE status_monitoramento_atual END,
            ativo_monitoramento = CASE WHEN $3 = TRUE THEN FALSE ELSE ativo_monitoramento END,
            data_ultimo_monitoramento = NOW(),
            data_proximo_monitoramento = $4::timestamptz,
            motivo_proximo_monitoramento = $5,
            prazo_retorno_dias = $6::int,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        processo.monitoramentoId,
        nextMonitoringStatus,
        isTerminal,
        returnRule.nextDate,
        returnRule.reason,
        returnRule.days,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_atribuicoes
          SET
            status = 'FINALIZADO',
            iniciado_em = COALESCE(iniciado_em, NOW()),
            finalizado_em = COALESCE(finalizado_em, NOW()),
            observacao = COALESCE(NULLIF(observacao, ''), '') || CASE
              WHEN COALESCE(NULLIF(observacao, ''), '') = '' THEN ''
              ELSE E'\n'
            END || $4,
            updated_at = NOW()
          WHERE data_referencia = CURRENT_DATE
            AND monitoramento_id = $1::bigint
            AND (
              NULLIF($2, '') IS NOT NULL AND usuario_id = $2
              OR NULLIF($3, '') IS NOT NULL AND LOWER(COALESCE(usuario_email, '')) = $3
            )
            AND status <> 'CANCELADO'
        `,
        processo.monitoramentoId,
        userId,
        userEmail,
        isTerminal
          ? `Finalizado por movimentação terminal: ${movementTypeLabel(type)}`
          : `Monitoramento do dia concluído por movimentação: ${movementTypeLabel(type)}. Retorno em ${returnRule.days} dia(s).`,
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
            'judicial_movimentacoes',
            'registrar_movimentacao_judicial',
            $1,
            $2,
            $3,
            $4,
            'JUDICIAL',
            NOW(),
            jsonb_build_object(),
            jsonb_build_object(
              'movimentacao_id', $5::text,
              'type', $6::text,
              'description', $7::text,
              'appointment_date', $8::text,
              'response_requested_at', $9::text,
              'state_amount', $10::numeric,
              'municipality_amount', $11::numeric,
              'attachments', $12::jsonb,
              'terminal', $14::boolean,
              'status_monitoramento_atual', $15::text,
              'data_proximo_monitoramento', $16::text,
              'motivo_proximo_monitoramento', $17::text,
              'prazo_retorno_dias', $18::int
            ),
            jsonb_build_array(
              'judicial_movimentacoes',
              'type',
              'description',
              'attachments',
              'judicial_monitoramento_atribuicoes',
              'ativo_monitoramento',
              'data_proximo_monitoramento',
              'motivo_proximo_monitoramento',
              'prazo_retorno_dias'
            ),
            $13
          )
        `,
        processo.monitoramentoId,
        userId,
        userName,
        userEmail || null,
        movementId,
        type,
        description,
        appointmentDate,
        responseRequestedAt,
        stateAmount,
        municipalityAmount,
        JSON.stringify(attachments),
        descricaoAuditoria,
        isTerminal,
        nextMonitoringStatus,
        returnRule.nextDate,
        returnRule.reason,
        returnRule.days,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: movementId,
        monitoramentoId: processo.monitoramentoId,
        demandaId: processo.demandaId,
        protocolo: processo.protocolo,
        pacienteNome: processo.pacienteNome,
        type,
        description,
        appointmentDate,
        responseRequestedAt,
        stateAmount,
        municipalityAmount,
        attachments,
        nextMonitoringAt: returnRule.nextDate,
        nextMonitoringReason: returnRule.reason,
        returnDeadlineDays: returnRule.days,
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/judicial/casos/[id]/movimentacoes] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao registrar movimentação judicial." },
      { status: 500 },
    )
  }
}
