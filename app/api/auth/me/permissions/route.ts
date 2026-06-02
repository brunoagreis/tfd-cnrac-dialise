import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UserRow = {
  id: string
  role: string | null
  perfilCodigo: string | null
  ativo: boolean | null
}

type PerfilRow = {
  id: string
  nome: string | null
  codigo: string | null
}

type PermissaoRow = {
  modulo: string
  acao: string
}

const ADMIN_FALLBACK_PERMISSIONS = [
  "tfd.visualizar",
  "tfd.criar",
  "tfd.editar",
  "tfd.excluir",
  "tfd.imprimir",
  "tfd.interagir",
  "tfd.remover_doc",

  "pacientes.visualizar",
  "pacientes.criar",
  "pacientes.editar",
  "pacientes.excluir",
  "pacientes.imprimir",
  "pacientes.interagir",
  "pacientes.remover_doc",

  "protocolo.visualizar",
  "protocolo.criar",
  "protocolo.editar",
  "protocolo.excluir",
  "protocolo.imprimir",

  "relatorios.visualizar",
  "relatorios.imprimir",
  "relatorios.exportar",

  "judicial.visualizar",
  "judicial.criar",
  "judicial.editar",
  "judicial.encerrar",
  "judicial.interagir",
  "judicial.notificar",

  "pre_judicial.visualizar",
  "pre_judicial.criar",
  "pre_judicial.editar",
  "pre_judicial.encerrar",
  "pre_judicial.interagir",
  "pre_judicial.notificar",

  "agendamento.visualizar",
  "agendamento.criar",
  "agendamento.editar",
  "agendamento.reservar",
  "agendamento.imprimir",

  "cnrac.visualizar",
  "cnrac.criar",
  "cnrac.editar",
  "cnrac.imprimir",

  "hemodialise.visualizar",
  "hemodialise.criar",
  "hemodialise.editar",
  "hemodialise.imprimir",

  "usuarios.visualizar",
  "usuarios.criar",
  "usuarios.editar",
  "usuarios.ativar_inativar",

  "unidades.visualizar",
  "unidades.criar",
  "unidades.editar",
  "unidades.ativar_inativar",

  "permissoes.visualizar",
  "permissoes.criar_perfil",
  "permissoes.editar_permissoes",

  "admin_judicial.visualizar",
  "admin_judicial.editar_municipios",
  "admin_judicial.editar_emails",
  "admin_judicial.editar_prioridades",
]

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeCode(value: unknown) {
  return normalizeText(value).toUpperCase()
}

function normalizePermission(modulo: string, acao: string) {
  return `${normalizeText(modulo).toLowerCase()}.${normalizeText(acao).toLowerCase()}`
}

function isAdminCode(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()

  return (
    normalized === "admin" ||
    normalized === "administrador" ||
    normalized === "administrator"
  )
}

async function getPermissionsForUserId(userId: string) {
  const users = await prisma.$queryRawUnsafe<UserRow[]>(
    `
      SELECT
        id::text AS id,
        role::text AS role,
        "perfilCodigo" AS "perfilCodigo",
        ativo
      FROM public.usuarios
      WHERE id::text = $1
      LIMIT 1
    `,
    userId,
  )

  const user = users[0]

  if (!user) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "Usuário não encontrado.",
      },
    }
  }

  if (user.ativo === false) {
    return {
      status: 403,
      body: {
        ok: false,
        error: "Usuário inativo.",
      },
    }
  }

  const role = normalizeText(user.role)
  const perfilCodigo = normalizeCode(user.perfilCodigo || user.role)

  if (isAdminCode(role) || isAdminCode(perfilCodigo)) {
    return {
      status: 200,
      body: {
        ok: true,
        perfilCodigo: "ADMIN",
        permissions: ADMIN_FALLBACK_PERMISSIONS,
        permissoes: ADMIN_FALLBACK_PERMISSIONS,
      },
    }
  }

  if (!perfilCodigo) {
    return {
      status: 200,
      body: {
        ok: true,
        perfilCodigo: "",
        permissions: [],
        permissoes: [],
      },
    }
  }

  const perfis = await prisma.$queryRawUnsafe<PerfilRow[]>(
    `
      SELECT
        id::text AS id,
        nome,
        codigo
      FROM public.perfis
      WHERE UPPER(COALESCE(codigo, '')) = UPPER($1)
         OR UPPER(COALESCE(nome, '')) = UPPER($1)
      ORDER BY id
      LIMIT 1
    `,
    perfilCodigo,
  )

  const perfil = perfis[0]

  if (!perfil) {
    return {
      status: 200,
      body: {
        ok: true,
        perfilCodigo,
        permissions: [],
        permissoes: [],
      },
    }
  }

  const permissoes = await prisma.$queryRawUnsafe<PermissaoRow[]>(
    `
      SELECT
        modulo,
        acao
      FROM public.perfil_permissoes
      WHERE perfil_id::text = $1
        AND permitido = true
      ORDER BY modulo, acao
    `,
    perfil.id,
  )

  const permissions = Array.from(
    new Set(
      permissoes
        .map((item) => normalizePermission(item.modulo, item.acao))
        .filter(Boolean),
    ),
  )

  return {
    status: 200,
    body: {
      ok: true,
      perfilCodigo: normalizeCode(perfil.codigo || perfilCodigo),
      perfilNome: perfil.nome || perfilCodigo,
      permissions,
      permissoes: permissions,
    },
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const userId = normalizeText(body?.userId)

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId é obrigatório." },
        { status: 400 },
      )
    }

    const result = await getPermissionsForUserId(userId)

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("ME_PERMISSIONS_ERROR", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar permissões." },
      { status: 500 },
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = normalizeText(searchParams.get("userId"))

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Informe userId na URL. Exemplo: /api/auth/me/permissions?userId=ID_DO_USUARIO",
        },
        { status: 400 },
      )
    }

    const result = await getPermissionsForUserId(userId)

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("ME_PERMISSIONS_GET_ERROR", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar permissões." },
      { status: 500 },
    )
  }
}