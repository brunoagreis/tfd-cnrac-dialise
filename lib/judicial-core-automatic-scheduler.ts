import { appendFile, mkdir } from "fs/promises"
import path from "path"

const CORE_AUTOMATIC_TASK_KEY = "__sigajusCoreAutomaticScheduler"
const CHECK_INTERVAL_MS = 15 * 60 * 1000
const DEFAULT_BASE_URL = "http://127.0.0.1:3000"
const TARGET_HOUR = 6
const TARGET_MINUTE = 0

type SchedulerState = {
  started: boolean
  running: boolean
  lastRunDate: string | null
  timer?: ReturnType<typeof setInterval>
}

declare global {
  // eslint-disable-next-line no-var
  var __sigajusCoreAutomaticScheduler: SchedulerState | undefined
}

function getState(): SchedulerState {
  if (!globalThis[CORE_AUTOMATIC_TASK_KEY as keyof typeof globalThis]) {
    globalThis.__sigajusCoreAutomaticScheduler = {
      started: false,
      running: false,
      lastRunDate: null,
    }
  }

  return globalThis.__sigajusCoreAutomaticScheduler!
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function localDateTime(date = new Date()) {
  return date.toLocaleString("pt-BR")
}

async function appendSchedulerLog(message: string) {
  try {
    const logsDir = process.env.SIGAJUS_LOG_DIR || path.join(process.cwd(), "logs")
    await mkdir(logsDir, { recursive: true })
    await appendFile(
      path.join(logsDir, "core-automatico-interno.log"),
      `[${localDateTime()}] ${message}\n`,
      "utf8",
    )
  } catch (error) {
    console.error("[CORE automático] Erro ao registrar log interno:", error)
  }
}

function shouldRunNow(state: SchedulerState, now = new Date()) {
  const dateKey = localDateKey(now)
  if (state.lastRunDate === dateKey) return false

  const hour = now.getHours()
  const minute = now.getMinutes()

  if (hour > TARGET_HOUR) return true
  if (hour === TARGET_HOUR && minute >= TARGET_MINUTE) return true

  return false
}

async function runCoreAutomaticMonitoring(state: SchedulerState) {
  if (state.running) return

  state.running = true

  try {
    const baseUrl = process.env.SIGAJUS_INTERNAL_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL
    await appendSchedulerLog(`Executando monitoramento automático CORE em ${baseUrl}.`)

    const response = await fetch(`${baseUrl}/api/judicial/monitoramento/core-automatico`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 200 }),
      cache: "no-store",
    })

    const body = await response.text()

    if (!response.ok) {
      const message = `Falha HTTP ${response.status}: ${body}`
      console.error(`[CORE automático] ${message}`)
      await appendSchedulerLog(message)
      return
    }

    state.lastRunDate = localDateKey()
    const message = `Execução concluída: ${body}`
    console.log(`[CORE automático] ${message}`)
    await appendSchedulerLog(message)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error("[CORE automático] Erro ao executar agendador interno:", error)
    await appendSchedulerLog(`Erro ao executar agendador interno: ${detail}`)
  } finally {
    state.running = false
  }
}

function checkCoreAutomaticMonitoring() {
  const state = getState()
  if (!shouldRunNow(state)) return

  void runCoreAutomaticMonitoring(state)
}

export function startCoreAutomaticScheduler() {
  const state = getState()

  if (state.started) return

  state.started = true

  const message = "Agendador interno iniciado para execução diária às 06:00."
  console.log(`[CORE automático] ${message}`)
  void appendSchedulerLog(message)

  setTimeout(checkCoreAutomaticMonitoring, 2 * 60 * 1000)
  state.timer = setInterval(checkCoreAutomaticMonitoring, CHECK_INTERVAL_MS)
}
