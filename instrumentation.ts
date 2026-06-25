const FIVE_MINUTES = 5 * 60 * 1000
const INITIAL_DELAY = 30 * 1000

declare global {
  var __sigajusMailLoopStarted: boolean | undefined
}

function nextRun() {
  return new Date(Date.now() + FIVE_MINUTES).toISOString()
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return

  const { startCoreAutomaticScheduler } = await import("./lib/judicial-core-automatic-scheduler")
  startCoreAutomaticScheduler()

  if (process.env.EMAIL_TRIAGEM_AUTO_SERVER !== "true") return
  if (globalThis.__sigajusMailLoopStarted) return

  globalThis.__sigajusMailLoopStarted = true
  const { startEmailTriageJob } = await import("./lib/email-triage-job")
  const run = () => void startEmailTriageJob("servidor", nextRun()).catch((error) => console.error("[mail-loop] erro:", error))
  setTimeout(run, INITIAL_DELAY)
  setInterval(run, FIVE_MINUTES)
}
