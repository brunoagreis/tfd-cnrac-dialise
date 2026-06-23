import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

type MunicipalityContactRow = {
  id: string
  municipalityName: string
  emails: unknown
}

type MunicipalityAccessRow = {
  id: string
  municipioId: string
  municipioNome: string
  email: string
  ativo: boolean | null
  senhaCadastrada: boolean | null
  updatedAt: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

export function normalizeEmail(value: unknown) {
  return text(value).toLowerCase()
}

export function parseEmails(value: unknown) {
  if (Array.isArray(value)) return value.map(normalizeEmail).filter(Boolean)
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(normalizeEmail).filter(Boolean)
    } catch {
      return value.split(/[;,]/).map(normalizeEmail).filter(Boolean)
    }
  }
  return []
}

export async function ensureMunicipalityPortalAccessTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.municipio_portal_acessos (
      id BIGSERIAL PRIMARY KEY,
      municipio_id BIGINT NOT NULL,
      municipio_nome TEXT NOT NULL,
      email TEXT NOT NULL,
      senha_hash TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS municipio_portal_acessos_email_lower_uniq
      ON public.municipio_portal_acessos (LOWER(email))
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS municipio_portal_acessos_municipio_id_idx
      ON public.municipio_portal_acessos (municipio_id)
  `)
}

export async function syncMunicipalityPortalAccess(municipioId: string, municipioNome: string, rawEmails: unknown) {
  await ensureMunicipalityPortalAccessTable()

  const emails = Array.from(new Set(parseEmails(rawEmails)))

  const existing = await prisma.$queryRawUnsafe<Array<{ senhaHash: string | null }>>(
    `
      SELECT senha_hash AS "senhaHash"
      FROM public.municipio_portal_acessos
      WHERE municipio_id = $1::bigint
        AND NULLIF(TRIM(senha_hash), '') IS NOT NULL
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
    municipioId,
  )
  const inheritedPasswordHash = text(existing[0]?.senhaHash) || null

  await prisma.$executeRawUnsafe(
    `
      UPDATE public.municipio_portal_acessos
      SET ativo = FALSE,
          municipio_nome = $2,
          updated_at = NOW()
      WHERE municipio_id = $1::bigint
    `,
    municipioId,
    municipioNome,
  )

  for (const email of emails) {
    const current = await prisma.$queryRawUnsafe<Array<{ id: string; senhaHash: string | null }>>(
      `
        SELECT id::text AS id, senha_hash AS "senhaHash"
        FROM public.municipio_portal_acessos
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      email,
    )

    if (current[0]?.id) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE public.municipio_portal_acessos
          SET municipio_id = $1::bigint,
              municipio_nome = $2,
              email = $3,
              senha_hash = COALESCE(NULLIF(senha_hash, ''), $4),
              ativo = TRUE,
              updated_at = NOW()
          WHERE id = $5::bigint
        `,
        municipioId,
        municipioNome,
        email,
        inheritedPasswordHash,
        current[0].id,
      )
    } else {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO public.municipio_portal_acessos (
            municipio_id,
            municipio_nome,
            email,
            senha_hash,
            ativo,
            created_at,
            updated_at
          )
          VALUES ($1::bigint, $2, $3, $4, TRUE, NOW(), NOW())
        `,
        municipioId,
        municipioNome,
        email,
        inheritedPasswordHash,
      )
    }
  }
}

export async function syncAllMunicipalityPortalAccesses() {
  await ensureMunicipalityPortalAccessTable()

  const rows = await prisma.$queryRawUnsafe<MunicipalityContactRow[]>(`
    SELECT id::text AS id, municipio_nome AS "municipalityName", emails
    FROM public.admin_judicial_municipios_contatos
    ORDER BY municipio_nome
  `)

  for (const row of rows) {
    await syncMunicipalityPortalAccess(row.id, row.municipalityName, row.emails)
  }
}

export async function setMunicipalityAccessPassword(accessId: string, password: string) {
  await ensureMunicipalityPortalAccessTable()

  const senha = text(password)
  if (senha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.")

  const hash = await bcrypt.hash(senha, 10)

  await prisma.$executeRawUnsafe(
    `
      UPDATE public.municipio_portal_acessos
      SET senha_hash = $1,
          ativo = TRUE,
          updated_at = NOW()
      WHERE id = $2::bigint
    `,
    hash,
    accessId,
  )
}

export async function listMunicipalityPortalAccesses() {
  await syncAllMunicipalityPortalAccesses()

  const rows = await prisma.$queryRawUnsafe<MunicipalityAccessRow[]>(`
    SELECT
      id::text AS id,
      municipio_id::text AS "municipioId",
      municipio_nome AS "municipioNome",
      email,
      ativo,
      (NULLIF(TRIM(COALESCE(senha_hash, '')), '') IS NOT NULL) AS "senhaCadastrada",
      updated_at::text AS "updatedAt"
    FROM public.municipio_portal_acessos
    ORDER BY municipio_nome, email
  `)

  return rows.map((row) => ({
    id: row.id,
    municipioId: row.municipioId,
    municipioNome: row.municipioNome,
    email: row.email,
    ativo: row.ativo !== false,
    senhaCadastrada: Boolean(row.senhaCadastrada),
    updatedAt: row.updatedAt,
  }))
}

export async function setMunicipalityAccessActive(accessId: string, ativo: boolean) {
  await ensureMunicipalityPortalAccessTable()

  await prisma.$executeRawUnsafe(
    `
      UPDATE public.municipio_portal_acessos
      SET ativo = $1,
          updated_at = NOW()
      WHERE id = $2::bigint
    `,
    ativo,
    accessId,
  )
}
