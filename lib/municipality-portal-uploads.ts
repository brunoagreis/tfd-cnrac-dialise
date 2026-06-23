import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"

export async function ensureMunicipalityUploadTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.municipio_portal_anexos (
      id BIGSERIAL PRIMARY KEY,
      protocolo TEXT NOT NULL,
      demanda_id TEXT NOT NULL,
      municipio_id BIGINT NOT NULL,
      municipio_nome TEXT NOT NULL,
      email TEXT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      mime_type TEXT,
      tamanho INTEGER,
      conteudo BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.municipio_portal_anexos
      ADD COLUMN IF NOT EXISTS download_token TEXT
  `)

  await prisma.$executeRawUnsafe(`
    UPDATE public.municipio_portal_anexos
    SET download_token = md5(random()::text || clock_timestamp()::text || id::text)
    WHERE NULLIF(TRIM(COALESCE(download_token, '')), '') IS NULL
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS municipio_portal_anexos_download_token_uniq
      ON public.municipio_portal_anexos (download_token)
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS municipio_portal_anexos_protocolo_idx
      ON public.municipio_portal_anexos (protocolo)
  `)
}

export function buildMunicipalityUploadDownloadUrl(token: string) {
  return `/api/municipio/demandas/anexo/baixar/${encodeURIComponent(token)}`
}

export function createMunicipalityUploadToken() {
  return randomUUID()
}
