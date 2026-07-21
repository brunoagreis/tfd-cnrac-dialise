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
  procedimento_nao_sus: "CUMPRIDO",
  competencia_municipio: "CUMPRIDO",
  cumprido: "CUMPRIDO",
  resolvido: "RESOLVIDO",
  arquivado: "ARQUIVADO",
  obito: "Óbito",
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

function normalizeAppointmentFichas(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item: any) => {
      const id = text(item?.id || item?.fichaId || item?.ficha_id)
      const appointmentDate = parseDateTime(
        item?.appointmentDate || item?.appointment_date || item?.dataAgendamento,
      )
      const notes = text(
        item?.notes || item?.appointmentNotes || item?.appointment_notes,
      )

      if (!id || !appointmentDate) return null

      return {
        id,
        appointmentDate,
        notes,
      }
    })
    .filter(Boolean) as Array<{
    id: string
    appointmentDate: string
    notes: string
  }>
}


function addDaysIso(baseDate: string | Date, days: number) {
  const date = baseDate instanceof Date ? new Date(baseDate) : new Date(baseDate)

  if (Number.isNaN(date.getTime())) return null

  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function addDaysDateOnlyIso(baseDate: string | Date, days: number) {
  const date = baseDate instanceof Date ? new Date(baseDate) : new Date(baseDate)

  if (Number.isNaN(date.getTime())) return null

  date.setHours(0, 0, 0, 0)
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

  if (["resposta_procuradoria", "resposta"].includes(type)) {
    return {
      nextDate: addDaysIso(new Date(), 1),
      reason: "RETORNO_RESPOSTA_PROCURADORIA_1_DIA",
      days: 1,
    }
  }

  if (["falta_paciente", "envio_modelo", "modelo_gerado", "modelo_enviado"].includes(type)) {
    return {
      nextDate: addDaysIso(new Date(), 20),
      reason: "RETORNO_MONITORAMENTO_20_DIAS",
      days: 20,
    }
  }

  if (type === "analise_viabilidade_nao_rede") {
    return {
      nextDate: addDaysIso(new Date(), 1),
      reason: "RETORNO_AGENDAMENTO_NAO_REALIZADO_NA_REDE",
      days: 1,
    }
  }

  if (type === "analise_viabilidade_complementacao") {
    return {
      nextDate: addDaysIso(new Date(), 1),
      reason: "RETORNO_AGENDAMENTO_COMPLEMENTACAO_INFORMACOES",
      days: 1,
    }
  }

  if (type === "envio_agendamento_demanda") {
    return {
      nextDate: null,
      reason: "AGUARDANDO_AGENDAMENTO_DA_DEMANDA",
      days: null,
    }
  }

  if (type === "comunicado_agendamento") {
    return {
      nextDate: appointmentDate ? addDaysDateOnlyIso(appointmentDate, 3) : null,
      reason: "RETORNO_3_DIAS_APOS_COMUNICADO_AGENDAMENTO",
      days: 3,
    }
  }

  if (type === "agendamento") {
    return {
      nextDate: addDaysIso(new Date(), 1),
      reason: "AGENDAMENTO_REALIZADO",
      days: 1,
    }
  }

  if (type === "retorno_fila") {
    return {
      nextDate: addDaysIso(new Date(), 1),
      reason: "DEVOLVIDO_PELO_AGENDAMENTO",
      days: 1,
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
    cid_adicionado: "CID adicionado",
    sigtap_adicionado: "SIGTAP adicionado",
    ficha_adicionada: "Ficha adicionada",
    envio_modelo: "Envio de modelo",
    modelo_gerado: "Modelo gerado",
    envio_agendamento_demanda: "Envio ao Agendamento da Demanda",
    analise_viabilidade_apta_agendamento: "Análise de viabilidade - apto para agendamento",
    analise_viabilidade_nao_rede: "Análise de viabilidade - não realizado na rede",
    analise_viabilidade_complementacao: "Análise de viabilidade - complementação necessária",
    comunicado_agendamento: "Comunicado Agendamento",
    agendamento: "Agendamento",
    solicitacao_inclusao: "Solicitação de inclusão",
    reiteracao: "Reiteração",
    descumprimento: "Descumprimento",
    cumprimento: "Cumprimento",
    procedimento_nao_sus: "Procedimento Não SUS",
    competencia_municipio: "Competência do Município",
    falta_paciente: "Falta do paciente",
    obito: "Óbito",
    bloqueio: "Bloqueio",
    sequestro: "Sequestro",
    encerramento_processo: "Encerramento do processo",
    cumprido: "Cumprido",
    resolvido: "Resolvido",
    arquivado: "Arquivado",
    manifestacao_municipio: "Manifestação do município",
    encaminhar_demanda_municipio: "Encaminhamento de Demanda ao Município",
  resposta_procuradoria: "Resposta a Procuradoria",
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

    let appointmentDate = parseDateTime(
      body?.appointmentDate || body?.appointment_date,
    )
    const responseRequestedAt = parseDateTime(
      body?.responseRequestedAt || body?.response_requested_at,
    )

    const appointmentFichas = normalizeAppointmentFichas(
      body?.appointmentFichas || body?.fichasAgendamento || body?.fichas || [],
    )

    if (!appointmentDate && appointmentFichas.length > 0) {
      appointmentDate = appointmentFichas[0].appointmentDate
    }

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

    if (["agendamento", "comunicado_agendamento"].includes(type) && !appointmentDate) {
      return NextResponse.json(
        { ok: false, error: "Informe a data do agendamento/atendimento." },
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
    const nextMonitoringStatus = ["monitoramento", "resposta_procuradoria", "resposta", "falta_paciente", "envio_modelo", "modelo_gerado", "modelo_enviado"].includes(type)
      ? null
      : TERMINAL_MOVEMENT_STATUS[type] || null
    const isTerminal = Boolean(nextMonitoringStatus)
    const shouldPauseForScheduling = [
      "envio_agendamento_demanda",
      "encaminhar_direto_agendamento",
      "analise_viabilidade_apta_agendamento",
      "analise_viabilidade_agendamento_apto",
      "apta_agendamento",
      "apto_agendamento",
      "reserva_agendamento",
    ].includes(type)
    const shouldReactivateAfterScheduling = [
      "monitoramento",
      "resposta_procuradoria",
      "resposta",
      "falta_paciente",
      "envio_modelo",
      "modelo_gerado",
      "modelo_enviado",
      "agendamento",
      "comunicado_agendamento",
      "retorno_fila",
      "analise_viabilidade_nao_rede",
      "analise_viabilidade_complementacao",
    ].includes(type)
    const returnRule = resolveReturnRule({
      type,
      appointmentDate,
      responseRequestedAt,
      terminal: isTerminal,
    })

    if (!isTerminal && !shouldPauseForScheduling && !returnRule.nextDate) {
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


      for (const ficha of appointmentFichas) {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_fichas
            SET
              appointment_date = $2::timestamptz,
              appointment_notes = NULLIF($3, ''),
              appointment_status = 'agendado',
              appointment_updated_at = NOW(),
              appointment_updated_by = $4,
              appointment_updated_by_name = $5,
              updated_by = $4,
              updated_by_name = $5,
              updated_at = NOW()
            WHERE id::text = $1
              AND monitoramento_id = $6::bigint
          `,
          ficha.id,
          ficha.appointmentDate,
          ficha.notes || description,
          userId,
          userName,
          processo.monitoramentoId,
        )
      }


      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            status_monitoramento_atual = CASE WHEN $3 = TRUE THEN $2 ELSE 'PENDENTE' END,
            pendente_dia_anterior = FALSE,
            ativo_monitoramento = CASE
              WHEN $3 = TRUE THEN FALSE
              WHEN $7 = TRUE THEN FALSE
              WHEN $8 = TRUE THEN TRUE
              ELSE ativo_monitoramento
            END,
            data_ultimo_monitoramento = NOW(),
            data_proximo_monitoramento = $4::timestamptz,
            motivo_proximo_monitoramento = $5,
            prazo_retorno_dias = $6::int,
            prioridade_monitoramento = CASE
              WHEN $11 = TRUE THEN GREATEST(COALESCE(prioridade_monitoramento, 0), 3)
              WHEN $7 = TRUE OR $9 = TRUE THEN 0
              ELSE prioridade_monitoramento
            END,
            prioridade_motivo = CASE
              WHEN $11 = TRUE THEN 'Retorno do Agendamento da Demanda; monitorar no dia seguinte com prioridade máxima.'
              WHEN $7 = TRUE OR $9 = TRUE THEN NULL
              ELSE prioridade_motivo
            END,
            prioridade_atualizada_em = CASE
              WHEN $11 = TRUE OR $7 = TRUE OR $9 = TRUE THEN NOW()
              ELSE prioridade_atualizada_em
            END,
            prioridade_atualizada_por = CASE
              WHEN $11 = TRUE OR $7 = TRUE OR $9 = TRUE THEN $10
              ELSE prioridade_atualizada_por
            END,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        processo.monitoramentoId,
        nextMonitoringStatus,
        isTerminal,
        returnRule.nextDate,
        returnRule.reason,
        returnRule.days,
        shouldPauseForScheduling,
        shouldReactivateAfterScheduling,
        type === "comunicado_agendamento",
        userId || "sistema",
        ["agendamento", "retorno_fila", "analise_viabilidade_nao_rede", "analise_viabilidade_complementacao"].includes(type),
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
          : shouldPauseForScheduling
            ? `Monitoramento do dia concluído por movimentação: ${movementTypeLabel(type)}. Demanda enviada ao Agendamento da Demanda; aguardando retorno.`
            : `Monitoramento do dia concluído por movimentação: ${movementTypeLabel(type)}. Retorno em ${returnRule.days} dia(s).`,
      )


      try {
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
      } catch (auditError) {
        console.error("MOVIMENTACAO_JUDICIAL_AUDIT_WARNING", auditError)
      }
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

    const detail = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      { ok: false, error: "Erro ao registrar movimentação judicial.", detail },
      { status: 500 },
    )
  }
}
