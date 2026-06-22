import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Cid10Row = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean
  createdAt: string
  updatedAt: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeCidCode(value: unknown) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

export async function GET(req: NextRequest) {
  try {
    const rawQuery = normalizeText(req.nextUrl.searchParams.get("q"))
    const q = rawQuery.toLowerCase()
    const qCode = normalizeCidCode(rawQuery)
    const params: unknown[] = []
    const whereParts = [`c.ativo = TRUE`]

    if (rawQuery) {
      params.push(`%${q}%`)
      const textIndex = params.length

      if (qCode) {
        params.push(`%${qCode}%`)
        const codeIndex = params.length

        whereParts.push(`
          (
            LOWER(COALESCE(c.codigo, '')) LIKE $${textIndex}
            OR LOWER(COALESCE(c.descricao, '')) LIKE $${textIndex}
            OR regexp_replace(UPPER(COALESCE(c.codigo, '')), '[^A-Z0-9]', '', 'g') LIKE $${codeIndex}
          )
        `)
      } else {
        whereParts.push(`
          (
            LOWER(COALESCE(c.codigo, '')) LIKE $${textIndex}
            OR LOWER(COALESCE(c.descricao, '')) LIKE $${textIndex}
          )
        `)
      }
    }

    const rows = await prisma.$queryRawUnsafe<Cid10Row[]>(
      `
        SELECT
          c.id::text AS id,
          c.codigo,
          c.descricao,
          c.ativo,
          c."createdAt"::text AS "createdAt",
          c."updatedAt"::text AS "updatedAt"
        FROM public.admin_judicial_cid10 c
        WHERE ${whereParts.join(" AND ")}
        ORDER BY c.codigo ASC
        LIMIT 50
      `,
      ...params,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        codigo: row.codigo,
        descricao: row.descricao,
        ativo: Boolean(row.ativo),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/cid10] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar CID-10." },
      { status: 500 },
    )
  }
}
