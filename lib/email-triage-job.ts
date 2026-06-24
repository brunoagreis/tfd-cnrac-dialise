import { prisma } from "@/lib/prisma"
import { processUnreadEmailTriageV2 } from "@/lib/email-triage-processing-v2"

const ID = "default"
const FIVE_MIN = 5 * 60 * 1000
const STALE_MS = 10 * 60 * 1000
const JOB_TIMEOUT_MS = 4 * 60 * 1000

type StatusRow = {
  running: boolean | null
  source: string | null
  lastStartedAt: string | null
  lastFinishedAt: string | null
  nextRunAt: string | null
  lastOk: boolean | null
  lastMessage: string | null
  lastProcessed: number | string | bigint | null
  mailboxTotal: number | string | bigint | null
  unreadTotal: number | string | bigint | null
  readCount: number | string | bigint | null
  triagedCount: number | string | bigint | null
  linkedCount: number | string | bigint | null
  osCount: number | string | bigint | null
  errorCount: number | string | bigint | null
  currentSubject: string | null
  updatedAt: string | null
}

declare global {
  var __sigajusEmailTriageJobRunning: boolean | undefined
}

function nextIso() {
  return new Date(Date.now() + FIVE_MIN).toISOString()
}

function asNumber(value: unknown) {
  return Number(value || 0)
}

function isStale(status: ReturnType<typeof normalizeStatus>) {
  if (!status.running || !status.lastStartedAt) return false
  const started = new Date(status.lastStartedAt).getTime()
  return Number.isFinite(started) && Date.now() - started > STALE_MS
}

function countByStatus(result: any, status: string) {
  return Array.isArray(result?.items) ? result.items.filter((item: any) => String(item?.status || "").toUpperCase() === status).length : 0
}

function countErrors(result: any) {
  return Array.isArray(result?.items) ? result.items.filter((item: any) => String(item?.status || "").toUpperCase().includes("ERRO")).length : 0
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
    lastProcessed: asNumber(row?.lastProcessed),
    mailboxTotal: asNumber(row?.mailboxTotal),
    unreadTotal: asNumber(row?.unreadTotal),
    readCount: asNumber(row?.readCount),
    triagedCount: asNumber(row?.triagedCount),
    linkedCount: asNumber(row?.linkedCount),
    osCount: asNumber(row?.osCount),
    errorCount: asNumber(row?.errorCount),
    currentSubject: row?.currentSubject || "",
    updatedAt: row?.updatedAt || "",
  }
}

export async function ensureEmailTriageStatusTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS public.judicial_email_triagem_status (id TEXT PRIMARY KEY, running BOOLEAN DEFAULT FALSE, source TEXT, last_started_at TIMESTAMPTZ, last_finished_at TIMESTAMPTZ, next_run_at TIMESTAMPTZ, last_ok BOOLEAN, last_message TEXT, last_processed INTEGER DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW())`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_triagem_status ADD COLUMN IF NOT EXISTS mailbox_total INTEGER DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_triagem_status ADD COLUMN IF NOT EXISTS unread_total INTEGER DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_triagem_status ADD COLUMN IF NOT EXISTS read_count INTEGER DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_triagem_status ADD COLUMN IF NOT EXISTS triaged_count INTEGER DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_triagem_status ADD COLUMN IF NOT EXISTS linked_count INTEGER DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_triagem_status ADD COLUMN IF NOT EXISTS os_count INTEGER DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_triagem_status ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_triagem_status ADD COLUMN IF NOT EXISTS current_subject TEXT`)
  await prisma.$executeRawUnsafe(`INSERT INTO public.judicial_email_triagem_status (id, running, next_run_at, updated_at) VALUES ($1, FALSE, NOW() + INTERVAL '5 minutes', NOW()) ON CONFLICT (id) DO NOTHING`, ID)
}

