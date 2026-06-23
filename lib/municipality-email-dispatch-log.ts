import { prisma } from "@/lib/prisma"

type DispatchStatus = "ENVIADO" | "NAO_ENVIADO"

type RecordDispatchInput = {
  protocolo: string
  module: string
  municipio?: string | null
  status: DispatchStatus
  messageId?: string | null
  accepted?: unknown
  rejected?: unknown
  reason?: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? [])
  } catch {
    return "[]"
  }
}

export async function ensureMunicipalityEmailDispatchLogTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.email_municipio_disparos (
      id BIGSERIAL PRIMARY KEY,
      protocolo TEXT NOT NULL,
      modulo TEXT,
      municipio TEXT,
      tipo TEXT NOT NULL DEFAULT 'CADASTRO_MUNICIPAL',
      status TEXT NOT NULL,
      enviado_em TIMESTAMPTZ,
      message_id TEXT,
      accepted JSONB NOT NULL DEFAULT '[]'::jsonb,
      rejected JSONB NOT NULL DEFAULT '[]'::jsonb,
      erro TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS email_municipio_disparos_protocolo_idx
      ON public.email_municipio_disparos (protocolo)
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS email_municipio_disparos_status_idx
      ON public.email_municipio_disparos (status)
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS email_municipio_disparos_created_at_idx
      ON public.email_municipio_disparos (created_at DESC)
  `)
}

export async function recordMunicipalityEmailDispatch(input: RecordDispatchInput) {
  const protocolo = text(input.protocolo)
  if (!protocolo) return

  await ensureMunicipalityEmailDispatchLogTable()

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO public.email_municipio_disparos (
        protocolo,
        modulo,
        municipio,
        tipo,
        status,
        enviado_em,
        message_id,
        accepted,
        rejected,
        erro,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'CADASTRO_MUNICIPAL',
        $4,
        CASE WHEN $4 = 'ENVIADO' THEN NOW() ELSE NULL END,
        $5,
        COALESCE(NULLIF($6, ''), '[]')::jsonb,
        COALESCE(NULLIF($7, ''), '[]')::jsonb,
        $8,
        NOW()
      )
    `,
    protocolo,
    text(input.module) || null,
    text(input.municipio) || null,
    input.status,
    text(input.messageId) || null,
    safeJson(input.accepted),
    safeJson(input.rejected),
    text(input.reason) || null,
  )
}
