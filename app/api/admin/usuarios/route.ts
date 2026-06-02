import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UsuarioRow = {
  id: string
  nome: string | null
  email: string | null
  role: string | null
  perfilCodigo: string | null
  ativo: boolean | null
  unidadeId: string | null
  telefone: string | null
  cargo: string | null
}

type UnidadeRow = {
  id: string
  nome: string | null
}

type PerfilRow = {
  codigo: string
  nome: string | null
  ativo: boolean | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizePerfilCodigo(value: unknown) {
  return text(value).toUpperCase()
}

function roleTecnicoFromPerfil(perfilCodigo: string) {
  const codigo = normalizePerfilCodigo(perfilCodigo)

  if (codigo === "ADMIN") return "admin"
  if (codigo === "UNIDADE") return "unidade"
  if (codigo === "UNIDADE_HOSPITALAR") return "unidade"
  if (codigo === "MEDICO") return "judicial"
  if (codigo === "MONITORAMENTO") return "judicial"
  if (codigo === "OPERADOR") return "pre_judicial"

  return "pre_judicial"
}

function labelPerfil(perfilCodigo: string, perfilMap: Map<string, string>) {
  const codigo = normalizePerfilCodigo(perfilCodigo)

  return perfilMap.get(codigo) || codigo || "Não informado"
}

async function getPerfisMap() {
  const rows = await prisma.$queryRawUnsafe<PerfilRow[]>(
    `
      SELECT
        codigo,
        nome,
        ativo
      FROM public.perfis
      WHERE COALESCE(ativo, TRUE) = TRUE
      ORDER BY nome ASC
    `,
  )

  return new Map(
    rows.map((item) => [
      normalizePerfilCodigo(item.codigo),
      item.nome || normalizePerfilCodigo(item.codigo),
    ]),
  )
}

async function getUnidadeNomeMap(unidadeIds: Array<string | null | undefined>) {
  const ids = Array.from(
    new Set(unidadeIds.map((item) => text(item)).filter(Boolean)),
  )

  if (ids.length === 0) {
    return new Map<string, string>()
  }

  const rows = await prisma.$queryRawUnsafe<UnidadeRow[]>(
    `
      SELECT
        id::text AS id,
        nome
      FROM public.unidades
      WHERE id::text = ANY($1::text[])
    `,
    ids,
  )

  return new Map(rows.map((item) => [item.id, item.nome || ""]))
}

async function getUnidadeNome(unidadeId: string | null | undefined) {
  const id = text(unidadeId)

  if (!id) return null

  const rows = await prisma.$queryRawUnsafe<UnidadeRow[]>(
    `
      SELECT
        id::text AS id,
        nome
      FROM public.unidades
      WHERE id::text = $1
      LIMIT 1
    `,
    id,
  )

  return rows[0]?.nome || null
}

function serializeUser(
  user: UsuarioRow,
  unidadeNome: string | null,
  perfilMap: Map<string, string>,
) {
  const perfilCodigo = normalizePerfilCodigo(
    user.perfilCodigo || user.role || "OPERADOR",
  )

  return {
    id: user.id,
    nome: user.nome || "",
    email: user.email || "",
    role: perfilCodigo,
    perfilCodigo,
    perfilNome: labelPerfil(perfilCodigo, perfilMap),
    ativo: user.ativo !== false,
    unidadeId: user.unidadeId || null,
    unidadeNome,
    telefone: user.telefone || null,
    cargo: user.cargo || null,
  }
}

async function getUserRoleEnumValues() {
  const rows = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
    `
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole'
      ORDER BY e.enumsortorder
    `,
  )

  return rows.map((item) => item.enumlabel)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = text(searchParams.get("q"))
    const perfilMap = await getPerfisMap()

    const rows = await prisma.$queryRawUnsafe<UsuarioRow[]>(
      `
        SELECT
          id::text AS id,
          nome,
          email,
          role::text AS role,
          "perfilCodigo" AS "perfilCodigo",
          ativo,
          "unidadeId"::text AS "unidadeId",
          telefone,
          cargo
        FROM public.usuarios
        WHERE
          $1 = ''
          OR nome ILIKE '%' || $1 || '%'
          OR email ILIKE '%' || $1 || '%'
          OR COALESCE("perfilCodigo", role::text) ILIKE '%' || $1 || '%'
        ORDER BY nome ASC
      `,
      q,
    )

    const unidadeMap = await getUnidadeNomeMap(
      rows.map((item) => item.unidadeId),
    )

    const users = rows.map((item) =>
      serializeUser(
        item,
        item.unidadeId ? unidadeMap.get(item.unidadeId) || null : null,
        perfilMap,
      ),
    )

    return NextResponse.json({
      ok: true,
      users,
    })
  } catch (error) {
    console.error("[GET /api/admin/usuarios] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar usuários." },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const nome = text(body?.nome)
    const email = text(body?.email).toLowerCase()
    const telefone = text(body?.telefone)
    const cargo = text(body?.cargo)
    const senha = text(body?.senha)
    const perfilCodigo = normalizePerfilCodigo(
      body?.perfilCodigo || body?.role,
    )
    const unidadeId = text(body?.unidadeId)
    const roleTecnico = roleTecnicoFromPerfil(perfilCodigo)

    if (!nome) {
      return NextResponse.json(
        { ok: false, error: "Informe o nome do usuário." },
        { status: 400 },
      )
    }

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Informe o e-mail do usuário." },
        { status: 400 },
      )
    }

    if (!senha || senha.length < 6) {
      return NextResponse.json(
        { ok: false, error: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 },
      )
    }

    if (!perfilCodigo) {
      return NextResponse.json(
        { ok: false, error: "Selecione o perfil do usuário." },
        { status: 400 },
      )
    }

    const perfilExiste = await prisma.$queryRawUnsafe<Array<{ codigo: string }>>(
      `
        SELECT codigo
        FROM public.perfis
        WHERE codigo = $1
          AND COALESCE(ativo, TRUE) = TRUE
        LIMIT 1
      `,
      perfilCodigo,
    )

    if (!perfilExiste[0] && perfilCodigo !== "ADMIN" && perfilCodigo !== "UNIDADE") {
      return NextResponse.json(
        { ok: false, error: "Perfil selecionado não existe ou está inativo." },
        { status: 400 },
      )
    }

    const enumValues = await getUserRoleEnumValues()

    if (!enumValues.includes(roleTecnico)) {
      return NextResponse.json(
        {
          ok: false,
          error: `O perfil exige o valor técnico "${roleTecnico}" no enum UserRole.`,
          debug: {
            perfilCodigo,
            roleTecnico,
            enumValues,
          },
        },
        { status: 500 },
      )
    }

    const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        SELECT id::text AS id
        FROM public.usuarios
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
      email,
    )

    if (existing[0]) {
      return NextResponse.json(
        { ok: false, error: "Já existe usuário com este e-mail." },
        { status: 409 },
      )
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    const created = await prisma.$queryRawUnsafe<UsuarioRow[]>(
      `
        INSERT INTO public.usuarios (
          id,
          nome,
          email,
          telefone,
          cargo,
          "senhaHash",
          role,
          "perfilCodigo",
          ativo,
          "unidadeId",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          'cm' || replace(gen_random_uuid()::text, '-', ''),
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::"UserRole",
          $7,
          TRUE,
          $8,
          NOW(),
          NOW()
        )
        RETURNING
          id::text AS id,
          nome,
          email,
          role::text AS role,
          "perfilCodigo" AS "perfilCodigo",
          ativo,
          "unidadeId"::text AS "unidadeId",
          telefone,
          cargo
      `,
      nome,
      email,
      telefone || null,
      cargo || null,
      senhaHash,
      roleTecnico,
      perfilCodigo,
      roleTecnico === "unidade" ? unidadeId || null : null,
    )

    const perfilMap = await getPerfisMap()
    const unidadeNome = await getUnidadeNome(created[0]?.unidadeId)

    return NextResponse.json({
      ok: true,
      user: serializeUser(created[0], unidadeNome, perfilMap),
    })
  } catch (error) {
    console.error("[POST /api/admin/usuarios] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao criar usuário." },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const id = text(body?.id)

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Informe o identificador do usuário." },
        { status: 400 },
      )
    }

    const setParts: string[] = []
    const values: unknown[] = []

    if (typeof body?.ativo === "boolean") {
      values.push(body.ativo)
      setParts.push(`ativo = $${values.length}`)
    }

    if (body?.perfilCodigo !== undefined || body?.role !== undefined) {
      const perfilCodigo = normalizePerfilCodigo(
        body?.perfilCodigo || body?.role,
      )
      const roleTecnico = roleTecnicoFromPerfil(perfilCodigo)
      const unidadeId = text(body?.unidadeId)

      if (!perfilCodigo) {
        return NextResponse.json(
          { ok: false, error: "Selecione o perfil do usuário." },
          { status: 400 },
        )
      }

      const perfilExiste = await prisma.$queryRawUnsafe<Array<{ codigo: string }>>(
        `
          SELECT codigo
          FROM public.perfis
          WHERE codigo = $1
            AND COALESCE(ativo, TRUE) = TRUE
          LIMIT 1
        `,
        perfilCodigo,
      )

      if (!perfilExiste[0] && perfilCodigo !== "ADMIN" && perfilCodigo !== "UNIDADE") {
        return NextResponse.json(
          { ok: false, error: "Perfil selecionado não existe ou está inativo." },
          { status: 400 },
        )
      }

      const enumValues = await getUserRoleEnumValues()

      if (!enumValues.includes(roleTecnico)) {
        return NextResponse.json(
          {
            ok: false,
            error: `O perfil exige o valor técnico "${roleTecnico}" no enum UserRole.`,
            debug: {
              perfilCodigo,
              roleTecnico,
              enumValues,
            },
          },
          { status: 500 },
        )
      }

      values.push(roleTecnico)
      setParts.push(`role = $${values.length}::"UserRole"`)

      values.push(perfilCodigo)
      setParts.push(`"perfilCodigo" = $${values.length}`)

      values.push(roleTecnico === "unidade" ? unidadeId || null : null)
      setParts.push(`"unidadeId" = $${values.length}`)
    }

    if (body?.telefone !== undefined) {
      values.push(text(body?.telefone) || null)
      setParts.push(`telefone = $${values.length}`)
    }

    if (body?.cargo !== undefined) {
      values.push(text(body?.cargo) || null)
      setParts.push(`cargo = $${values.length}`)
    }

    if (setParts.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nenhum campo válido foi enviado para atualização.",
        },
        { status: 400 },
      )
    }

    values.push(id)
    const idParam = values.length

    const updated = await prisma.$queryRawUnsafe<UsuarioRow[]>(
      `
        UPDATE public.usuarios
        SET
          ${setParts.join(", ")},
          "updatedAt" = NOW()
        WHERE id::text = $${idParam}
        RETURNING
          id::text AS id,
          nome,
          email,
          role::text AS role,
          "perfilCodigo" AS "perfilCodigo",
          ativo,
          "unidadeId"::text AS "unidadeId",
          telefone,
          cargo
      `,
      ...values,
    )

    if (!updated[0]) {
      return NextResponse.json(
        { ok: false, error: "Usuário não encontrado." },
        { status: 404 },
      )
    }

    const perfilMap = await getPerfisMap()
    const unidadeNome = await getUnidadeNome(updated[0].unidadeId)

    return NextResponse.json({
      ok: true,
      user: serializeUser(updated[0], unidadeNome, perfilMap),
    })
  } catch (error) {
    console.error("[PATCH /api/admin/usuarios] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar usuário." },
      { status: 500 },
    )
  }
}
