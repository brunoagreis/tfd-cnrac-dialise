import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CidRow = {
  id: string
  codigo: string | null
  descricao: string | null
  ativo: boolean | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const q = text(searchParams.get("q"))
    const limitRaw = Number(searchParams.get("limit") || 300)
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 1000)
      : 300

    const rows = await prisma.$queryRawUnsafe<CidRow[]>(
      `
        SELECT
          id::text AS id,
          codigo,
          descricao,
          ativo
        FROM public.admin_judicial_cid10
        WHERE COALESCE(ativo, TRUE) = TRUE
          AND (
            $1 = ''
            OR codigo ILIKE '%' || $1 || '%'
            OR descricao ILIKE '%' || $1 || '%'
          )
        ORDER BY codigo ASC, descricao ASC
        LIMIT $2
      `,
      q,
      limit,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        code: text(row.codigo),
        description: text(row.descricao),
        active: row.ativo !== false,
      })),
    })
  } catch (error) {
    console.error("[GET /api/judicial/cid10] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar CID10." },
      { status: 500 },
    )
  }
}