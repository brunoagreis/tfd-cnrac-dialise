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

function normalizeQueueStatus(status: string | null | undefined) {
  const value = text(status).toLowerCase()

  if (
    value === "para_avaliar" ||
    value === "pendente_avaliacao" ||
    value === "pendente"
  ) {
    return "para_avaliar"
  }

  if (
    value === "para_agendar" ||
    value === "apto_agendamento" ||
    value === "apta_agendamento" ||
    value === "analise_viabilidade_apta_agendamento"
  ) {
    return "para_agendar"
  }

  if (value === "reservado") return "reservado"
  if (value === "fora_fila") return "fora_fila"

  return value || "para_avaliar"
}

function formatStatus(status: string | null | undefined) {
  const normalized = normalizeQueueStatus(status)

  if (normalized === "para_avaliar") return "Para avaliar"
  if (normalized === "para_agendar") return "Para agendar"
  if (normalized === "reservado") return "Reservado"
  if (normalized === "fora_fila") return "Fora da fila"

  return text(status) || "Não informado"
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
  const status = normalizeQueueStatus(row.statusAgendamento)

  if (days < 0) return 1000 + Math.abs(days)
  if (days === 0) return 900
  if (days <= 2) return 800
  if (status === "para_agendar") return 750
  if (status === "reservado") return 700

  return 100
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const search = text(searchParams.get("search"))
    const status = text(searchParams.get("status"))
    const origem = text(searchParams.get("origem"))

    const whereParts: string[] = [
      `e."statusAgendamento" IN ('para_avaliar', 'para_agendar', 'reservado')`,
    ]

    const values: unknown[] = []

    if (status && status !== "todos") {
      if (status === "para_avaliar" || status === "pendente") {
        whereParts.push(`e."statusAgendamento" = 'para_avaliar'`)
      } else if (status === "para_agendar") {
        whereParts.push(`e."statusAgendamento" = 'para_agendar'`)
      } else {
        values.push(status)
        whereParts.push(`e."statusAgendamento" = $${values.length}`)
      }
    }

    if (search) {
      values.push(`%${search}%`)
      const idx = values.length

      whereParts.push(`
        (
          e."pacienteNome" ILIKE $${idx}
          OR e.cpf ILIKE $${idx}
          OR e.protocolo ILIKE $${idx}
          OR e.municipio ILIKE $${idx}
          OR EXISTS (
            SELECT 1
            FROM public.pre_judicial_procedimentos p
            WHERE p.caso_id::text = e.id
              AND COALESCE(p.active, TRUE) = TRUE
              AND (
                p.sigtap_code ILIKE $${idx}
                OR p.description ILIKE $${idx}
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.pre_judicial_cids cid
            WHERE cid.caso_id::text = e.id
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
            paraAvaliar: 0,
            paraAgendar: 0,
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
        WITH fila AS (
          SELECT
            c.id::text AS id,
            'pre_judicial' AS modulo,
            c.protocol_number AS protocolo,
            c.patient_name AS "pacienteNome",
            c.cpf,
            c.municipality_name AS municipio,
            CASE
              -- Primeiro respeita o status atual gravado no caso.
              -- Isso evita que movimentações antigas de apto/reserva joguem a demanda reaberta direto para "Para Agendar".
              WHEN LOWER(COALESCE(c.scheduling_status, '')) IN (
                'para_avaliar',
                'pendente_avaliacao',
                'pendente'
              ) THEN 'para_avaliar'

              WHEN LOWER(COALESCE(c.scheduling_status, '')) IN (
                'para_agendar',
                'apto_agendamento',
                'apta_agendamento',
                'analise_viabilidade_apta_agendamento'
              ) THEN 'para_agendar'

              WHEN LOWER(COALESCE(c.scheduling_status, '')) = 'reservado'
              THEN 'reservado'

              -- Fallback apenas para registros antigos que ainda não possuem scheduling_status confiável.
              WHEN eventos.latest_saida_at IS NOT NULL
                AND eventos.latest_saida_at >= GREATEST(
                  COALESCE(eventos.latest_envio_at, '1970-01-01'::timestamptz),
                  COALESCE(eventos.latest_apto_at, '1970-01-01'::timestamptz),
                  COALESCE(eventos.latest_reserva_at, '1970-01-01'::timestamptz)
                )
              THEN 'fora_fila'

              WHEN eventos.latest_reserva_at IS NOT NULL
              THEN 'reservado'

              WHEN eventos.latest_apto_at IS NOT NULL
              THEN 'para_agendar'

              WHEN eventos.latest_envio_at IS NOT NULL
              THEN 'para_avaliar'

              ELSE normalize(lower(COALESCE(c.scheduling_status, '')))
            END AS "statusAgendamento",
            c.status AS "statusCaso",
            COALESCE(
              c.scheduling_requested_at,
              eventos.latest_envio_at,
              eventos.latest_apto_at
            )::text AS "solicitadoEm",
            COALESCE(
              c.scheduling_response_deadline_at,
              eventos.latest_due_at
            )::text AS "prazoResposta",
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
          LEFT JOIN LATERAL (
            SELECT
              MAX(m.created_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) = 'envio_agendamento_demanda'
              ) AS latest_envio_at,
              MAX(m.created_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) IN (
                  'analise_viabilidade_apta_agendamento',
                  'analise_viabilidade_agendamento_apto',
                  'apta_agendamento',
                  'apto_agendamento'
                )
              ) AS latest_apto_at,
              MAX(m.created_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) = 'reserva_agendamento'
              ) AS latest_reserva_at,
              MAX(m.created_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) IN (
                  'agendado',
                  'nao_agendado',
                  'retorno_fila',
                  'reabertura'
                )
              ) AS latest_saida_at,
              MAX(m.due_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) IN (
                  'envio_agendamento_demanda',
                  'analise_viabilidade_apta_agendamento',
                  'analise_viabilidade_agendamento_apto',
                  'apta_agendamento',
                  'apto_agendamento'
                )
              ) AS latest_due_at
            FROM public.pre_judicial_movimentacoes m
            WHERE m.caso_id = c.id
          ) eventos ON TRUE
          WHERE COALESCE(c.active, TRUE) = TRUE
            AND LOWER(COALESCE(c.status, '')) NOT IN (
              'encerrado',
              'resolvido',
              'cumprido',
              'arquivado',
              'obito'
            )
          UNION ALL

          SELECT
            b.id::text AS id,
            'judicial' AS modulo,
            COALESCE(d.protocolo::text, b.demanda_id::text, b.id::text) AS protocolo,
            b.nome_paciente AS "pacienteNome",
            COALESCE(
              NULLIF(to_jsonb(b)->>'cpf', ''),
              NULLIF(to_jsonb(b)->>'cpf_paciente', ''),
              NULLIF(to_jsonb(b)->>'paciente_cpf', ''),
              NULLIF(to_jsonb(b)->>'documento_paciente', ''),
              NULLIF(to_jsonb(d)->>'cpf', ''),
              NULLIF(to_jsonb(d)->>'cpf_paciente', ''),
              NULLIF(to_jsonb(d)->>'paciente_cpf', ''),
              NULL::text
            ) AS cpf,
            COALESCE(
              NULLIF(to_jsonb(b)->>'municipio', ''),
              NULLIF(to_jsonb(b)->>'municipio_nome', ''),
              NULLIF(to_jsonb(b)->>'municipality_name', ''),
              NULLIF(to_jsonb(b)->>'nome_municipio', ''),
              NULLIF(to_jsonb(b)->>'municipio_residencia', ''),
              NULLIF(to_jsonb(d)->>'municipio', ''),
              NULLIF(to_jsonb(d)->>'municipio_nome', ''),
              NULLIF(to_jsonb(d)->>'municipality_name', ''),
              NULLIF(to_jsonb(d)->>'nome_municipio', ''),
              NULL::text
            ) AS municipio,
            CASE
              WHEN eventos.latest_saida_at IS NOT NULL
                AND eventos.latest_saida_at >= GREATEST(
                  COALESCE(eventos.latest_envio_at, '1970-01-01'::timestamptz),
                  COALESCE(eventos.latest_direto_at, '1970-01-01'::timestamptz),
                  COALESCE(eventos.latest_apto_at, '1970-01-01'::timestamptz)
                )
              THEN 'fora_fila'

              WHEN eventos.latest_apto_at IS NOT NULL
                AND eventos.latest_apto_at >= GREATEST(
                  COALESCE(eventos.latest_envio_at, '1970-01-01'::timestamptz),
                  COALESCE(eventos.latest_direto_at, '1970-01-01'::timestamptz)
                )
              THEN 'para_agendar'

              WHEN eventos.latest_direto_at IS NOT NULL
                AND eventos.latest_direto_at >= COALESCE(eventos.latest_envio_at, '1970-01-01'::timestamptz)
              THEN 'para_agendar'

              WHEN eventos.latest_envio_at IS NOT NULL
              THEN 'para_avaliar'

              ELSE 'para_avaliar'
            END AS "statusAgendamento",
            COALESCE(b.status_monitoramento_atual::text, '') AS "statusCaso",
            GREATEST(
              COALESCE(eventos.latest_envio_at, '1970-01-01'::timestamptz),
              COALESCE(eventos.latest_direto_at, '1970-01-01'::timestamptz),
              COALESCE(eventos.latest_apto_at, '1970-01-01'::timestamptz)
            )::text AS "solicitadoEm",
            CASE
              WHEN eventos.latest_envio_at IS NOT NULL
                AND eventos.latest_envio_at >= GREATEST(
                  COALESCE(eventos.latest_direto_at, '1970-01-01'::timestamptz),
                  COALESCE(eventos.latest_apto_at, '1970-01-01'::timestamptz)
                )
              THEN COALESCE(eventos.latest_envio_at + INTERVAL '5 days', b.data_proximo_monitoramento)::text
              ELSE NULL::text
            END AS "prazoResposta",
            NULL::text AS "reservadoEm",
            NULL::text AS "dataAgendamento",
            COALESCE(
              NULLIF(to_jsonb(b)->>'procedimento_codigo', ''),
              NULLIF(to_jsonb(b)->>'codigo_procedimento', ''),
              NULLIF(to_jsonb(b)->>'procedimento_sigtap', ''),
              NULLIF(to_jsonb(b)->>'procedimento_sigtap_codigo', ''),
              NULLIF(to_jsonb(d)->>'procedimento_codigo', ''),
              NULLIF(to_jsonb(d)->>'codigo_procedimento', ''),
              NULLIF(to_jsonb(d)->>'procedimento_sigtap', ''),
              NULL::text
            ) AS "procedimentoCodigo",
            COALESCE(
              NULLIF(to_jsonb(b)->>'procedimento_descricao', ''),
              NULLIF(to_jsonb(b)->>'descricao_procedimento', ''),
              NULLIF(to_jsonb(b)->>'procedimento_nome', ''),
              NULLIF(to_jsonb(b)->>'procedimento', ''),
              NULLIF(to_jsonb(d)->>'procedimento_descricao', ''),
              NULLIF(to_jsonb(d)->>'descricao_procedimento', ''),
              NULLIF(to_jsonb(d)->>'procedimento_nome', ''),
              NULLIF(to_jsonb(d)->>'procedimento', ''),
              NULL::text
            ) AS "procedimentoDescricao",
            COALESCE(
              NULLIF(to_jsonb(b)->>'cid_codigo', ''),
              NULLIF(to_jsonb(b)->>'codigo_cid', ''),
              NULLIF(to_jsonb(b)->>'cid10', ''),
              NULLIF(to_jsonb(b)->>'cid', ''),
              NULLIF(to_jsonb(d)->>'cid_codigo', ''),
              NULLIF(to_jsonb(d)->>'codigo_cid', ''),
              NULLIF(to_jsonb(d)->>'cid10', ''),
              NULLIF(to_jsonb(d)->>'cid', ''),
              NULL::text
            ) AS "cidCodigo",
            COALESCE(
              NULLIF(to_jsonb(b)->>'cid_descricao', ''),
              NULLIF(to_jsonb(b)->>'descricao_cid', ''),
              NULLIF(to_jsonb(d)->>'cid_descricao', ''),
              NULLIF(to_jsonb(d)->>'descricao_cid', ''),
              NULL::text
            ) AS "cidDescricao",
            COALESCE(
              b.updated_at,
              eventos.latest_saida_at,
              eventos.latest_apto_at,
              eventos.latest_direto_at,
              eventos.latest_envio_at
            )::text AS "atualizadoEm"
          FROM public.judicial_monitoramento_base b
          LEFT JOIN public.demandas d
            ON d.id = b.demanda_id
          LEFT JOIN LATERAL (
            SELECT
              MAX(m.created_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) = 'envio_agendamento_demanda'
              ) AS latest_envio_at,
              MAX(m.created_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) = 'encaminhar_direto_agendamento'
              ) AS latest_direto_at,
              MAX(m.created_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) IN (
                  'analise_viabilidade_apta_agendamento',
                  'analise_viabilidade_agendamento_apto',
                  'apta_agendamento',
                  'apto_agendamento'
                )
              ) AS latest_apto_at,
              MAX(m.created_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) IN (
                  'agendamento',
                  'agendado',
                  'nao_agendado',
                  'retorno_fila',
                  'analise_viabilidade_nao_rede',
                  'analise_viabilidade_complementacao'
                )
              ) AS latest_saida_at,
              MAX(m.created_at) FILTER (
                WHERE LOWER(COALESCE(m.type, '')) IN (
                  'encerramento_processo',
                  'encerramento',
                  'encerramento_inercia',
                  'resolvido',
                  'cumprido',
                  'cumprimento',
                  'arquivado',
                  'obito',
                  'óbito',
                  'falta_paciente',
                  'procedimento_nao_sus',
                  'competencia_municipio',
                  'bloqueio',
                  'sequestro'
                )
              ) AS latest_terminal_at
            FROM public.judicial_movimentacoes m
            WHERE m.monitoramento_id = b.id
          ) eventos ON TRUE
          WHERE UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'
            AND (
              eventos.latest_envio_at IS NOT NULL
              OR eventos.latest_direto_at IS NOT NULL
              OR eventos.latest_apto_at IS NOT NULL
            )
            AND GREATEST(
              COALESCE(eventos.latest_envio_at, '1970-01-01'::timestamptz),
              COALESCE(eventos.latest_direto_at, '1970-01-01'::timestamptz),
              COALESCE(eventos.latest_apto_at, '1970-01-01'::timestamptz)
            ) > COALESCE(eventos.latest_saida_at, '1970-01-01'::timestamptz)
            AND GREATEST(
              COALESCE(eventos.latest_envio_at, '1970-01-01'::timestamptz),
              COALESCE(eventos.latest_direto_at, '1970-01-01'::timestamptz),
              COALESCE(eventos.latest_apto_at, '1970-01-01'::timestamptz)
            ) > COALESCE(eventos.latest_terminal_at, '1970-01-01'::timestamptz)
            AND COALESCE(b.ativo_monitoramento, TRUE) = TRUE
            AND LOWER(COALESCE(b.status_monitoramento_atual, '')) NOT IN (
              'encerrado',
              'resolvido',
              'cumprido',
              'arquivado',
              'obito',
              'óbito',
              'falta_paciente',
              'procedimento_nao_sus',
              'competencia_municipio',
              'bloqueio',
              'sequestro'
            )
)
        SELECT
          e.id,
          e.modulo,
          e.protocolo,
          e."pacienteNome",
          e.cpf,
          e.municipio,
          e."statusAgendamento",
          e."statusCaso",
          e."solicitadoEm",
          e."prazoResposta",
          e."reservadoEm",
          e."dataAgendamento",
          e."procedimentoCodigo",
          e."procedimentoDescricao",
          e."cidCodigo",
          e."cidDescricao",
          e."atualizadoEm"
        FROM fila e
        WHERE ${whereParts.join(" AND ")}
        ORDER BY
          e."prazoResposta" ASC NULLS LAST,
          e."solicitadoEm" ASC NULLS LAST,
          e."atualizadoEm" DESC
        LIMIT 300
      `,
      ...values,
    )


    const judicialQueueIds = rows
      .filter((row) => row.modulo === "judicial")
      .map((row) => String(row.id || ""))
      .filter(Boolean)

    const preJudicialQueueIds = rows
      .filter((row) => row.modulo === "pre_judicial")
      .map((row) => String(row.id || ""))
      .filter(Boolean)

    const fichaRows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          ('judicial:' || f.monitoramento_id::text) AS queue_key,
          f.id::text AS id,
          f.system,
          f.number,
          f.notes,
          f.active,
          f.status,
          f.appointment_date::text AS "appointmentDate",
          f.appointment_status AS "appointmentStatus",
          f.appointment_notes AS "appointmentNotes"
        FROM public.judicial_fichas f
        WHERE f.monitoramento_id::text IN (
          SELECT jsonb_array_elements_text($1::jsonb)
        )
          AND COALESCE(f.active, TRUE) = TRUE

        UNION ALL

        SELECT
          ('pre_judicial:' || f.caso_id::text) AS queue_key,
          f.id::text AS id,
          f.system,
          f.number,
          f.notes,
          f.active,
          f.status,
          f.appointment_date::text AS "appointmentDate",
          f.appointment_status AS "appointmentStatus",
          f.appointment_notes AS "appointmentNotes"
        FROM public.pre_judicial_fichas f
        WHERE f.caso_id::text IN (
          SELECT jsonb_array_elements_text($2::jsonb)
        )
          AND COALESCE(f.active, TRUE) = TRUE
        ORDER BY number NULLS LAST
      `,
      JSON.stringify(judicialQueueIds),
      JSON.stringify(preJudicialQueueIds),
    )

    const fichasByQueue = new Map<string, any[]>()

    for (const ficha of fichaRows) {
      const key = String(ficha.queue_key || "")
      if (!key) continue

      const list = fichasByQueue.get(key) ?? []
      list.push({
        id: String(ficha.id || ""),
        system: String(ficha.system || "CORE"),
        number: String(ficha.number || ""),
        notes: String(ficha.notes || ""),
        active: ficha.active !== false,
        status: ficha.status || "",
        appointmentDate: ficha.appointmentDate || "",
        appointmentStatus: ficha.appointmentStatus || "",
        appointmentNotes: ficha.appointmentNotes || "",
      })
      fichasByQueue.set(key, list)
    }

    const items = rows
      .map((row) => {
        const normalizedStatus = normalizeQueueStatus(row.statusAgendamento)

        return {
          id: row.id,
          modulo: row.modulo,
          moduloLabel: row.modulo === "judicial" ? "Judicial" : "Pré Judicial",
          protocolo: row.protocolo || row.id,
          pacienteNome: row.pacienteNome || "Paciente não informado",
          cpf: row.cpf || "",
          municipio: row.municipio || "Não informado",
          statusAgendamento: normalizedStatus,
          statusAgendamentoLabel: formatStatus(normalizedStatus),
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
          fichas: fichasByQueue.get(`${row.modulo}:${row.id}`) ?? [],
          prioridade: priorityScore({
            ...row,
            statusAgendamento: normalizedStatus,
          }),
          detalheHref:
            row.modulo === "judicial"
              ? `/judicial/${encodeURIComponent(row.id)}`
              : `/pre-judicial/${encodeURIComponent(row.id)}`,
        }
      })
      .sort((a, b) => b.prioridade - a.prioridade)

    const stats = {
      total: items.length,
      paraAvaliar: items.filter((item) => item.statusAgendamento === "para_avaliar").length,
      paraAgendar: items.filter((item) => item.statusAgendamento === "para_agendar").length,
      pendentes: items.filter((item) =>
        ["para_avaliar", "para_agendar"].includes(item.statusAgendamento),
      ).length,
      reservados: items.filter((item) => item.statusAgendamento === "reservado").length,
      vencidos: items.filter((item) => diffDays(item.prazoResposta) < 0).length,
      preJudicial: items.filter((item) => item.modulo === "pre_judicial").length,
      judicial: items.filter((item) => item.modulo === "judicial").length,
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
