import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

function mapRoleToUi(role: string) {
  return role === "admin" ? "ADMIN" : role === "unidade" ? "UNIDADE_HOSPITALAR" : role
}

function mapRoleToDb(roleUi: string) {
  if (roleUi === "ADMIN") return "admin"
  if (roleUi === "UNIDADE_HOSPITALAR") return "unidade"
  return null
}

function serializeUser(u: {
  id: string
  nome: string
  email: string
  role: string
  ativo: boolean
  unidadeId: string | null
}) {
  return { ...u, role: mapRoleToUi(u.role as any) }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") ?? "").trim()

    const users = await prisma.usuario.findMany({
      where: q
        ? {
            OR: [
              { nome: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        unidadeId: true,
      },
    })

    return NextResponse.json({
      ok: true,
      users: users.map((u) => serializeUser(u as any)),
    })
  } catch (e) {
    console.error("USUARIOS_GET_ERROR", e)
    return NextResponse.json({ ok: false, error: "Erro ao listar usuários." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const nome = (body?.nome ?? "").toString().trim()
    const email = (body?.email ?? "").toString().trim().toLowerCase()
    const senha = (body?.senha ?? "").toString()
    const roleUi = (body?.role ?? "").toString().trim()
    const unidadeId = body?.unidadeId ? String(body.unidadeId) : null

    if (!nome || !email || !senha || !roleUi) {
      return NextResponse.json({ ok: false, error: "Campos obrigatórios faltando." }, { status: 400 })
    }

    const roleDb = mapRoleToDb(roleUi)
    if (!roleDb) {
      return NextResponse.json({ ok: false, error: "Perfil ainda não suportado pela base atual." }, { status: 400 })
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    const created = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash,
        role: roleDb as any,
        ativo: true,
        unidadeId: roleDb === "unidade" ? unidadeId : null,
      },
      select: { id: true, nome: true, email: true, role: true, ativo: true, unidadeId: true },
    })

    return NextResponse.json({ ok: true, user: serializeUser(created as any) }, { status: 201 })
  } catch (e: any) {
    console.error("USUARIOS_POST_ERROR", e)
    if (e?.code === "P2002") {
      return NextResponse.json({ ok: false, error: "E-mail já cadastrado." }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: "Erro ao criar usuário." }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const id = String(body?.id ?? "").trim()
    const ativo = body?.ativo

    if (!id || typeof ativo !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "Parâmetros inválidos para atualização de status." },
        { status: 400 },
      )
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: { ativo },
      select: { id: true, nome: true, email: true, role: true, ativo: true, unidadeId: true },
    })

    return NextResponse.json({ ok: true, user: serializeUser(updated as any) })
  } catch (e: any) {
    console.error("USUARIOS_PATCH_ERROR", e)
    if (e?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 })
    }
    return NextResponse.json({ ok: false, error: "Erro ao atualizar usuário." }, { status: 500 })
  }
}
