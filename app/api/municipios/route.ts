import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type MunicipioOptionRow = {
  id: string
  municipalityName: string | null
  emails: unknown
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ")
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean)
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)

      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeText(item)).filter(Boolean)
      }
    } catch {
      return normalizeText(value)
        .split(/\s*(?:,|;|\n)\s*/)
        .filter(Boolean)
    }
  }

  return []
}

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<MunicipioOptionRow[]>(`
      SELECT
        id::text AS id,
        municipio_nome AS "municipalityName",
        emails
      FROM public.admin_judicial_municipios_contatos
      WHERE NULLIF(TRIM(municipio_nome), '') IS NOT NULL
      ORDER BY municipio_nome
    `)

    const items = rows
      .map((row) => ({
        id: row.id,
        municipalityName: normalizeText(row.municipalityName).toUpperCase(),
        emails: parseJsonArray(row.emails),
      }))
      .filter((item) => item.municipalityName)

    return NextResponse.json({
      ok: true,
      items,
      municipios: items.map((item) => item.municipalityName),
    })
  } catch (error) {
    console.error("[GET /api/municipios] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar municípios." },
      { status: 500 },
    )
  }
}
