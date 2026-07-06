import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const SESSION_COOKIE_NAME = "sigajus_session"
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

export type ServerSessionPayload = {
  id: string
  nome: string
  email: string
  role: string
  perfilCodigo: string | null
  unidadeId: string | null
  iat: number
  exp: number
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeRole(value: unknown) {
  return text(value).toUpperCase()
}

function getSecret() {
  return (
    process.env.SIGAJUS_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.ASSINATURA_DIGITAL_SECRET ||
    process.env.DATABASE_URL ||
    "sigajus-session-secret-dev"
  )
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function sign(data: string) {
  return createHmac("sha256", getSecret()).update(data).digest("base64url")
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  if (left.length !== right.length) return false

  return timingSafeEqual(left, right)
}

function isAdminRole(role: unknown, perfilCodigo: unknown) {
  const roleValue = normalizeRole(role)
  const perfilValue = normalizeRole(perfilCodigo)

  return roleValue === "ADMIN" || roleValue === "ADMINISTRADOR" || perfilValue === "ADMIN"
}

function shouldUseSecureCookie(req?: Request) {
  const forced = text(process.env.SIGAJUS_SESSION_COOKIE_SECURE).toLowerCase()

  if (forced === "true") return true
  if (forced === "false") return false

  const forwardedProto = text(req?.headers.get("x-forwarded-proto")).toLowerCase()
  const appUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""

  return forwardedProto === "https" || String(appUrl).toLowerCase().startsWith("https://")
}

export function createServerSessionCookieValue(input: {
  id: string
  nome: string
  email: string
  role: string
  perfilCodigo: string | null
  unidadeId: string | null
}) {
  const now = Math.floor(Date.now() / 1000)

  const payload: ServerSessionPayload = {
    id: input.id,
    nome: input.nome,
    email: input.email,
    role: input.role,
    perfilCodigo: input.perfilCodigo,
    unidadeId: input.unidadeId,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  }

  const data = encodeBase64Url(JSON.stringify(payload))
  const signature = sign(data)

  return `${data}.${signature}`
}

export function getServerSessionCookieOptions(req?: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie(req),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

function getCookieFromRequest(req: Request, name: string) {
  const cookieStore = (req as unknown as { cookies?: { get?: (key: string) => { value?: string } | string | undefined } }).cookies
  const cookieValue = cookieStore?.get?.(name)

  if (typeof cookieValue === "string") return cookieValue
  if (cookieValue?.value) return cookieValue.value

  const cookieHeader = req.headers.get("cookie") || ""

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=")

    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="))
    }
  }

  return ""
}

export function readServerSession(req: Request) {
  const raw = getCookieFromRequest(req, SESSION_COOKIE_NAME)

  if (!raw || !raw.includes(".")) return null

  const [data, signature] = raw.split(".")

  if (!data || !signature) return null

  const expectedSignature = sign(data)

  if (!safeEqual(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(decodeBase64Url(data)) as ServerSessionPayload

    if (!payload?.id || !payload?.email || !payload?.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

export async function requireAdminRequest(req: Request) {
  const session = readServerSession(req)

  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      ),
    }
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      ativo: boolean | null
      role: string | null
      perfilCodigo: string | null
    }>
  >(
    `
      SELECT
        id::text AS id,
        ativo,
        role::text AS role,
        "perfilCodigo"::text AS "perfilCodigo"
      FROM public.usuarios
      WHERE id::text = $1
      LIMIT 1
    `,
    session.id,
  )

  const user = rows[0]

  if (!user || user.ativo === false) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Sessão inválida." },
        { status: 401 },
      ),
    }
  }

  if (!isAdminRole(user.role, user.perfilCodigo)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Acesso negado." },
        { status: 403 },
      ),
    }
  }

  return {
    ok: true as const,
    session,
  }
}
