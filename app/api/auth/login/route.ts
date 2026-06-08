import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ColumnRow = {
  column_name: string
}

type UsuarioLoginRow = {
  id: string
  nome: string
  email: string
  senhaHash: string
  role: string | null
  ativo: boolean | null
  unidadeId: string | null
  telefone: string | null
  cargo: string | null
  deveTrocarSenha: boolean | null
}

type MonitoringSessionRow = {
  sessaoOnlineId: string | null
}

type MonitoringAssignmentRow = {
  atribuicaoId: string | null
  monitoramentoId: string | null
  status: string | null
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function pickFirstExisting(candidates: string[], available: Set<string>) {
  return candidates.find((item) => available.has(item)) ?? null
}

function isBcryptHash(value: string) {
  return /^\$2[aby]\$\d+\$/.test(value)
}

function normalizeUiRole(role: string | null | undefined) {
  const normalized = normalizeText(role).toLowerCase()

  if (!normalized) return "USUARIO"

  if (normalized === "admin" || normalized === "administrador") {
    return "ADMIN"
  }

  if (
    normalized === "unidade" ||
    normalized === "unidade_hospitalar" ||
    normalized === "hospital"
  ) {
    return "UNIDADE_HOSPITALAR"
  }

  if (normalized === "medico_ses") {
    return "MEDICO_SES"
  }

  if (normalized === "regulador") {
    return "REGULADOR"
  }

  if (normalized === "operador") {
    return "OPERADOR"
  }

  if (normalized === "visualizador") {
    return "VISUALIZADOR"
  }

  return normalized.toUpperCase()
}

function isMonitoringProfile(role: string, cargo: string | null | undefined) {
  const normalizedRole = normalizeText(role).toUpperCase()
  const normalizedCargo = normalizeText(cargo).toUpperCase()

  const monitoringRoles = new Set([
    "MONITORAMENTO",
    "MONITOR",
    "MONITOR_JUDICIAL",
    "MONITORAMENTO_JUDICIAL",
    "JUDICIAL_MONITORAMENTO",
    "OPERADOR_JUDICIAL",
    "OPERADOR_MONITORAMENTO",
  ])

  if (monitoringRoles.has(normalizedRole)) return true

  return normalizedCargo.includes("MONITOR")
}

async function getUsuariosColumns() {
  const rows = await prisma.$queryRawUnsafe<ColumnRow[]>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
    ORDER BY ordinal_position
  `)

  return new Set(rows.map((row) => row.column_name))
}

async function getUnidadeNome(unidadeId: string | null) {
  if (!unidadeId) return null

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ nome: string | null }>>(
      `
        SELECT nome
        FROM public.unidades
        WHERE id::text = $1
        LIMIT 1
      `,
      unidadeId,
    )

    return rows[0]?.nome ?? null
  } catch {
    return null
  }
}

async function assignJudicialMonitoringOnLogin(user: UsuarioLoginRow) {
  try {
    const sessionRows = await prisma.$queryRawUnsafe<MonitoringSessionRow[]>(
      `
        SELECT public.judicial_registrar_login(
          $1,
          $2,
          $3,
          'JUDICIAL',
          NULL,
          NULL
        )::text AS "sessaoOnlineId"
      `,
      user.id,
      user.nome,
      user.email,
    )

    const sessaoOnlineId = sessionRows[0]?.sessaoOnlineId ?? null

    const assignmentRows = await prisma.$queryRawUnsafe<MonitoringAssignmentRow[]>(
      `
        SELECT
          atribuicao_id::text AS "atribuicaoId",
          monitoramento_id::text AS "monitoramentoId",
          status::text AS status
        FROM public.judicial_atribuir_monitoramento(
          $1,
          $2,
          $3,
          $4::bigint
        )
      `,
      user.id,
      user.nome,
      user.email,
      sessaoOnlineId,
    )

    return {
      ok: true,
      sessaoOnlineId,
      quantidade: assignmentRows.length,
    }
  } catch (error) {
    console.error("MONITORING_ASSIGNMENT_ON_LOGIN_ERROR", error)

    return {
      ok: false,
      sessaoOnlineId: null,
      quantidade: 0,
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = normalizeText(body?.email).toLowerCase()
    const senha = String(body?.senha ?? "")

    if (!email || !senha) {
      return NextResponse.json(
        { ok: false, error: "Email e senha são obrigatórios." },
        { status: 400 },
      )
    }

    const columns = await getUsuariosColumns()

    const idCol = pickFirstExisting(["id"], columns)
    const nomeCol = pickFirstExisting(["nome"], columns)
    const emailCol = pickFirstExisting(["email"], columns)
    const senhaCol = pickFirstExisting(["senhaHash", "senha_hash", "senha"], columns)

    const roleCol = pickFirstExisting(
      ["role", "papelPrincipal", "papel_principal", "perfil", "tipo"],
      columns,
    )

    const ativoCol = pickFirstExisting(["ativo"], columns)

    const unidadeIdCol = pickFirstExisting(
      ["unidadeId", "unidade_id"],
      columns,
    )

    const telefoneCol = pickFirstExisting(["telefone"], columns)
    const cargoCol = pickFirstExisting(["cargo"], columns)
    const deveTrocarSenhaCol = pickFirstExisting(
      ["deveTrocarSenha", "deve_trocar_senha"],
      columns,
    )

    if (!idCol || !nomeCol || !emailCol || !senhaCol) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A tabela usuarios não possui as colunas mínimas para autenticação.",
          debug: {
            obrigatoriasEsperadas: ["id", "nome", "email", "senhaHash/senha_hash/senha"],
          },
        },
        { status: 500 },
      )
    }

    const sql = `
      SELECT
        ${quoteIdent(idCol)}::text AS id,
        ${quoteIdent(nomeCol)} AS nome,
        ${quoteIdent(emailCol)} AS email,
        ${quoteIdent(senhaCol)} AS "senhaHash",
        ${roleCol ? `${quoteIdent(roleCol)}::text` : `NULL::text`} AS role,
        ${ativoCol ? quoteIdent(ativoCol) : `TRUE`} AS ativo,
        ${unidadeIdCol ? `${quoteIdent(unidadeIdCol)}::text` : `NULL::text`} AS "unidadeId",
        ${telefoneCol ? `${quoteIdent(telefoneCol)}::text` : `NULL::text`} AS telefone,
        ${cargoCol ? `${quoteIdent(cargoCol)}::text` : `NULL::text`} AS cargo,
        ${deveTrocarSenhaCol ? quoteIdent(deveTrocarSenhaCol) : `FALSE`} AS "deveTrocarSenha"
      FROM public.usuarios
      WHERE LOWER(${quoteIdent(emailCol)}) = LOWER($1)
      LIMIT 1
    `

    const users = await prisma.$queryRawUnsafe<UsuarioLoginRow[]>(sql, email)
    const user = users[0]

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Credenciais inválidas." },
        { status: 401 },
      )
    }

    if (user.ativo === false) {
      return NextResponse.json(
        { ok: false, error: "Usuário inativo." },
        { status: 403 },
      )
    }

    const senhaSalva = String(user.senhaHash ?? "")
    let senhaOk = false

    if (isBcryptHash(senhaSalva)) {
      senhaOk = await bcrypt.compare(senha, senhaSalva)
    } else {
      senhaOk = senha === senhaSalva
    }

    if (!senhaOk) {
      return NextResponse.json(
        { ok: false, error: "Credenciais inválidas." },
        { status: 401 },
      )
    }

    if (columns.has("ultimoLoginEm")) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE public.usuarios
          SET "ultimoLoginEm" = NOW()
          WHERE ${quoteIdent(idCol)}::text = $1
        `,
        user.id,
      )
    }

    const unidadeNome = await getUnidadeNome(user.unidadeId)
    const uiRole = normalizeUiRole(user.role)

    const monitoramento = isMonitoringProfile(uiRole, user.cargo)
      ? await assignJudicialMonitoringOnLogin(user)
      : null

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: uiRole,
        ativo: user.ativo ?? true,
        unidadeId: user.unidadeId,
        unidadeNome,
        telefone: user.telefone,
        cargo: user.cargo,
        deveTrocarSenha: user.deveTrocarSenha ?? false,
      },
      monitoramento,
    })
  } catch (error) {
    console.error("LOGIN_ERROR", error)

    return NextResponse.json(
      { ok: false, error: "Erro interno no login." },
      { status: 500 },
    )
  }
}
