import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type PermissaoInput = {
  modulo: string
  acao: string
  permitido: boolean
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeModulo(value: unknown) {
  return normalizeText(value).toUpperCase()
}

function normalizeAcao(value: unknown) {
  return normalizeText(value).toLowerCase()
}

async function ensurePermissionsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.perfil_permissoes (
      id text PRIMARY KEY,
      perfil_id text NOT NULL,
      modulo text NOT NULL,
      acao text NOT NULL,
      permitido boolean NOT NULL DEFAULT false,
      "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT now()
    );
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_perfil_permissoes_perfil_id
    ON public.perfil_permissoes (perfil_id);
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_perfil_permissoes_perfil_modulo_acao
    ON public.perfil_permissoes (perfil_id, modulo, acao);
  `)
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const perfilId = normalizeText(id)

    if (!perfilId) {
      return NextResponse.json(
        { ok: false, error: "Perfil não informado." },
        { status: 400 },
      )
    }

    await ensurePermissionsTable()

    const perfil = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM public.perfis
      WHERE id = ${perfilId}
      LIMIT 1
    `

    if (perfil.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 404 },
      )
    }

    const permissoes = await prisma.$queryRaw<
      Array<{
        modulo: string
        acao: string
        permitido: boolean
      }>
    >`
      SELECT
        modulo,
        acao,
        permitido
      FROM public.perfil_permissoes
      WHERE perfil_id = ${perfilId}
      ORDER BY modulo ASC, acao ASC
    `

    return NextResponse.json({
      ok: true,
      permissoes,
    })
  } catch (error) {
    console.error("[GET /api/admin/perfis/[id]/permissoes] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Falha ao carregar permissões do perfil." },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const perfilId = normalizeText(id)

    if (!perfilId) {
      return NextResponse.json(
        { ok: false, error: "Perfil não informado." },
        { status: 400 },
      )
    }

    const body = await request.json()
    const rawPermissoes = Array.isArray(body?.permissoes) ? body.permissoes : []

    await ensurePermissionsTable()

    const perfil = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM public.perfis
      WHERE id = ${perfilId}
      LIMIT 1
    `

    if (perfil.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 404 },
      )
    }

    const permissoes: PermissaoInput[] = rawPermissoes
      .map((item: any) => ({
        modulo: normalizeModulo(item?.modulo),
        acao: normalizeAcao(item?.acao),
        permitido: Boolean(item?.permitido),
      }))
      .filter((item) => item.modulo && item.acao)

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM public.perfil_permissoes
        WHERE perfil_id = ${perfilId}
      `

      for (const permissao of permissoes) {
        await tx.$executeRaw`
          INSERT INTO public.perfil_permissoes (
            id,
            perfil_id,
            modulo,
            acao,
            permitido,
            "createdAt",
            "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text,
            ${perfilId},
            ${permissao.modulo},
            ${permissao.acao},
            ${permissao.permitido},
            NOW(),
            NOW()
          )
        `
      }
    })

    return NextResponse.json({
      ok: true,
      permissoes,
    })
  } catch (error) {
    console.error("[PUT /api/admin/perfis/[id]/permissoes] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Falha ao salvar permissões do perfil." },
      { status: 500 },
    )
  }
}