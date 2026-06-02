import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SubEspecialidadeRow = {
  id: string
  especialidadeId: string | null
  nome: string | null
  ativo: boolean | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const especialidadeId = text(searchParams.get("especialidadeId"))

    const rows = await prisma.$queryRawUnsafe<SubEspecialidadeRow[]>(
      `
        SELECT
          id::text AS id,
          especialidade_id::text AS "especialidadeId",
          nome,
          ativo
        FROM public.admin_judicial_subespecialidades
        WHERE COALESCE(ativo, TRUE) = TRUE
          AND ($1 = '' OR especialidade_id::text = $1)
        ORDER BY nome ASC
      `,
      especialidadeId,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        especialidadeId: text(row.especialidadeId),
        nome: text(row.nome),
        active: row.ativo !== false,
      })),
    })
  } catch (error) {
    console.error("[GET /api/judicial/subespecialidades] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar subespecialidades judiciais." },
      { status: 500 },
    )
  }
}
