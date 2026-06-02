import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9_ ]/g, "")
    .replace(/\s+/g, "_")
}

type PerfilRow = {
  id: string
  nome: string
  codigo: string | null
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}

function serializePerfil(item: PerfilRow) {
  return {
    id: item.id,
    nome: item.nome,
    codigo: item.codigo,
    ativo: item.ativo,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export async function GET() {
  try {
    const perfis = await prisma.$queryRaw<PerfilRow[]>`
      SELECT
        id,
        nome,
        codigo,
        ativo,
        "createdAt",
        "updatedAt"
      FROM public.perfis
      ORDER BY nome ASC
    `

    return NextResponse.json({
      ok: true,
      perfis: perfis.map(serializePerfil),
    })
  } catch (error) {
    console.error("[GET /api/admin/perfis] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Falha ao listar perfis." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const nome = normalizeText(body?.nome)
    const codigoInformado = normalizeText(body?.codigo)
    const codigo = normalizeCode(codigoInformado || nome)

    if (!nome) {
      return NextResponse.json(
        { ok: false, error: "Informe o nome do perfil." },
        { status: 400 },
      )
    }

    const existentePorNome = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM public.perfis
      WHERE LOWER(nome) = LOWER(${nome})
      LIMIT 1
    `

    if (existentePorNome.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Já existe um perfil com esse nome." },
        { status: 409 },
      )
    }

    const existentePorCodigo = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM public.perfis
      WHERE codigo = ${codigo}
      LIMIT 1
    `

    if (existentePorCodigo.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Já existe um perfil com esse código." },
        { status: 409 },
      )
    }

    const criado = await prisma.$queryRaw<PerfilRow[]>`
      INSERT INTO public.perfis (
        id,
        nome,
        codigo,
        ativo,
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${nome},
        ${codigo},
        true,
        NOW(),
        NOW()
      )
      RETURNING
        id,
        nome,
        codigo,
        ativo,
        "createdAt",
        "updatedAt"
    `

    return NextResponse.json(
      {
        ok: true,
        perfil: serializePerfil(criado[0]),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[POST /api/admin/perfis] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Falha ao criar perfil." },
      { status: 500 },
    )
  }
}