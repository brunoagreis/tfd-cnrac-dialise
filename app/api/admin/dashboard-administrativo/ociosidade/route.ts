import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

function formatChartDate(value: string) {
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}`
}

export async function GET(req: Request) {
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
        SELECT
          a.id::text AS "id",
          a.data_referencia::text AS "dataReferencia",
          a.monitoramento_id::text AS "monitoramentoId",
          a.usuario_id::text AS "usuarioId",
          a.usuario_nome AS "usuarioNome",
          a.usuario_email AS "usuarioEmail",
          a.iniciado_em AS "iniciadoEm",
          a.finalizado_em AS "finalizadoEm",
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
        ORDER BY a.usuario_id, a.data_referencia, a.iniciado_em
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
        minutosOciosidade: summaryRows.reduce((sum, item) => sum + item.minutosOciosidade, 0),
        maiorIntervaloOcioso: summaryRows.reduce((max, item) => Math.max(max, item.maiorIntervaloOcioso), 0),
      },
      graficos: {
        metaMonitoramentosPorUsuario: {
          diasConsiderados: diasDisponiveis.length,
          metaDiaria: 20,
          meta: metaMonitoramentos,
          usuarios: summaryRows.map((item) => ({
            usuarioId: item.usuarioId,
            usuarioNome: item.usuarioNome,
            quantidade: item.quantidadeMonitoramentos,
            meta: metaMonitoramentos,
          })),
        },
        ociosidadePorUsuario: summaryRows
          .filter((item) => item.minutosOciosidade > 0)
          .map((item) => ({
            usuarioId: item.usuarioId,
            usuarioNome: item.usuarioNome,
            minutosOciosidade: item.minutosOciosidade,
          })),
        totalMonitoramentosPorDia,
        monitoramentosPorUsuarioUltimos5Dias: {
          usuarios: usuariosComMonitoramento,
          dias: ultimos5Dias,
          dados: monitoramentosPorUsuarioUltimos5Dias,
        },
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
