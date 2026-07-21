import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminRequest } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ScheduleRow = {
  id: string
  idUsuario: string
  usuarioNome: string | null
  usuarioEmail: string | null
  diaSemana: number
  horaEntrada: string
  horaEntradaAlmoco: string
  horaRetornoAlmoco: string
  horaSaida: string
}

type MonitorRow = {
  id: string
  dataReferencia: string
  monitoramentoId: string
  usuarioId: string
  usuarioNome: string | null
  usuarioEmail: string | null
  iniciadoEm: Date
  finalizadoEm: Date
  pacienteNome: string | null
  procedimentoCodigo: string | null
  procedimentoDescricao: string | null
  cidCodigo: string | null
  cidDescricao: string | null
}

type FilterUserRow = {
  usuarioId: string
  usuarioNome: string | null
  usuarioEmail: string | null
}

type IdleInterval = {
  dataReferencia: string
  idUsuario: string
  usuarioNome: string
  usuarioEmail: string
  horarioTrabalhoId: string
  tipoIntervalo: string
  inicioOciosidade: Date
  fimOciosidade: Date
  minutosOciosidade: number
  observacao: string
}

type MonitorDetail = {
  id: string
  dataReferencia: string
  monitoramentoId: string
  usuarioId: string
  usuarioNome: string
  usuarioEmail: string
  pacienteNome: string
  procedimento: string
  cid: string
  iniciadoEm: string
  finalizadoEm: string
  minutosMonitoramento: number
}

type SummaryRow = {
  usuarioId: string
  usuarioNome: string
  usuarioEmail: string
  diasComHorario: number
  quantidadeMonitoramentos: number
  minutosMonitorando: number
  minutosOciosidade: number
  maiorIntervaloOcioso: number
  menorTempoMonitoramento: number | null
  maiorTempoMonitoramento: number | null
  mediaTempoMonitoramento: number | null
  primeiroInicio: string | null
  ultimaFinalizacao: string | null
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function toDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function listDates(start: Date, end: Date) {
  const dates: string[] = []
  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    dates.push(toDateOnly(current))
  }
  return dates
}

function buildDateTime(dateText: string, timeText: string) {
  const date = parseDateOnly(dateText)
  if (!date) return null
  const [hour = 0, minute = 0, second = 0] = String(timeText || "00:00:00")
    .slice(0, 8)
    .split(":")
    .map((part) => Number(part))

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Number.isFinite(hour) ? hour : 0,
    Number.isFinite(minute) ? minute : 0,
    Number.isFinite(second) ? second : 0,
  )
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function clampInterval(start: Date, end: Date, min: Date, max: Date) {
  const clampedStart = new Date(Math.max(start.getTime(), min.getTime()))
  const clampedEnd = new Date(Math.min(end.getTime(), max.getTime()))
  if (clampedEnd <= clampedStart) return null
  return { start: clampedStart, end: clampedEnd }
}

function intervalType(label: "before" | "between" | "after" | "empty") {
  if (label === "before") return "ANTES_PRIMEIRO_MONITORAMENTO"
  if (label === "between") return "ENTRE_MONITORAMENTOS"
  if (label === "after") return "APOS_ULTIMO_MONITORAMENTO"
  return "DIA_SEM_MONITORAMENTO"
}

function intervalObservation(type: string) {
  if (type === "ANTES_PRIMEIRO_MONITORAMENTO") return "Tempo entre início da jornada e primeiro monitoramento."
  if (type === "ENTRE_MONITORAMENTOS") return "Tempo entre o fechamento de um monitoramento e a abertura do próximo."
  if (type === "APOS_ULTIMO_MONITORAMENTO") return "Tempo entre último monitoramento e fim da jornada."
  return "Jornada cadastrada sem monitoramentos finalizados no período útil."
}

function safeText(value: unknown) {
  return String(value ?? "").trim()
}

function addToSummary(map: Map<string, SummaryRow>, user: { id: string; nome: string; email: string }) {
  const existing = map.get(user.id)
  if (existing) return existing

  const row: SummaryRow = {
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioEmail: user.email,
    diasComHorario: 0,
    quantidadeMonitoramentos: 0,
    minutosMonitorando: 0,
    minutosOciosidade: 0,
    maiorIntervaloOcioso: 0,
    menorTempoMonitoramento: null,
    maiorTempoMonitoramento: null,
    mediaTempoMonitoramento: null,
    primeiroInicio: null,
    ultimaFinalizacao: null,
  }

  map.set(user.id, row)
  return row
}


function firstNameLabel(value: unknown) {
  const text = String(value ?? "").trim()
  if (!text) return "Não informado"

  return text.split(/\s+/)[0] || "Não informado"
}

function formatChartDate(value: string) {
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}`
}

export async function GET(req: Request) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const { searchParams } = new URL(req.url)
    const today = new Date()
    const defaultDate = toDateOnly(today)
    const startParam = searchParams.get("inicio") || searchParams.get("start") || defaultDate
    const endParam = searchParams.get("fim") || searchParams.get("end") || startParam
    const userId = safeText(searchParams.get("usuarioId") || searchParams.get("userId"))

    const startDate = parseDateOnly(startParam)
    const endDate = parseDateOnly(endParam)

    if (!startDate || !endDate || endDate < startDate) {
      return NextResponse.json(
        { ok: false, error: "Período inválido." },
        { status: 400 },
      )
    }

    const filterUsers = await prisma.$queryRawUnsafe<FilterUserRow[]>(
      `
SELECT
          usuario_id AS "usuarioId",
          MAX(usuario_nome) AS "usuarioNome",
          MAX(usuario_email) AS "usuarioEmail"
        FROM (
          -- Dashboard: todos os usuários cadastrados devem aparecer no filtro,
          -- mesmo sem horário ou monitoramento no período.
          SELECT
            id::text AS usuario_id,
            nome::text AS usuario_nome,
            email::text AS usuario_email
          FROM public.usuarios
          WHERE COALESCE(ativo, TRUE) = TRUE

          UNION ALL

          SELECT
            id_usuario::text AS usuario_id,
            usuario_nome::text AS usuario_nome,
            usuario_email::text AS usuario_email
          FROM public.cadastro_horario_trabalho

          UNION ALL

          SELECT
            usuario_id::text AS usuario_id,
            usuario_nome::text AS usuario_nome,
            usuario_email::text AS usuario_email
          FROM public.judicial_monitoramento_atribuicoes
          WHERE data_referencia BETWEEN $1::date AND $2::date
            AND usuario_id IS NOT NULL
        ) users
        WHERE usuario_id IS NOT NULL
          AND usuario_id <> ''
        GROUP BY usuario_id
