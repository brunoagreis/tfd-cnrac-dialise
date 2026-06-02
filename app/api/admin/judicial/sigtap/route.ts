import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SigTapRow = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean
  updatedAt: string
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}

function normalizeUpperText(value: unknown) {
  return normalizeText(value).toUpperCase()
}

function normalizeCode(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function mapRow(row: SigTapRow) {
  return {
    id: row.id,
    codigo: row.codigo,
    descricao: row.descricao,
    ativo: row.ativo,
    updatedAt: row.updatedAt,
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = normalizeText(searchParams.get("q"))

    const params: unknown[] = []
    const whereParts = [`ativo = TRUE`]

    if (q) {
      const qDigits = normalizeCode(q)
      const qText = `%${q}%`

      if (qDigits) {
        params.push(`%${qDigits}%`)
        params.push(qText)
        whereParts.push(
          `(regexp_replace(codigo, '\\D', '', 'g') ILIKE $${params.length - 1} OR descricao ILIKE $${params.length})`,
        )
      } else {
        params.push(qText)
        whereParts.push(`descricao ILIKE $${params.length}`)
      }
    }

    const rows = await prisma.$queryRawUnsafe<SigTapRow[]>(
      `
        SELECT
          id::text AS id,
          codigo,
          descricao,
          ativo,
          updated_at::text AS "updatedAt"
        FROM public.admin_judicial_sigtap
        WHERE ${whereParts.join(" AND ")}
        ORDER BY codigo
        LIMIT 300
      `,
      ...params,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map(mapRow),
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/sigtap] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar SIGTAP." },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const id = normalizeText(body?.id)
    const codigo = normalizeCode(body?.codigo)
    const descricao = normalizeUpperText(body?.descricao)

    if (!codigo) {
      return NextResponse.json(
        { ok: false, error: "Informe o código do SIGTAP." },
        { status: 400 },
      )
    }

    if (!descricao) {
      return NextResponse.json(
        { ok: false, error: "Informe a descrição do SIGTAP." },
        { status: 400 },
      )
    }

    let saved: SigTapRow | undefined

    if (id) {
      const updated = await prisma.$queryRawUnsafe<SigTapRow[]>(
        `
          UPDATE public.admin_judicial_sigtap
          SET
            codigo = $1,
            descricao = $2,
            ativo = TRUE
          WHERE id = $3::bigint
          RETURNING
            id::text AS id,
            codigo,
            descricao,
            ativo,
            updated_at::text AS "updatedAt"
        `,
        codigo,
        descricao,
        id,
      )

      saved = updated[0]
    } else {
      const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `
          SELECT id::text AS id
          FROM public.admin_judicial_sigtap
          WHERE regexp_replace(codigo, '\D', '', 'g') = $1
          LIMIT 1
        `,
        codigo,
      )

      if (existing[0]?.id) {
        const updated = await prisma.$queryRawUnsafe<SigTapRow[]>(
          `
            UPDATE public.admin_judicial_sigtap
            SET
              codigo = $1,
              descricao = $2,
              ativo = TRUE
            WHERE id = $3::bigint
            RETURNING
              id::text AS id,
              codigo,
              descricao,
              ativo,
              updated_at::text AS "updatedAt"
          `,
          codigo,
          descricao,
          existing[0].id,
        )

        saved = updated[0]
      } else {
        const inserted = await prisma.$queryRawUnsafe<SigTapRow[]>(
          `
            INSERT INTO public.admin_judicial_sigtap (
              codigo,
              descricao,
              ativo
            )
            VALUES (
              $1,
              $2,
              TRUE
            )
            RETURNING
              id::text AS id,
              codigo,
              descricao,
              ativo,
              updated_at::text AS "updatedAt"
          `,
          codigo,
          descricao,
        )

        saved = inserted[0]
      }
    }

    if (!saved) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível salvar o SIGTAP." },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      item: mapRow(saved),
    })
  } catch (error) {
    console.error("[POST /api/admin/judicial/sigtap] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao salvar SIGTAP." },
      { status: 500 },
    )
  }
}