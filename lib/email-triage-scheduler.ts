import { processUnreadEmailTriageV2 } from "@/lib/email-triage-processing-v2"

const INTERVAL_MS = 5 * 60 * 1000
const INITIAL_DELAY_MS = 30 * 1000

declare global {
  var __sigajusEmailTriageSchedulerStarted: boolean | undefined
  var __sigajusEmailTriageSchedulerRunning: boolean | undefined
}

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build"
}

async function runScheduledTriage() {
  if (globalThis.__sigajusEmailTriageSchedulerRunning) return
  globalThis.__sigajusEmailTriageSchedulerRunning = true
  try {
    await processUnreadEmailTriageV2(5000)
  } catch (error) {
    console.error("[email-triage-scheduler] erro:", error)
  } finally {
    globalThis.__sigajusEmailTriageSchedulerRunning = false
  }
}

export function startEmailTriageScheduler() {
  if (typeof window !== "undefined") return
  if (isBuildPhase()) return
  if (process.env.EMAIL_TRIAGEM_AUTO === "false") return
  if (globalThis.__sigajusEmailTriageSchedulerStarted) return

  globalThis.__sigajusEmailTriageSchedulerStarted = true
  setTimeout(() => void runScheduledTriage(), INITIAL_DELAY_MS)
  setInterval(() => void runScheduledTriage(), INTERVAL_MS)
}

startEmailTriageScheduler()
