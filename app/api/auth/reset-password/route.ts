import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ColumnRow = {
  column_name: string
}

type UsuarioRow = {
  id: string
  email: string
  ativo: boolean | null
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

function getResetSecret() {
  return (
    process.env.PASSWORD_RESET_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "troque-esta-chave-em-producao"
  )
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8")
}

function signResetPayload(payload: string) {
  return base64UrlEncode(
    createHmac("sha256", getResetSecret()).update(payload).digest(),
  )
}

function verifyResetToken(token: string) {
  const [payload, signature] = String(token || "").split(".")

  if (!payload || !signature) return null

  const expected = signResetPayload(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)

  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null

  const decoded = JSON.parse(base64UrlDecode(payload)) as {
    email?: string
    exp?: number
  }

  if (!decoded?.email || !decoded?.exp) return null
  if (Date.now() > decoded.exp) return null

  return {
    email: String(decoded.email).toLowerCase(),
  }
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const token = normalizeText(body?.token)
    const senha = String(body?.senha ?? "")
    const confirmarSenha = String(body?.confirmarSenha ?? "")

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Token inválido." },
        { status: 400 },
      )
    }

    if (senha.length < 6) {
      return NextResponse.json(
        { ok: false, error: "A nova senha deve ter pelo menos 6 caracteres." },
        { status: 400 },
      )
    }

    if (senha !== confirmarSenha) {
      return NextResponse.json(
        { ok: false, error: "As senhas não conferem." },
        { status: 400 },
      )
    }

    const payload = verifyResetToken(token)

    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "O link de redefinição é inválido ou expirou." },
        { status: 400 },
      )
    }

    const columns = await getUsuariosColumns()

    const idCol = pickFirstExisting(["id"], columns)
    const emailCol = pickFirstExisting(["email"], columns)
    const senhaCol = pickFirstExisting(["senhaHash", "senha_hash", "senha"], columns)
    const ativoCol = pickFirstExisting(["ativo"], columns)
    const deveTrocarSenhaCol = pickFirstExisting(
      ["deveTrocarSenha", "deve_trocar_senha"],
      columns,
    )

    if (!idCol || !emailCol || !senhaCol) {
      return NextResponse.json(
        { ok: false, error: "Estrutura da tabela usuarios inválida." },
        { status: 500 },
      )
    }

    const sql = `
      SELECT
        ${quoteIdent(idCol)}::text AS id,
        ${quoteIdent(emailCol)} AS email,
        ${ativoCol ? quoteIdent(ativoCol) : "TRUE"} AS ativo
      FROM public.usuarios
      WHERE LOWER(${quoteIdent(emailCol)}) = LOWER($1)
      LIMIT 1
    `

    const users = await prisma.$queryRawUnsafe<UsuarioRow[]>(sql, payload.email)
    const user = users[0]

    if (!user || user.ativo === false) {
      return NextResponse.json(
        { ok: false, error: "O link de redefinição é inválido ou expirou." },
        { status: 400 },
      )
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    const setParts = [`${quoteIdent(senhaCol)} = $1`]

    if (deveTrocarSenhaCol) {
      setParts.push(`${quoteIdent(deveTrocarSenhaCol)} = FALSE`)
    }

    const updateSql = `
      UPDATE public.usuarios
      SET ${setParts.join(", ")}
      WHERE LOWER(${quoteIdent(emailCol)}) = LOWER($2)
    `

    await prisma.$executeRawUnsafe(updateSql, senhaHash, payload.email)

    return NextResponse.json({
      ok: true,
      message: "Senha redefinida com sucesso.",
    })
  } catch (error) {
    console.error("[RESET_PASSWORD_ERROR]", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao redefinir senha." },
      { status: 500 },
    )
  }
}