export async function getEmailTriageStatus() {
  await ensureEmailTriageStatusTable()
  const rows = await prisma.$queryRawUnsafe<StatusRow[]>(`SELECT running, source, last_started_at::text AS "lastStartedAt", last_finished_at::text AS "lastFinishedAt", next_run_at::text AS "nextRunAt", last_ok AS "lastOk", last_message AS "lastMessage", last_processed AS "lastProcessed", mailbox_total AS "mailboxTotal", unread_total AS "unreadTotal", read_count AS "readCount", triaged_count AS "triagedCount", linked_count AS "linkedCount", os_count AS "osCount", error_count AS "errorCount", current_subject AS "currentSubject", updated_at::text AS "updatedAt" FROM public.judicial_email_triagem_status WHERE id = $1 LIMIT 1`, ID)
  return normalizeStatus(rows[0])
}

async function setStarted(source: string, nextRunAt?: string) {
  await ensureEmailTriageStatusTable()
  await prisma.$executeRawUnsafe(`UPDATE public.judicial_email_triagem_status SET running = TRUE, source = $2, last_started_at = NOW(), next_run_at = $3::timestamptz, last_message = 'Triagem iniciada: lendo e-mails novos', last_ok = NULL, last_processed = 0, mailbox_total = 0, unread_total = 0, read_count = 0, triaged_count = 0, linked_count = 0, os_count = 0, error_count = 0, current_subject = NULL, updated_at = NOW() WHERE id = $1`, ID, source, nextRunAt || nextIso())
}

async function setProcessingMessage(message: string) {
  await ensureEmailTriageStatusTable()
  await prisma.$executeRawUnsafe(`UPDATE public.judicial_email_triagem_status SET last_message = $2, updated_at = NOW() WHERE id = $1`, ID, message)
}

async function setFinished(ok: boolean, message: string, processed: number, nextRunAt?: string, result?: any) {
  await ensureEmailTriageStatusTable()
  const linked = result?.linkedCount ?? countByStatus(result, "VINCULADO")
  const os = result?.osCount ?? countByStatus(result, "OS_CRIADA")
  const errors = result?.errorCount ?? countErrors(result)
  const total = result?.mailboxTotal ?? result?.total ?? processed
  const unread = result?.unreadTotal ?? processed
  const read = result?.readCount ?? processed
  const triaged = result?.triagedCount ?? processed
  await prisma.$executeRawUnsafe(`UPDATE public.judicial_email_triagem_status SET running = FALSE, last_finished_at = NOW(), next_run_at = $2::timestamptz, last_ok = $3, last_message = $4, last_processed = $5, mailbox_total = $6, unread_total = $7, read_count = $8, triaged_count = $9, linked_count = $10, os_count = $11, error_count = $12, current_subject = NULL, updated_at = NOW() WHERE id = $1`, ID, nextRunAt || nextIso(), ok, message, processed, total, unread, read, triaged, linked, os, errors)
}

async function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Tempo limite da triagem atingido. Pode tentar executar novamente.")), JOB_TIMEOUT_MS)),
  ])
}

async function execute(nextRunAt?: string) {
  try {
    await setProcessingMessage("Processando e-mails novos na INBOX")
    const result = await withTimeout(processUnreadEmailTriageV2(5000))
    const processed = Number(result.processed || 0)
    const message = result.ok ? `${processed} e-mail(s) processado(s)` : (result.error || "Falha ao processar e-mails")
    await setFinished(Boolean(result.ok), message, processed, nextRunAt, result)
  } catch (error) {
    await setFinished(false, error instanceof Error ? error.message : String(error), 0, nextRunAt)
  } finally {
    globalThis.__sigajusEmailTriageJobRunning = false
  }
}

export async function startEmailTriageJob(source = "manual", nextRunAt?: string) {
  await ensureEmailTriageStatusTable()
  const status = await getEmailTriageStatus()
  if (globalThis.__sigajusEmailTriageJobRunning && !isStale(status)) {
    return { ok: true, alreadyRunning: true, started: false, status }
  }
  if (isStale(status)) globalThis.__sigajusEmailTriageJobRunning = false
  globalThis.__sigajusEmailTriageJobRunning = true
  await setStarted(source, nextRunAt)
  void execute(nextRunAt).catch(async (error) => {
    globalThis.__sigajusEmailTriageJobRunning = false
    await setFinished(false, error instanceof Error ? error.message : String(error), 0, nextRunAt).catch(() => undefined)
  })
  return { ok: true, started: true, status: await getEmailTriageStatus() }
}
