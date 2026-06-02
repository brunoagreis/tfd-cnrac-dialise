import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PacienteRow = {
  id: string
  cpf: string | null
  cartaoSus: string | null
  nome: string | null
  dataNascimento: string | null
  email: string | null
  municipio: string | null
  endereco: string | null
  createdAt: string | null
  updatedAt: string | null
  totalDemandas: number | bigint | null
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

export async function GET(req: NextRequest) {
  try {
    const search = normalizeText(req.nextUrl.searchParams.get("q")).toLowerCase()

    const params: unknown[] = []
    const whereParts: string[] = []

    if (search) {
      params.push(`%${search}%`)
      const idx = params.length

      whereParts.push(`
        (
          LOWER(COALESCE(p.nome, '')) LIKE $${idx}
          OR LOWER(COALESCE(p.cpf, '')) LIKE $${idx}
          OR LOWER(COALESCE(p."cartaoSus", '')) LIKE $${idx}
          OR LOWER(COALESCE(p.municipio, '')) LIKE $${idx}
        )
      `)
    }

    const rows = await prisma.$queryRawUnsafe<PacienteRow[]>(
      `
        SELECT
          p.id::text AS id,
          NULLIF(p.cpf, '') AS cpf,
          NULLIF(p."cartaoSus", '') AS "cartaoSus",
          NULLIF(p.nome, '') AS nome,
          p."dataNascimento"::text AS "dataNascimento",
          NULLIF(p.email, '') AS email,
          NULLIF(p.municipio, '') AS municipio,
          NULLIF(p.endereco, '') AS endereco,
          p."createdAt"::text AS "createdAt",
          p."updatedAt"::text AS "updatedAt",
          COUNT(d.id) AS "totalDemandas"
        FROM public.pacientes p
        LEFT JOIN public.demandas d
          ON d."pacienteId" = p.id
        ${whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : ""}
        GROUP BY
          p.id,
          p.cpf,
          p."cartaoSus",
          p.nome,
          p."dataNascimento",
          p.email,
          p.municipio,
          p.endereco,
          p."createdAt",
          p."updatedAt"
        ORDER BY COALESCE(p.nome, '') ASC
      `,
      ...params,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        cpf: row.cpf ?? "",
        cartaoSus: row.cartaoSus ?? "",
        cns: row.cartaoSus ?? "",
        nome: row.nome ?? "SEM NOME",
        dataNascimento: row.dataNascimento ?? "",
        email: row.email ?? "",
        municipio: row.municipio ?? "",
        endereco: row.endereco ?? "",
        criadoEm: row.createdAt ?? "",
        atualizadoEm: row.updatedAt ?? "",
        totalDemandas: Number(row.totalDemandas ?? 0),
      })),
    })
  } catch (error) {
    console.error("[GET /api/pacientes] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar pacientes do banco." },
      { status: 500 },
    )
  }
}