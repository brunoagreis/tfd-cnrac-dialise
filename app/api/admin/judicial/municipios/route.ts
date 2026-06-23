import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { syncMunicipalityPortalAccess } from "@/lib/municipality-portal-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type MunicipioRow = {
  id: string
  municipalityName: string
  emails: unknown
  phones: unknown
  contacts: unknown
  updatedAt: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean)
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? "").trim()).filter(Boolean)
      }
    } catch {
      return []
    }
  }

  return []
}

function mapRow(row: MunicipioRow) {
  return {
    id: row.id,
    municipalityName: row.municipalityName,
    emails: parseJsonArray(row.emails),
    phones: parseJsonArray(row.phones),
    contacts: parseJsonArray(row.contacts),
    updatedAt: row.updatedAt,
  }
}

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<MunicipioRow[]>(`
      SELECT
        id::text AS id,
        municipio_nome AS "municipalityName",
        emails,
        telefones AS phones,
        contatos AS contacts,
        updated_at::text AS "updatedAt"
      FROM public.admin_judicial_municipios_contatos
      ORDER BY municipio_nome
    `)

    return NextResponse.json({
      ok: true,
      items: rows.map(mapRow),
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/municipios] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar municípios." },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const id = normalizeText(body?.id)
    const municipalityName = normalizeText(body?.municipalityName)
    const emails = normalizeStringArray(body?.emails)
    const phones = normalizeStringArray(body?.phones)
    const contacts = normalizeStringArray(body?.contacts)

    if (!municipalityName) {
      return NextResponse.json(
        { ok: false, error: "Informe o município." },
        { status: 400 },
      )
    }

    const emailsJson = JSON.stringify(emails)
    const phonesJson = JSON.stringify(phones)
    const contactsJson = JSON.stringify(contacts)

    let saved: MunicipioRow | undefined

    if (id) {
      const updated = await prisma.$queryRawUnsafe<MunicipioRow[]>(
        `
          UPDATE public.admin_judicial_municipios_contatos
          SET
            municipio_nome = $1,
            emails = $2::jsonb,
            telefones = $3::jsonb,
            contatos = $4::jsonb,
            updated_at = NOW()
          WHERE id = $5::bigint
          RETURNING
            id::text AS id,
            municipio_nome AS "municipalityName",
            emails,
            telefones AS phones,
            contatos AS contacts,
            updated_at::text AS "updatedAt"
        `,
        municipalityName,
        emailsJson,
        phonesJson,
        contactsJson,
        id,
      )

      saved = updated[0]
    } else {
      const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `
          SELECT id::text AS id
          FROM public.admin_judicial_municipios_contatos
          WHERE LOWER(municipio_nome) = LOWER($1)
          LIMIT 1
        `,
        municipalityName,
      )

      if (existing[0]?.id) {
        const updated = await prisma.$queryRawUnsafe<MunicipioRow[]>(
          `
            UPDATE public.admin_judicial_municipios_contatos
            SET
              municipio_nome = $1,
              emails = $2::jsonb,
              telefones = $3::jsonb,
              contatos = $4::jsonb,
              updated_at = NOW()
            WHERE id = $5::bigint
            RETURNING
              id::text AS id,
              municipio_nome AS "municipalityName",
              emails,
              telefones AS phones,
              contatos AS contacts,
              updated_at::text AS "updatedAt"
          `,
          municipalityName,
          emailsJson,
          phonesJson,
          contactsJson,
          existing[0].id,
        )

        saved = updated[0]
      } else {
        const inserted = await prisma.$queryRawUnsafe<MunicipioRow[]>(
          `
            INSERT INTO public.admin_judicial_municipios_contatos (
              municipio_nome,
              emails,
              telefones,
              contatos,
              updated_at
            )
            VALUES (
              $1,
              $2::jsonb,
              $3::jsonb,
              $4::jsonb,
              NOW()
            )
            RETURNING
              id::text AS id,
              municipio_nome AS "municipalityName",
              emails,
              telefones AS phones,
              contatos AS contacts,
              updated_at::text AS "updatedAt"
          `,
          municipalityName,
          emailsJson,
          phonesJson,
          contactsJson,
        )

        saved = inserted[0]
      }
    }

    if (!saved) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível salvar o município." },
        { status: 500 },
      )
    }

    await syncMunicipalityPortalAccess(saved.id, saved.municipalityName, saved.emails)

    return NextResponse.json({
      ok: true,
      item: mapRow(saved),
    })
  } catch (error) {
    console.error("[POST /api/admin/judicial/municipios] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao salvar município." },
      { status: 500 },
    )
  }
}
