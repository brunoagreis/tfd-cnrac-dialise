import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type EspecialidadeSubRow = {
  especialidadeId: string
  especialidadeNome: string
  subespecialidadeId: string
  subespecialidadeNome: string
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

function mapRow(row: EspecialidadeSubRow) {
  return {
    especialidadeId: row.especialidadeId,
    especialidadeNome: row.especialidadeNome,
    subespecialidadeId: row.subespecialidadeId,
    subespecialidadeNome: row.subespecialidadeNome,
    updatedAt: row.updatedAt,
  }
}

async function findEspecialidadeIdByNome(nome: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT id::text AS id
      FROM public.admin_judicial_especialidades
      WHERE LOWER(nome) = LOWER($1)
      LIMIT 1
    `,
    nome,
  )

  return rows[0]?.id ?? null
}

async function findSubespecialidadeIdByNome(especialidadeId: string, nome: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT id::text AS id
      FROM public.admin_judicial_subespecialidades
      WHERE especialidade_id = $1::bigint
        AND LOWER(nome) = LOWER($2)
      LIMIT 1
    `,
    especialidadeId,
    nome,
  )

  return rows[0]?.id ?? null
}

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<EspecialidadeSubRow[]>(`
      SELECT
        esp.id::text AS "especialidadeId",
        esp.nome AS "especialidadeNome",
        sub.id::text AS "subespecialidadeId",
        sub.nome AS "subespecialidadeNome",
        GREATEST(esp.updated_at, sub.updated_at)::text AS "updatedAt"
      FROM public.admin_judicial_subespecialidades sub
      INNER JOIN public.admin_judicial_especialidades esp
        ON esp.id = sub.especialidade_id
      WHERE esp.ativo = TRUE
        AND sub.ativo = TRUE
      ORDER BY esp.nome, sub.nome
    `)

    return NextResponse.json({
      ok: true,
      items: rows.map(mapRow),
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/especialidades] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar especialidades e subespecialidades." },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const especialidadeIdInput = normalizeText(body?.especialidadeId)
    const subespecialidadeIdInput = normalizeText(body?.subespecialidadeId)
    const especialidadeNome = normalizeUpperText(body?.especialidadeNome)
    const subespecialidadeNome = normalizeUpperText(body?.subespecialidadeNome)

    if (!especialidadeNome) {
      return NextResponse.json(
        { ok: false, error: "Informe a especialidade." },
        { status: 400 },
      )
    }

    if (!subespecialidadeNome) {
      return NextResponse.json(
        { ok: false, error: "Informe a subespecialidade." },
        { status: 400 },
      )
    }

    let especialidadeId = especialidadeIdInput

    if (especialidadeId) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE public.admin_judicial_especialidades
          SET
            nome = $1,
            ativo = TRUE
          WHERE id = $2::bigint
        `,
        especialidadeNome,
        especialidadeId,
      )
    } else {
      const existingEspecialidadeId = await findEspecialidadeIdByNome(especialidadeNome)

      if (existingEspecialidadeId) {
        especialidadeId = existingEspecialidadeId

        await prisma.$executeRawUnsafe(
          `
            UPDATE public.admin_judicial_especialidades
            SET
              nome = $1,
              ativo = TRUE
            WHERE id = $2::bigint
          `,
          especialidadeNome,
          especialidadeId,
        )
      } else {
        const insertedEspecialidade = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `
            INSERT INTO public.admin_judicial_especialidades (
              nome,
              ativo
            )
            VALUES (
              $1,
              TRUE
            )
            RETURNING id::text AS id
          `,
          especialidadeNome,
        )

        especialidadeId = insertedEspecialidade[0]?.id ?? ""
      }
    }

    if (!especialidadeId) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível salvar a especialidade." },
        { status: 500 },
      )
    }

    let subespecialidadeId = subespecialidadeIdInput

    if (subespecialidadeId) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE public.admin_judicial_subespecialidades
          SET
            especialidade_id = $1::bigint,
            nome = $2,
            ativo = TRUE
          WHERE id = $3::bigint
        `,
        especialidadeId,
        subespecialidadeNome,
        subespecialidadeId,
      )
    } else {
      const existingSubespecialidadeId = await findSubespecialidadeIdByNome(
        especialidadeId,
        subespecialidadeNome,
      )

      if (existingSubespecialidadeId) {
        subespecialidadeId = existingSubespecialidadeId

        await prisma.$executeRawUnsafe(
          `
            UPDATE public.admin_judicial_subespecialidades
            SET
              especialidade_id = $1::bigint,
              nome = $2,
              ativo = TRUE
            WHERE id = $3::bigint
          `,
          especialidadeId,
          subespecialidadeNome,
          subespecialidadeId,
        )
      } else {
        const insertedSubespecialidade = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `
            INSERT INTO public.admin_judicial_subespecialidades (
              especialidade_id,
              nome,
              ativo
            )
            VALUES (
              $1::bigint,
              $2,
              TRUE
            )
            RETURNING id::text AS id
          `,
          especialidadeId,
          subespecialidadeNome,
        )

        subespecialidadeId = insertedSubespecialidade[0]?.id ?? ""
      }
    }

    if (!subespecialidadeId) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível salvar a subespecialidade." },
        { status: 500 },
      )
    }

    const saved = await prisma.$queryRawUnsafe<EspecialidadeSubRow[]>(
      `
        SELECT
          esp.id::text AS "especialidadeId",
          esp.nome AS "especialidadeNome",
          sub.id::text AS "subespecialidadeId",
          sub.nome AS "subespecialidadeNome",
          GREATEST(esp.updated_at, sub.updated_at)::text AS "updatedAt"
        FROM public.admin_judicial_subespecialidades sub
        INNER JOIN public.admin_judicial_especialidades esp
          ON esp.id = sub.especialidade_id
        WHERE esp.id = $1::bigint
          AND sub.id = $2::bigint
        LIMIT 1
      `,
      especialidadeId,
      subespecialidadeId,
    )

    if (!saved[0]) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível retornar o registro salvo." },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      item: mapRow(saved[0]),
    })
  } catch (error) {
    console.error("[POST /api/admin/judicial/especialidades] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao salvar especialidade e subespecialidade." },
      { status: 500 },
    )
  }
}