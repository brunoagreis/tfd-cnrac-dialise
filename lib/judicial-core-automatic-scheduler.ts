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
      console.error(`[CORE automático] Falha HTTP ${response.status}: ${body}`)
      return
    }

    state.lastRunDate = localDateKey()
    console.log(`[CORE automático] Execução concluída: ${body}`)
  } catch (error) {
    console.error("[CORE automático] Erro ao executar agendador interno:", error)
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

  console.log("[CORE automático] Agendador interno iniciado para execução diária às 06:00.")

  setTimeout(checkCoreAutomaticMonitoring, 2 * 60 * 1000)
  state.timer = setInterval(checkCoreAutomaticMonitoring, CHECK_INTERVAL_MS)
}
