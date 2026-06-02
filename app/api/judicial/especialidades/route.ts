import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type EspecialidadeRow = {
  id: string
  nome: string | null
  ativo: boolean | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<EspecialidadeRow[]>(
      `
        SELECT
          id::text AS id,
          nome,
          ativo
        FROM public.admin_judicial_especialidades
        WHERE COALESCE(ativo, TRUE) = TRUE
        ORDER BY nome ASC
      `,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        nome: text(row.nome),
        active: row.ativo !== false,
      })),
    })
  } catch (error) {
    console.error("[GET /api/judicial/especialidades] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar especialidades judiciais." },
      { status: 500 },
    )
  }
}
