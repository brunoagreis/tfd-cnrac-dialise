import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CidRow = {
  code: string | null
  description: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = text(searchParams.get("q"))
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 200) || 200, 20000))
    const search = `%${query}%`

    const rows = await prisma.$queryRawUnsafe<CidRow[]>(
      `
        SELECT
          codigo::text AS code,
          descricao::text AS description
        FROM public.admin_judicial_cid10
        WHERE
          COALESCE(codigo::text, '') <> ''
          AND COALESCE(descricao::text, '') <> ''
          AND (
            $1 = ''
            OR codigo::text ILIKE $2
            OR descricao::text ILIKE $2
          )
        ORDER BY codigo ASC, descricao ASC
        LIMIT $3::int
      `,
      query,
      search,
      limit,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        code: text(row.code),
        description: text(row.description),
      })),
    })
  } catch (error) {
    console.error("[GET /api/judicial/cid10] erro:", error)
    const detail = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar catálogo CID-10.", detail },
      { status: 500 },
    )
  }
}
