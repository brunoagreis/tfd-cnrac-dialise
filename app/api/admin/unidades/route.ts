import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

const DEFAULT_UNIT_PASSWORD = process.env.DEFAULT_UNIT_PASSWORD || "unidade123"

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function serializeUnit(unit: {
  id: string
  nome: string
  email: string
  telefone: string | null
  endereco: string | null
  ativo: boolean
  createdAt: Date
}) {
  return {
    id: unit.id,
    nome: unit.nome,
    email: unit.email,
    telefone: unit.telefone ?? "",
    endereco: unit.endereco ?? "",
    ativo: unit.ativo,
    criadoEm: unit.createdAt.toISOString(),
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = normalizeText(searchParams.get("q"))

    const unidades = await prisma.unidade.findMany({
      where: q
        ? {
            OR: [
              { nome: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { endereco: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        endereco: true,
        ativo: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      ok: true,
      unidades: unidades.map(serializeUnit),
    })
  } catch (error) {
    console.error("[GET /api/admin/unidades] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Falha ao listar unidades." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const nome = normalizeText(body?.nome)
    const email = normalizeText(body?.email).toLowerCase()
    const telefone = normalizeText(body?.telefone) || null
    const endereco = normalizeText(body?.endereco) || null

    if (!nome || !email) {
      return NextResponse.json(
        { ok: false, error: "Nome e e-mail da unidade são obrigatórios." },
        { status: 400 },
      )
    }

    const existingUnit = await prisma.unidade.findFirst({
      where: {
        OR: [
          { email },
          { nome: { equals: nome, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    })

    if (existingUnit) {
      return NextResponse.json(
        { ok: false, error: "Já existe unidade com esse nome ou e-mail." },
        { status: 409 },
      )
    }

    const createdUnit = await prisma.$transaction(async (tx) => {
      const unidade = await tx.unidade.create({
        data: {
          nome,
          email,
          telefone,
          endereco,
          ativo: true,
          tipoUnidade: "hospitalar",
        },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          endereco: true,
          ativo: true,
          createdAt: true,
        },
      })

      const existingUser = await tx.usuario.findUnique({
        where: { email },
        select: { id: true },
      })

      if (!existingUser) {
        const senhaHash = await bcrypt.hash(DEFAULT_UNIT_PASSWORD, 10)

        await tx.usuario.create({
          data: {
            nome,
            email,
            senhaHash,
            role: "unidade",
            telefone,
            ativo: true,
            unidadeId: unidade.id,
            deveTrocarSenha: true,
          },
        })
      }

      return unidade
    })

    return NextResponse.json(
      {
        ok: true,
        unidade: serializeUnit(createdUnit),
        senhaPadrao: DEFAULT_UNIT_PASSWORD,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("[POST /api/admin/unidades] erro:", error)

    if (error?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Já existe unidade com esse nome, e-mail ou CNES." },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { ok: false, error: "Falha ao cadastrar unidade." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()

    const id = normalizeText(body?.id)
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Informe o identificador da unidade." },
        { status: 400 },
      )
    }

    const data: Record<string, unknown> = {}

    if (typeof body?.ativo === "boolean") data.ativo = body.ativo
    if (body?.nome !== undefined) data.nome = normalizeText(body.nome)
    if (body?.telefone !== undefined) data.telefone = normalizeText(body.telefone) || null
    if (body?.endereco !== undefined) data.endereco = normalizeText(body.endereco) || null

    const updatedUnit = await prisma.unidade.update({
      where: { id },
      data,
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        endereco: true,
        ativo: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      ok: true,
      unidade: serializeUnit(updatedUnit),
    })
  } catch (error: any) {
    console.error("[PATCH /api/admin/unidades] erro:", error)

    if (error?.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "Unidade não encontrada." },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { ok: false, error: "Falha ao atualizar unidade." },
      { status: 500 },
    )
  }
}