import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminRequest } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SubespecialidadeRow = {
  id: string
  nome: string | null
  especialidadeId: string | null
  especialidadeNome: string | null
  ativo: boolean | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function serialize(item: SubespecialidadeRow) {
  return {
    id: item.id,
    nome: item.nome || "",
    especialidadeId: item.especialidadeId || null,
    especialidadeNome: item.especialidadeNome || null,
    ativo: item.ativo !== false,
  }
}

export async function GET(req: Request) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const { searchParams } = new URL(req.url)
    const especialidadeId = text(searchParams.get("especialidadeId"))

    const rows = await prisma.$queryRawUnsafe<SubespecialidadeRow[]>(
      `
        SELECT
          s.id::text AS id,
          s.nome,
          s."especialidadeId"::text AS "especialidadeId",
          e.nome AS "especialidadeNome",
          COALESCE(s.ativo, TRUE) AS ativo
        FROM public.judicial_subespecialidades s
        LEFT JOIN public.judicial_especialidades e
          ON e.id = s."especialidadeId"
        WHERE
          $1 = ''
          OR s."especialidadeId"::text = $1
        ORDER BY e.nome ASC NULLS LAST, s.nome ASC
      `,
      especialidadeId,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map(serialize),
      subespecialidades: rows.map(serialize),
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/subespecialidades] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar subespecialidades." },
      { status: 500 },
    )
  }
}