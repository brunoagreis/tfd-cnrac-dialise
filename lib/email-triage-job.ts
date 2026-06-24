import { prisma } from "@/lib/prisma"
import { processUnreadEmailTriageV2 } from "@/lib/email-triage-processing-v2"

const ID = "default"
const FIVE_MIN = 5 * 60 * 1000

type StatusRow = {
  running: boolean | null
  source: string | null
  lastStartedAt: string | null
  lastFinishedAt: string | null
  nextRunAt: string | null
  lastOk: boolean | null
  lastMessage: string | null
  lastProcessed: number | string | bigint | null
  updatedAt: string | null
}

declare global {
  var __sigajusEmailTriageJobRunning: boolean | undefined
}

function nextIso() {
  return new Date(Date.now() + FIVE_MIN).toISOString()
}

function normalizeStatus(row?: StatusRow | null) {
  return {
    running: Boolean(row?.running),
    source: row?.source || "",
    lastStartedAt: row?.lastStartedAt || "",
    lastFinishedAt: row?.lastFinishedAt || "",
    nextRunAt: row?.nextRunAt || "",
    lastOk: row?.lastOk === null || row?.lastOk === undefined ? null : Boolean(row.lastOk),
    lastMessage: row?.lastMessage || "",
    lastProcessed: Number(row?.lastProcessed || 0),
    updatedAt: row?.updatedAt || "",
  }
}

export async function ensureEmailTriageStatusTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS public.judicial_email_triagem_status (id TEXT PRIMARY KEY, running BOOLEAN DEFAULT FALSE, source TEXT, last_started_at TIMESTAMPTZ, last_finished_at TIMESTAMPTZ, next_run_at TIMESTAMPTZ, last_ok BOOLEAN, last_message TEXT, last_processed INTEGER DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW())`)
  await prisma.$executeRawUnsafe(`INSERT INTO public.judicial_email_triagem_status (id, running, next_run_at, updated_at) VALUES ($1, FALSE, NOW() + INTERVAL '5 minutes', NOW()) ON CONFLICT (id) DO NOTHING`, ID)
}

export async function getEmailTriageStatus() {
  await ensureEmailTriageStatusTable()
  const rows = await prisma.$queryRawUnsafe<StatusRow[]>(`SELECT running, source, last_started_at::text AS "lastStartedAt", last_finished_at::text AS "lastFinishedAt", next_run_at::text AS "nextRunAt", last_ok AS "lastOk", last_message AS "lastMessage", last_processed AS "lastProcessed", updated_at::text AS "updatedAt" FROM public.judicial_email_triagem_status WHERE id = $1 LIMIT 1`, ID)
  return normalizeStatus(rows[0])
}

async function setStarted(source: string, nextRunAt?: string) {
  await ensureEmailTriageStatusTable()
  await prisma.$executeRawUnsafe(`UPDATE public.judicial_email_triagem_status SET running = TRUE, source = $2, last_started_at = NOW(), next_run_at = $3::timestamptz, last_message = 'Triagem em andamento', updated_at = NOW() WHERE id = $1`, ID, source, nextRunAt || nextIso())
}

async function setFinished(ok: boolean, message: string, processed: number, nextRunAt?: string) {
  await ensureEmailTriageStatusTable()
  await prisma.$executeRawUnsafe(`UPDATE public.judicial_email_triagem_status SET running = FALSE, last_finished_at = NOW(), next_run_at = $2::timestamptz, last_ok = $3, last_message = $4, last_processed = $5, updated_at = NOW() WHERE id = $1`, ID, nextRunAt || nextIso(), ok, message, processed)
}

async function execute(nextRunAt?: string) {
  try {
    const result = await processUnreadEmailTriageV2(5000)
    const processed = Number(result.processed || 0)
    const message = result.ok ? `${processed} e-mail(s) processado(s)` : (result.error || "Falha ao processar e-mails")
    await setFinished(Boolean(result.ok), message, processed, nextRunAt)
  } catch (error) {
    await setFinished(false, error instanceof Error ? error.message : String(error), 0, nextRunAt)
  } finally {
    globalThis.__sigajusEmailTriageJobRunning = false
  }
}

export async function startEmailTriageJob(source = "manual", nextRunAt?: string) {
  await ensureEmailTriageStatusTable()
  if (globalThis.__sigajusEmailTriageJobRunning) {
    return { ok: true, alreadyRunning: true, started: false, status: await getEmailTriageStatus() }
  }
  globalThis.__sigajusEmailTriageJobRunning = true
  await setStarted(source, nextRunAt)
  void execute(nextRunAt).catch(async (error) => {
    globalThis.__sigajusEmailTriageJobRunning = false
    await setFinished(false, error instanceof Error ? error.message : String(error), 0, nextRunAt).catch(() => undefined)
  })
  return { ok: true, started: true, status: await getEmailTriageStatus() }
}