ORDER BY MAX(usuario_nome) NULLS LAST, MAX(usuario_email) NULLS LAST, usuario_id
      `,
      startParam,
      endParam,
    )

    const schedules = await prisma.$queryRawUnsafe<ScheduleRow[]>(
      `
        SELECT
          id::text AS "id",
          id_usuario::text AS "idUsuario",
          usuario_nome AS "usuarioNome",
          usuario_email AS "usuarioEmail",
          dia_semana::int AS "diaSemana",
          hora_entrada::text AS "horaEntrada",
          hora_entrada_almoco::text AS "horaEntradaAlmoco",
          hora_retorno_almoco::text AS "horaRetornoAlmoco",
          hora_saida::text AS "horaSaida"
        FROM public.cadastro_horario_trabalho
        WHERE ativo = true
          AND (NULLIF($1::text, '') IS NULL OR id_usuario::text = $1::text)
        ORDER BY id_usuario, dia_semana, id DESC
      `,
      userId,
    )


    const monitors = await prisma.$queryRawUnsafe<MonitorRow[]>(
      `
        WITH monitoramentos_atribuicoes AS (
          SELECT
            a.id::text AS "id",
            a.data_referencia::text AS "dataReferencia",
            a.monitoramento_id::text AS "monitoramentoId",
            a.usuario_id::text AS "usuarioId",
            a.usuario_nome AS "usuarioNome",
            a.usuario_email AS "usuarioEmail",
            -- OCIOSIDADE_FUSO_CAMPO_GRANDE_ATRIBUICOES
            (
              a.iniciado_em AT TIME ZONE 'UTC'
            ) AT TIME ZONE 'America/Campo_Grande' AS "iniciadoEm",
            (
              a.finalizado_em AT TIME ZONE 'UTC'
            ) AT TIME ZONE 'America/Campo_Grande' AS "finalizadoEm",
            b.nome_paciente AS "pacienteNome",
            b.procedimento_codigo AS "procedimentoCodigo",
            b.procedimento_descricao AS "procedimentoDescricao",
            b.cid_codigo AS "cidCodigo",
            b.cid_descricao AS "cidDescricao"
          FROM public.judicial_monitoramento_atribuicoes a
          LEFT JOIN public.judicial_monitoramento_base b
            ON b.id = a.monitoramento_id
          WHERE a.data_referencia BETWEEN $1::date AND $2::date
            AND a.iniciado_em IS NOT NULL
            AND a.finalizado_em IS NOT NULL
            AND a.finalizado_em >= a.iniciado_em
            AND COALESCE(a.status, '') <> 'CANCELADO'
            AND (NULLIF($3::text, '') IS NULL OR a.usuario_id::text = $3::text)
        ),

        movimentacoes_manuais AS (
          SELECT
            (
              'manual_' ||
              COALESCE(m.monitoramento_id::text, m.demanda_id::text, 'sem_monitoramento') ||
              '_' ||
              m.created_by::text ||
              '_' ||
              m.created_at::date::text
            ) AS "id",
            m.created_at::date::text AS "dataReferencia",
            COALESCE(m.monitoramento_id::text, m.demanda_id::text) AS "monitoramentoId",
            m.created_by::text AS "usuarioId",
            COALESCE(NULLIF(TRIM(MAX(m.created_by_name)), ''), m.created_by::text, 'Usuário não informado') AS "usuarioNome",
            NULL::text AS "usuarioEmail",
            MIN(m.created_at) AS "iniciadoEm",
            CASE
              WHEN MAX(m.created_at) > MIN(m.created_at)
                THEN MAX(m.created_at)
              ELSE MIN(m.created_at) + INTERVAL '1 minute'
            END AS "finalizadoEm",
            MAX(b.nome_paciente) AS "pacienteNome",
            MAX(b.procedimento_codigo) AS "procedimentoCodigo",
            MAX(b.procedimento_descricao) AS "procedimentoDescricao",
            MAX(b.cid_codigo) AS "cidCodigo",
            MAX(b.cid_descricao) AS "cidDescricao"
          FROM public.judicial_movimentacoes m
          LEFT JOIN public.judicial_monitoramento_base b
            ON b.id = m.monitoramento_id
          WHERE m.created_at::date BETWEEN $1::date AND $2::date
            AND NULLIF(TRIM(COALESCE(m.created_by, '')), '') IS NOT NULL
            AND (NULLIF($3::text, '') IS NULL OR m.created_by::text = $3::text)
            AND LOWER(COALESCE(m.type, '')) IN (
              'monitoramento',
              'resposta_procuradoria',
              'modelo_enviado',
              'modelo_gerado',
              'envio_modelo',
              'resposta',
              'falta_paciente',
              'cumprimento',
              'procedimento_nao_sus',
              'competencia_municipio',
              'resolvido',
              'encerramento',
              'encerramento_processo',
              'obito',
              'bloqueio',
              'sequestro'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM public.judicial_monitoramento_atribuicoes a
              WHERE a.data_referencia = m.created_at::date
                AND a.monitoramento_id::text = m.monitoramento_id::text
                AND a.finalizado_em IS NOT NULL
                AND COALESCE(a.status, '') <> 'CANCELADO'
                AND (
                  a.usuario_id::text = m.created_by::text
                  OR LOWER(COALESCE(a.usuario_nome, '')) = LOWER(COALESCE(m.created_by_name, ''))
                )
            )
          GROUP BY
            m.created_at::date,
            COALESCE(m.monitoramento_id::text, m.demanda_id::text),
            m.monitoramento_id,
            m.demanda_id,
            m.created_by
        )

        SELECT *
        FROM monitoramentos_atribuicoes

        UNION ALL

        SELECT *
        FROM movimentacoes_manuais

        ORDER BY "usuarioId", "dataReferencia", "iniciadoEm"
      `,
      startParam,
      endParam,
      userId,
    )

    const monitorsByUserDate = new Map<string, MonitorRow[]>()
    const summary = new Map<string, SummaryRow>()
    const monitorDetails: MonitorDetail[] = []

    for (const monitor of monitors) {
      const key = `${monitor.usuarioId}|${monitor.dataReferencia}`
      const list = monitorsByUserDate.get(key) ?? []
      list.push(monitor)
      monitorsByUserDate.set(key, list)

      const user = {
        id: monitor.usuarioId,
        nome: safeText(monitor.usuarioNome) || "Usuário não informado",
        email: safeText(monitor.usuarioEmail),
      }
      const row = addToSummary(summary, user)
      const minutes = minutesBetween(new Date(monitor.iniciadoEm), new Date(monitor.finalizadoEm))
      row.quantidadeMonitoramentos += 1
      row.minutosMonitorando += minutes
      row.menorTempoMonitoramento = row.menorTempoMonitoramento === null ? minutes : Math.min(row.menorTempoMonitoramento, minutes)
      row.maiorTempoMonitoramento = row.maiorTempoMonitoramento === null ? minutes : Math.max(row.maiorTempoMonitoramento, minutes)

      const started = new Date(monitor.iniciadoEm).toISOString()
      const finished = new Date(monitor.finalizadoEm).toISOString()
      if (!row.primeiroInicio || started < row.primeiroInicio) row.primeiroInicio = started
      if (!row.ultimaFinalizacao || finished > row.ultimaFinalizacao) row.ultimaFinalizacao = finished

      monitorDetails.push({
        id: monitor.id,
        dataReferencia: monitor.dataReferencia,
        monitoramentoId: monitor.monitoramentoId,
        usuarioId: monitor.usuarioId,
        usuarioNome: user.nome,
        usuarioEmail: user.email,
        pacienteNome: safeText(monitor.pacienteNome) || "Paciente não informado",
        procedimento: [monitor.procedimentoCodigo, monitor.procedimentoDescricao].filter(Boolean).join(" - "),
        cid: [monitor.cidCodigo, monitor.cidDescricao].filter(Boolean).join(" - "),
        iniciadoEm: started,
        finalizadoEm: finished,
        minutosMonitoramento: minutes,
      })
    }

    const idleIntervals: IdleInterval[] = []
    const dates = listDates(startDate, endDate)

    for (const schedule of schedules) {
      const user = {
        id: schedule.idUsuario,
        nome: safeText(schedule.usuarioNome) || "Usuário não informado",
        email: safeText(schedule.usuarioEmail),
      }
      addToSummary(summary, user)
    }

    const processedUserDates = new Set<string>()

    for (const dateText of dates) {
      const date = parseDateOnly(dateText)
      if (!date) continue
      const weekday = date.getDay()
      if (weekday < 1 || weekday > 5) continue

      const activeUsersForDay = schedules.filter((schedule) => schedule.diaSemana === weekday)

      for (const schedule of activeUsersForDay) {
        const userDateKey = `${schedule.idUsuario}|${dateText}`
        if (processedUserDates.has(userDateKey)) continue
        processedUserDates.add(userDateKey)

        const row = addToSummary(summary, {
          id: schedule.idUsuario,
          nome: safeText(schedule.usuarioNome) || "Usuário não informado",
          email: safeText(schedule.usuarioEmail),
        })
        row.diasComHorario += 1

        const segments = [
          {
            start: buildDateTime(dateText, schedule.horaEntrada),
            end: buildDateTime(dateText, schedule.horaEntradaAlmoco),
          },
          {
            start: buildDateTime(dateText, schedule.horaRetornoAlmoco),
            end: buildDateTime(dateText, schedule.horaSaida),
          },
        ].filter((segment): segment is { start: Date; end: Date } => Boolean(segment.start && segment.end && segment.end > segment.start))

        const dayMonitors = [...(monitorsByUserDate.get(userDateKey) ?? [])]
          .sort((a, b) => new Date(a.iniciadoEm).getTime() - new Date(b.iniciadoEm).getTime())

        // Não considera ociosidade quando o usuário não teve nenhuma
        // atividade registrada no sistema durante o dia.
        if (dayMonitors.length === 0) continue

        for (const segment of segments) {
          const activeIntervals = dayMonitors
            .map((monitor) => clampInterval(new Date(monitor.iniciadoEm), new Date(monitor.finalizadoEm), segment.start, segment.end))
            .filter((item): item is { start: Date; end: Date } => Boolean(item))
            .sort((a, b) => a.start.getTime() - b.start.getTime())

          const merged: Array<{ start: Date; end: Date }> = []
          for (const current of activeIntervals) {
            const previous = merged[merged.length - 1]
            if (previous && current.start <= previous.end) {
              previous.end = new Date(Math.max(previous.end.getTime(), current.end.getTime()))
            } else {
              merged.push({ ...current })
            }
          }

          if (merged.length === 0) {
            const minutes = minutesBetween(segment.start, segment.end)
            if (minutes > 0) {
              const type = intervalType("empty")
              idleIntervals.push({
                dataReferencia: dateText,
                idUsuario: schedule.idUsuario,
                usuarioNome: row.usuarioNome,
                usuarioEmail: row.usuarioEmail,
                horarioTrabalhoId: schedule.id,
                tipoIntervalo: type,
                inicioOciosidade: segment.start,
                fimOciosidade: segment.end,
                minutosOciosidade: minutes,
                observacao: intervalObservation(type),
              })
              row.minutosOciosidade += minutes
              row.maiorIntervaloOcioso = Math.max(row.maiorIntervaloOcioso, minutes)
            }
            continue
          }

          const gaps: Array<{ start: Date; end: Date; label: "before" | "between" | "after" }> = []
          if (merged[0].start > segment.start) {
            gaps.push({ start: segment.start, end: merged[0].start, label: "before" })
          }

          for (let index = 0; index < merged.length - 1; index += 1) {
            if (merged[index + 1].start > merged[index].end) {
              gaps.push({ start: merged[index].end, end: merged[index + 1].start, label: "between" })
            }
          }

          const last = merged[merged.length - 1]
          if (last.end < segment.end) {
            gaps.push({ start: last.end, end: segment.end, label: "after" })
          }

          for (const gap of gaps) {
            const minutes = minutesBetween(gap.start, gap.end)
            if (minutes <= 0) continue
            const type = intervalType(gap.label)
            idleIntervals.push({
              dataReferencia: dateText,
              idUsuario: schedule.idUsuario,
              usuarioNome: row.usuarioNome,
              usuarioEmail: row.usuarioEmail,
              horarioTrabalhoId: schedule.id,
              tipoIntervalo: type,
              inicioOciosidade: gap.start,
              fimOciosidade: gap.end,
              minutosOciosidade: minutes,
              observacao: intervalObservation(type),
            })
            row.minutosOciosidade += minutes
            row.maiorIntervaloOcioso = Math.max(row.maiorIntervaloOcioso, minutes)
          }
        }
      }
    }

    await prisma.$executeRawUnsafe(
      `
        DELETE FROM public.tempo_ociosidade_usuario
        WHERE data_referencia BETWEEN $1::date AND $2::date
          AND (NULLIF($3::text, '') IS NULL OR id_usuario::text = $3::text)
      `,
      startParam,
      endParam,
      userId,
    )

    for (const item of idleIntervals) {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO public.tempo_ociosidade_usuario (
            data_referencia,
            id_usuario,
            usuario_nome,
            usuario_email,
            horario_trabalho_id,
            tipo_intervalo,
            inicio_ociosidade,
            fim_ociosidade,
            minutos_ociosidade,
            observacao,
            created_at,
            updated_at
          ) VALUES (
            $1::date,
            $2,
            $3,
            $4,
            $5::bigint,
            $6,
            $7::timestamptz,
            $8::timestamptz,
            $9::int,
            $10,
            NOW(),
            NOW()
          )
        `,
        item.dataReferencia,
        item.idUsuario,
        item.usuarioNome,
        item.usuarioEmail,
        item.horarioTrabalhoId,
        item.tipoIntervalo,
        item.inicioOciosidade,
        item.fimOciosidade,
        item.minutosOciosidade,
        item.observacao,
      )
    }

    const summaryRows = Array.from(summary.values())
      .map((row) => ({
        ...row,
        mediaTempoMonitoramento:
          row.quantidadeMonitoramentos > 0
            ? Math.round(row.minutosMonitorando / row.quantidadeMonitoramentos)
            : null,
      }))
      .sort((a, b) => b.minutosOciosidade - a.minutosOciosidade)


    const diasDisponiveis = Array.from(new Set(monitors.map((monitor) => monitor.dataReferencia))).sort()
    const metaMonitoramentos = diasDisponiveis.length * 20

    const totalByDay = new Map<string, number>()
    for (const monitor of monitors) {
      totalByDay.set(monitor.dataReferencia, (totalByDay.get(monitor.dataReferencia) ?? 0) + 1)
    }
    const totalMonitoramentosPorDia = diasDisponiveis.slice(-30).map((date) => ({
      dataReferencia: date,
      label: formatChartDate(date),
      quantidade: totalByDay.get(date) ?? 0,
    }))

    const usuariosComMonitoramento = Array.from(
      new Set(monitors.map((monitor) => safeText(monitor.usuarioNome) || monitor.usuarioId)),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"))

    const ultimos5Dias = diasDisponiveis.slice(-5)
    const monitoramentosPorUsuarioUltimos5Dias = ultimos5Dias.map((date) => {
      const row: Record<string, string | number> = {
        dataReferencia: date,
        label: formatChartDate(date),
      }
      for (const userName of usuariosComMonitoramento) {
        row[userName] = monitors.filter(
          (monitor) => monitor.dataReferencia === date && (safeText(monitor.usuarioNome) || monitor.usuarioId) === userName,
        ).length
      }
      return row
    })

    const minutosMonitorandoTotal = summaryRows.reduce((sum, item) => sum + item.minutosMonitorando, 0)
    const monitoramentosTotal = summaryRows.reduce((sum, item) => sum + item.quantidadeMonitoramentos, 0)

    const cardsPrincipaisDashboard = await (async () => {
      const usuarioFiltro = userId || null
      const toNumber = (value: unknown) => Number(value ?? 0) || 0

      const tempoOciosoHojeRows = await prisma.$queryRawUnsafe<Array<{
        minutosOciosidade: unknown
        maiorIntervaloOcioso: unknown
      }>>(
        `
          SELECT
            COALESCE(SUM(minutos_ociosidade), 0)::int AS "minutosOciosidade",
            COALESCE(MAX(minutos_ociosidade), 0)::int AS "maiorIntervaloOcioso"
          FROM public.tempo_ociosidade_usuario
          WHERE data_referencia BETWEEN $1::date AND $2::date
            AND ($3::text IS NULL OR id_usuario = $3::text)
        `,
      startParam,
      endParam,
      usuarioFiltro,
    )

      const osRows = await prisma.$queryRawUnsafe<Array<{
        osAtribuidas: unknown
        osNaoAtribuidas: unknown
      }>>(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE UPPER(COALESCE(status, '')) = 'ATRIBUIDA'
                AND convertido_em IS NULL
                AND NULLIF(TRIM(COALESCE(convertido_demanda_id, '')), '') IS NULL
                AND NULLIF(TRIM(COALESCE(convertido_protocolo, '')), '') IS NULL
            )::int AS "osAtribuidas",

            COUNT(*) FILTER (
              WHERE NULLIF(TRIM(COALESCE(responsavel_id, '')), '') IS NULL
                AND convertido_em IS NULL
                AND NULLIF(TRIM(COALESCE(convertido_demanda_id, '')), '') IS NULL
                AND NULLIF(TRIM(COALESCE(convertido_protocolo, '')), '') IS NULL
                AND UPPER(COALESCE(status, '')) NOT IN (
                  'CONVERTIDA',
                  'INATIVA',
                  'CANCELADA',
                  'CANCELADO',
                  'CONCLUIDA',
                  'CONCLUÍDA'
                )
            )::int AS "osNaoAtribuidas"
          FROM public.judicial_email_os
          WHERE ($1::text IS NULL OR responsavel_id = $1::text)
        `,
        usuarioFiltro,
      )

      const filaAgendamentoRows = await prisma.$queryRawUnsafe<Array<{
        status: string
        total: unknown
      }>>(
        `
          WITH pre AS (
            SELECT
              CASE
                WHEN c.scheduling_status = 'para_avaliar' THEN 'para_avaliar'
                WHEN c.scheduling_status IN ('para_agendar', 'apto_agendamento') THEN 'para_agendar'
                ELSE NULL
              END AS status
            FROM public.pre_judicial_casos c
            WHERE COALESCE(c.active, TRUE) = TRUE
              AND c.scheduling_status IN ('para_avaliar', 'para_agendar', 'apto_agendamento')
              AND ($1::text IS NULL OR c.created_by = $1::text)
          ),

          judicial_latest AS (
            SELECT DISTINCT ON (m.monitoramento_id)
              m.monitoramento_id,
              LOWER(COALESCE(m.type, '')) AS type,
              m.created_by,
              m.created_at
            FROM public.judicial_movimentacoes m
            WHERE LOWER(COALESCE(m.type, '')) IN (
              'envio_agendamento_demanda',
              'encaminhar_direto_agendamento',
              'analise_viabilidade_apta_agendamento',
              'apta_agendamento',
              'apto_agendamento',
              'agendamento',
              'retorno_fila',
              'analise_viabilidade_nao_rede',
              'analise_viabilidade_complementacao'
            )
            ORDER BY m.monitoramento_id, m.created_at DESC
          ),

          judicial AS (
            SELECT
              CASE
                WHEN jl.type = 'envio_agendamento_demanda' THEN 'para_avaliar'
                WHEN jl.type IN (
                  'encaminhar_direto_agendamento',
                  'analise_viabilidade_apta_agendamento',
                  'apta_agendamento',
                  'apto_agendamento'
                ) THEN 'para_agendar'
                ELSE NULL
              END AS status
            FROM judicial_latest jl
            INNER JOIN public.judicial_monitoramento_base b
              ON b.id = jl.monitoramento_id
            WHERE COALESCE(b.ativo_monitoramento, TRUE) = TRUE
              AND UPPER(COALESCE(b.origem_modulo, 'JUDICIAL')) = 'JUDICIAL'
              AND ($1::text IS NULL OR jl.created_by = $1::text)
          )

          SELECT
            status,
            COUNT(*)::int AS total
          FROM (
            SELECT status FROM pre
            UNION ALL
            SELECT status FROM judicial
          ) fila
          WHERE status IS NOT NULL
          GROUP BY status
        `,
        usuarioFiltro,
      )

      const cadastrosHojeRows = await prisma.$queryRawUnsafe<Array<{
        total: unknown
      }>>(
        `
          WITH cadastros AS (
            SELECT
              COALESCE(NULLIF(TRIM("criadoPor"), ''), 'nao_informado') AS usuario_id,
              "createdAt"::date AS data_cadastro
            FROM public.demandas

            UNION ALL

            SELECT
              COALESCE(NULLIF(TRIM(created_by), ''), 'nao_informado') AS usuario_id,
              created_at::date AS data_cadastro
            FROM public.pre_judicial_casos
          )

          SELECT COUNT(*)::int AS total
          FROM cadastros
          WHERE data_cadastro = CURRENT_DATE
            AND ($1::text IS NULL OR usuario_id = $1::text)
        `,
        usuarioFiltro,
      )

      const tempo = tempoOciosoHojeRows[0] ?? {
        minutosOciosidade: 0,
        maiorIntervaloOcioso: 0,
      }

      const os = osRows[0] ?? {
        osAtribuidas: 0,
        osNaoAtribuidas: 0,
      }

      const paraAvaliar = filaAgendamentoRows
        .filter((item) => item.status === "para_avaliar")
        .reduce((sum, item) => sum + toNumber(item.total), 0)

      const paraAgendar = filaAgendamentoRows
        .filter((item) => item.status === "para_agendar")
        .reduce((sum, item) => sum + toNumber(item.total), 0)

      return {
        minutosOciosidade: toNumber(tempo.minutosOciosidade),
        maiorIntervaloOcioso: toNumber(tempo.maiorIntervaloOcioso),
        osAtribuidas: toNumber(os.osAtribuidas),
        osNaoAtribuidas: toNumber(os.osNaoAtribuidas),
        paraAvaliar,
        paraAgendar,
        cadastrosHoje: toNumber(cadastrosHojeRows[0]?.total),
      }
    })()

    const graficosExtrasDashboard = await (async () => {
      const usuarioFiltro = userId || null
      const toNumber = (value: unknown) => Number(value ?? 0) || 0

      /**
       * 1. Para avaliar x Para agendar
       * Usa os mesmos valores dos cards principais.
       */
      const agendamentoStatus = [
        {
          status: "para_avaliar",
          label: "Para avaliar",
          total: cardsPrincipaisDashboard.paraAvaliar,
        },
        {
          status: "para_agendar",
          label: "Para agendar",
          total: cardsPrincipaisDashboard.paraAgendar,
        },
      ].filter((item) => item.total > 0)

      /**
       * 2. Enviado x Devolvido x Agendado
       */
      const fluxoAgendamentoRows = await prisma.$queryRawUnsafe<Array<{
        categoria: string
        total: unknown
      }>>(
        `
          WITH categorias AS (
            SELECT 'Enviado para agendar'::text AS categoria
            UNION ALL SELECT 'Devolvido'::text
            UNION ALL SELECT 'Agendado'::text
          ),

          eventos AS (
            SELECT
              CASE
                WHEN LOWER(COALESCE(type, '')) IN (
                  'envio_agendamento_demanda',
                  'encaminhar_direto_agendamento',
                  'analise_viabilidade_apta_agendamento',
                  'apta_agendamento',
                  'apto_agendamento'
                ) THEN 'Enviado para agendar'

                WHEN LOWER(COALESCE(type, '')) IN (
                  'retorno_fila',
                  'analise_viabilidade_nao_rede',
                  'analise_viabilidade_complementacao'
                ) THEN 'Devolvido'

                WHEN LOWER(COALESCE(type, '')) = 'agendado'
                  THEN 'Agendado'

                ELSE NULL
              END AS categoria
            FROM public.pre_judicial_movimentacoes
            WHERE created_at::date BETWEEN $1::date AND $2::date
              AND ($3::text IS NULL OR created_by = $3::text)

            UNION ALL

            SELECT
              CASE
                WHEN LOWER(COALESCE(type, '')) IN (
                  'envio_agendamento_demanda',
                  'encaminhar_direto_agendamento',
                  'analise_viabilidade_apta_agendamento',
                  'apta_agendamento',
                  'apto_agendamento'
                ) THEN 'Enviado para agendar'

                WHEN LOWER(COALESCE(type, '')) IN (
                  'retorno_fila',
                  'analise_viabilidade_nao_rede',
                  'analise_viabilidade_complementacao'
                ) THEN 'Devolvido'

                WHEN LOWER(COALESCE(type, '')) = 'agendamento'
                  THEN 'Agendado'

                ELSE NULL
              END AS categoria
            FROM public.judicial_movimentacoes
            WHERE created_at::date BETWEEN $1::date AND $2::date
              AND ($3::text IS NULL OR created_by = $3::text)
          )

          SELECT
            c.categoria,
            COALESCE(COUNT(e.categoria), 0)::int AS total
          FROM categorias c
          LEFT JOIN eventos e
            ON e.categoria = c.categoria
          GROUP BY c.categoria
          ORDER BY
            CASE c.categoria
              WHEN 'Enviado para agendar' THEN 1
              WHEN 'Devolvido' THEN 2
              WHEN 'Agendado' THEN 3
              ELSE 9
            END
        `,
        startParam,
        endParam,
        usuarioFiltro,
      )

      /**
       * 3. OS atribuídas por usuário.
       */
      const osPorUsuarioRows = await prisma.$queryRawUnsafe<Array<{
        usuarioId: string
        usuarioNome: string
        total: unknown
      }>>(
        `
          -- DASHBOARD_OS_ATRIBUIDAS_MESMA_FILA_EMAIL_OS_200
          WITH fila_email_os AS (
            SELECT
              os.*
            FROM public.judicial_email_os os
            WHERE COALESCE(
              os.status,
              'AGUARDANDO_CADASTRO'
            ) NOT IN (
              'CONVERTIDA',
              'CADASTRADA',
              'CADASTRADO',
              'CONCLUIDA',
              'CONCLUÍDA',
              'INATIVA'
            )
            ORDER BY
              os.created_at DESC,
              os.id DESC
            LIMIT 200
          )

          SELECT
            COALESCE(
              NULLIF(TRIM(os.responsavel_id), ''),
              'nao_informado'
            ) AS "usuarioId",

            COALESCE(
              NULLIF(TRIM(MAX(os.responsavel_nome)), ''),
              NULLIF(TRIM(MAX(os.responsavel_email)), ''),
              'Não informado'
            ) AS "usuarioNome",

            COUNT(*)::int AS total

          FROM fila_email_os os

          WHERE NULLIF(
            TRIM(COALESCE(os.responsavel_id, '')),
            ''
          ) IS NOT NULL

            AND UPPER(
              TRIM(COALESCE(os.status, ''))
            ) = 'ATRIBUIDA'

            AND os.convertido_em IS NULL

            AND NULLIF(
              TRIM(COALESCE(
                os.convertido_demanda_id::text,
                ''
              )),
              ''
            ) IS NULL

            AND NULLIF(
              TRIM(COALESCE(
                os.convertido_protocolo,
                ''
              )),
              ''
            ) IS NULL

            AND LOWER(
              TRIM(COALESCE(os.assunto, ''))
            ) <> 'delivery status notification (failure)'

            AND NOT EXISTS (
              SELECT 1

              FROM public.judicial_email_processados ep

              WHERE ep.os_id::text = os.id::text
                AND (
                  NULLIF(
                    TRIM(COALESCE(
                      ep.demanda_id::text,
                      ''
                    )),
                    ''
                  ) IS NOT NULL

                  OR UPPER(
                    TRIM(COALESCE(ep.status, ''))
                  ) IN (
                    'DEMANDA_CADASTRADA',
                    'CONVERTIDA',
                    'CADASTRADA',
                    'CADASTRADO',
                    'CONCLUIDA',
                    'CONCLUÍDA',
                    'INATIVA'
                  )
                )
            )

            AND (
              $1::text IS NULL
              OR os.responsavel_id = $1::text
            )

          GROUP BY
            COALESCE(
              NULLIF(TRIM(os.responsavel_id), ''),
              'nao_informado'
            )

          ORDER BY total DESC
        `,
        usuarioFiltro,
      )

      /**
       * 4. Cadastros por usuário no período.
       */
      const cadastrosPorUsuarioRows = await prisma.$queryRawUnsafe<Array<{
        usuarioId: string
        usuarioNome: string
        total: unknown
      }>>(
        `
          WITH cadastros AS (
            SELECT
              COALESCE(NULLIF(TRIM("criadoPor"), ''), 'nao_informado') AS usuario_id,
              COALESCE(NULLIF(TRIM("criadoPorNome"), ''), NULLIF(TRIM("criadoPor"), ''), 'Não informado') AS usuario_nome,
              "createdAt"::date AS data_cadastro
            FROM public.demandas

            UNION ALL

            SELECT
              COALESCE(NULLIF(TRIM(created_by), ''), 'nao_informado') AS usuario_id,
              COALESCE(NULLIF(TRIM(created_by_name), ''), NULLIF(TRIM(created_by), ''), 'Não informado') AS usuario_nome,
              created_at::date AS data_cadastro
            FROM public.pre_judicial_casos
          )

          SELECT
            usuario_id AS "usuarioId",
            MAX(usuario_nome) AS "usuarioNome",
            COUNT(*)::int AS total
          FROM cadastros
          WHERE data_cadastro BETWEEN $1::date AND $2::date
            AND ($3::text IS NULL OR usuario_id = $3::text)
          GROUP BY usuario_id
          ORDER BY total DESC
        `,
        startParam,
        endParam,
        usuarioFiltro,
      )

      /**
       * 5. Monitoramento automático e total no período.
       */
      const automaticosRows = await prisma.$queryRawUnsafe<Array<{
        total: unknown
      }>>(
        `
          SELECT COUNT(*)::int AS total
          FROM public.judicial_movimentacoes
          WHERE created_at::date BETWEEN $1::date AND $2::date
            AND (
              LOWER(COALESCE(type, '')) IN (
                'core_automatico',
                'monitoramento_automatico',
                'monitoramento_automatico_core',
                'monitoramento_core',
                'retorno_core',
                'atualizacao_core'
              )
              OR LOWER(COALESCE(created_by, '')) IN ('sistema', 'automatico', 'core_automatico')
              OR LOWER(COALESCE(created_by_name, '')) IN ('sistema', 'automatico', 'automático')
            )
            AND ($3::text IS NULL OR created_by = $3::text)
        `,
        startParam,
        endParam,
        usuarioFiltro,
      )

      // DASHBOARD_TOTAL_MONITORAMENTOS_HUMANO_AUTOMATICO
      const monitoramentosAutomaticosTotal = toNumber(automaticosRows[0]?.total)
      const monitoramentosPeriodoTotal =
        monitoramentosTotal + monitoramentosAutomaticosTotal
      // DASHBOARD_ATRIBUIDOS_X_MONITORADOS_PROTOCOLos
      const atribuidosMonitoradosRows =
        await prisma.$queryRawUnsafe<Array<{
          atribuidos: unknown
          monitorados: unknown
        }>>(
          `
          WITH atribuicoes AS (
            SELECT DISTINCT
              a.monitoramento_id,
              a.usuario_id
            FROM public.judicial_monitoramento_atribuicoes a
            INNER JOIN public.judicial_monitoramento_base b
              ON b.id = a.monitoramento_id
            WHERE a.data_referencia BETWEEN $1::date AND $2::date
              AND UPPER(
                COALESCE(b.origem_modulo, 'JUDICIAL')
              ) = 'JUDICIAL'
              AND (
                $3::text IS NULL
                OR a.usuario_id = $3::text
              )

            UNION

            SELECT DISTINCT
              m.monitoramento_id,
              m.usuario_id
            FROM public.judicial_monitoramento_atribuicoes_manuais m
            INNER JOIN public.judicial_monitoramento_base b
              ON b.id = m.monitoramento_id
            WHERE (
              m.atribuida_em
              AT TIME ZONE 'America/Campo_Grande'
            )::date BETWEEN $1::date AND $2::date
              AND UPPER(
                COALESCE(b.origem_modulo, 'JUDICIAL')
              ) = 'JUDICIAL'
              AND (
                $3::text IS NULL
                OR m.usuario_id = $3::text
              )
          ),

          monitorados AS (
            SELECT DISTINCT
              a.monitoramento_id
            FROM public.judicial_monitoramento_atribuicoes a
            INNER JOIN atribuicoes atribuicao
              ON atribuicao.monitoramento_id = a.monitoramento_id
              AND atribuicao.usuario_id = a.usuario_id
            WHERE a.finalizado_em IS NOT NULL
              AND (
                a.finalizado_em
                AT TIME ZONE 'America/Campo_Grande'
              )::date BETWEEN $1::date AND $2::date
              AND UPPER(
                COALESCE(a.status, '')
              ) <> 'CANCELADO'
              AND (
                $3::text IS NULL
                OR a.usuario_id = $3::text
              )

            UNION

            SELECT DISTINCT
              movimento.monitoramento_id
            FROM public.judicial_movimentacoes movimento
            INNER JOIN atribuicoes atribuicao
              ON atribuicao.monitoramento_id =
                movimento.monitoramento_id
              AND atribuicao.usuario_id =
                movimento.created_by
            WHERE movimento.monitoramento_id IS NOT NULL
              AND (
                movimento.created_at
                AT TIME ZONE 'America/Campo_Grande'
              )::date BETWEEN $1::date AND $2::date
              AND (
                $3::text IS NULL
                OR movimento.created_by = $3::text
              )
              AND LOWER(
                COALESCE(movimento.type, '')
              ) IN (
                'monitoramento',
                'resposta_procuradoria',
                'modelo_enviado',
                'modelo_gerado',
                'envio_modelo',
                'resposta',
                'falta_paciente',
                'cumprimento',
                'procedimento_nao_sus',
                'competencia_municipio',
                'resolvido',
                'encerramento',
                'encerramento_processo',
                'obito',
                'bloqueio',
                'sequestro'
              )
          )

          SELECT
            COUNT(
              DISTINCT atribuicao.monitoramento_id
            )::int AS "atribuidos",

            COUNT(
              DISTINCT monitorado.monitoramento_id
            )::int AS "monitorados"

          FROM atribuicoes atribuicao

          LEFT JOIN monitorados monitorado
            ON monitorado.monitoramento_id =
              atribuicao.monitoramento_id
          `,
          startParam,
          endParam,
          usuarioFiltro,
        )
      const atividadePorUsuario = new Map<string, {
        usuarioId: string
        usuarioNome: string
        osAtribuidas: number
        cadastros: number
        monitoramentos: number
      }>()

      function firstName(value: unknown) {
        const text = String(value ?? "").trim()
        if (!text) return "Não informado"
        return text.split(/\s+/)[0] || "Não informado"
      }

      function ensureUsuario(usuarioIdValue: string, usuarioNomeValue: string) {
        const key = usuarioIdValue || usuarioNomeValue || "nao_informado"
        const existing = atividadePorUsuario.get(key)
        if (existing) return existing

        const created = {
          usuarioId: key,
          usuarioNome: firstName(usuarioNomeValue || key),
          osAtribuidas: 0,
          cadastros: 0,
          monitoramentos: 0,
        }

        atividadePorUsuario.set(key, created)

        return created
      }

      for (const item of osPorUsuarioRows) {
        const row = ensureUsuario(item.usuarioId, item.usuarioNome)
        row.osAtribuidas += toNumber(item.total)
      }

      for (const item of cadastrosPorUsuarioRows) {
        const row = ensureUsuario(item.usuarioId, item.usuarioNome)
        row.cadastros += toNumber(item.total)
      }

      for (const item of summaryRows) {
        const row = ensureUsuario(item.usuarioId, item.usuarioNome)
        row.monitoramentos += item.quantidadeMonitoramentos
      }

      const produtividadeUsuarios = Array.from(atividadePorUsuario.values())
        .filter(
          (item) =>
            item.osAtribuidas > 0 ||
            item.cadastros > 0 ||
            item.monitoramentos > 0,
        )
        .sort(
          (a, b) =>
            b.osAtribuidas +
            b.cadastros +
            b.monitoramentos -
            (a.osAtribuidas + a.cadastros + a.monitoramentos),
        )

      const fluxoAgendamento = fluxoAgendamentoRows
        .map((item) => ({
          categoria: item.categoria,
          total: toNumber(item.total),
        }))
        .filter((item) => item.total > 0)

      return {
        agendamentoStatus,
        fluxoAgendamento,
        osCadastrosPorUsuario: produtividadeUsuarios
          .filter((item) => item.osAtribuidas > 0 || item.cadastros > 0)
          .map((item) => ({
            usuarioId: item.usuarioId,
            usuarioNome: item.usuarioNome,
            osAtribuidas: item.osAtribuidas,
            cadastros: item.cadastros,
          })),
        cadastrosMonitoramentosPorUsuario: produtividadeUsuarios
          .filter((item) => item.cadastros > 0 || item.monitoramentos > 0)
          .map((item) => ({
            usuarioId: item.usuarioId,
            usuarioNome: item.usuarioNome,
            cadastros: item.cadastros,
            monitoramentos: item.monitoramentos,
          })),
        atribuidosMonitoradosPeriodo: [
          {
            label: "Período selecionado",
            atribuidos: toNumber(
              atribuidosMonitoradosRows[0]?.atribuidos,
            ),
            monitorados: toNumber(
              atribuidosMonitoradosRows[0]?.monitorados,
            ),
          },
        ],
        tipoMonitoramento: [
          {
            label: "Monitoramento humano",
            total: monitoramentosTotal,
          },
          {
            label: "Monitoramento automático",
            total: monitoramentosAutomaticosTotal,
          },
          {
            label: "Monitorados no período",
            total: monitoramentosPeriodoTotal,
          },
        ].filter((item) => item.total > 0),
      }
    })()








    const ociosidadeGraficoRows = await prisma.$queryRawUnsafe<Array<{
      usuarioId: string
      usuarioNome: string
      minutosOciosidade: unknown
      maiorIntervaloOcioso: unknown
    }>>(
      `
        SELECT
          id_usuario::text AS "usuarioId",
          COALESCE(NULLIF(TRIM(MAX(usuario_nome)), ''), id_usuario::text, 'Não informado') AS "usuarioNome",
          COALESCE(SUM(minutos_ociosidade), 0)::int AS "minutosOciosidade",
          COALESCE(MAX(minutos_ociosidade), 0)::int AS "maiorIntervaloOcioso"
        FROM public.tempo_ociosidade_usuario
        WHERE data_referencia BETWEEN $1::date AND $2::date
          AND ($3::text IS NULL OR id_usuario::text = $3::text)
        GROUP BY id_usuario
        HAVING COALESCE(SUM(minutos_ociosidade), 0) > 0
        ORDER BY COALESCE(SUM(minutos_ociosidade), 0) DESC
      `,
      startParam,
      endParam,
      userId || null,
    )

    return NextResponse.json({
      ok: true,
      periodo: { inicio: startParam, fim: endParam },
      filtros: {
        usuarios: filterUsers.map((item) => ({
          usuarioId: item.usuarioId,
          usuarioNome: safeText(item.usuarioNome) || item.usuarioId,
          usuarioEmail: safeText(item.usuarioEmail),
        })),
      },
      resumo: {
        usuarios: summaryRows.length,
        monitoramentos: monitoramentosTotal,
        minutosMonitorando: minutosMonitorandoTotal,
        mediaTempoMonitoramento: monitoramentosTotal > 0 ? Math.round(minutosMonitorandoTotal / monitoramentosTotal) : 0,
        minutosOciosidade: cardsPrincipaisDashboard.minutosOciosidade,
        maiorIntervaloOcioso: cardsPrincipaisDashboard.maiorIntervaloOcioso,
        osAtribuidas: cardsPrincipaisDashboard.osAtribuidas,
        osNaoAtribuidas: cardsPrincipaisDashboard.osNaoAtribuidas,
        paraAvaliar: cardsPrincipaisDashboard.paraAvaliar,
        paraAgendar: cardsPrincipaisDashboard.paraAgendar,
        cadastrosHoje: cardsPrincipaisDashboard.cadastrosHoje,
      },
      graficos: {
        metaMonitoramentosPorUsuario: {
          diasConsiderados: diasDisponiveis.length,
          metaDiaria: 20,
          meta: metaMonitoramentos,
          usuarios: summaryRows
            .filter((item) => item.quantidadeMonitoramentos > 0)
            .map((item) => ({
              usuarioId: item.usuarioId,
              usuarioNome: firstNameLabel(item.usuarioNome),
              quantidadeMonitoramentos: item.quantidadeMonitoramentos,
              quantidade: item.quantidadeMonitoramentos,
              monitoramentos: item.quantidadeMonitoramentos,
              total: item.quantidadeMonitoramentos,
              meta: metaMonitoramentos,
            })),
        },
        ociosidadePorUsuario: ociosidadeGraficoRows.map((item) => ({
          usuarioId: item.usuarioId,
          usuarioNome: firstNameLabel(item.usuarioNome),
          minutosOciosidade: Number(item.minutosOciosidade ?? 0) || 0,
          maiorIntervaloOcioso: Number(item.maiorIntervaloOcioso ?? 0) || 0,
        })),
        totalMonitoramentosPorDia,
        monitoramentosPorUsuarioUltimos5Dias: {
          usuarios: usuariosComMonitoramento,
          dias: ultimos5Dias,
          dados: monitoramentosPorUsuarioUltimos5Dias,
        },
        agendamentoStatus: graficosExtrasDashboard.agendamentoStatus,
        fluxoAgendamento: graficosExtrasDashboard.fluxoAgendamento,
        osCadastrosPorUsuario: graficosExtrasDashboard.osCadastrosPorUsuario,
        cadastrosMonitoramentosPorUsuario: graficosExtrasDashboard.cadastrosMonitoramentosPorUsuario,
        atribuidosMonitoradosPeriodo:
          graficosExtrasDashboard.atribuidosMonitoradosPeriodo,
        tipoMonitoramento: graficosExtrasDashboard.tipoMonitoramento,
      },
      usuarios: summaryRows,
      intervalos: idleIntervals.map((item) => ({
        ...item,
        inicioOciosidade: item.inicioOciosidade.toISOString(),
        fimOciosidade: item.fimOciosidade.toISOString(),
      })),
      monitoramentos: monitorDetails.sort((a, b) => a.iniciadoEm.localeCompare(b.iniciadoEm)),
    })
  } catch (error) {
    console.error("DASHBOARD_ADMINISTRATIVO_OCIosidade_ERROR", error)
    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao calcular dashboard administrativo.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
