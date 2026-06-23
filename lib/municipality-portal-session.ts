import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const MUNICIPALITY_SESSION_COOKIE = "sigajus_municipio_session"

type MunicipalitySessionPayload = {
  municipalityId: string
  municipalityName: string
  email: string
  exp: number
}

function sessionSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "sigajus-dev-session-secret"
}

function base64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function fromBase64url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url")
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function createMunicipalitySessionToken(payload: Omit<MunicipalitySessionPayload, "exp">) {
  const data: MunicipalitySessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  }

  const encoded = base64url(JSON.stringify(data))
  return `${encoded}.${sign(encoded)}`
}

export function verifyMunicipalitySessionToken(token: string | undefined | null) {
  if (!token) return null

  const [encoded, signature] = token.split(".")
  if (!encoded || !signature) return null
  if (!safeEqual(signature, sign(encoded))) return null

  try {
    const payload = JSON.parse(fromBase64url(encoded)) as MunicipalitySessionPayload
    if (!payload?.municipalityId || !payload?.municipalityName || !payload?.email) return null
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export async function getMunicipalitySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(MUNICIPALITY_SESSION_COOKIE)?.value
  return verifyMunicipalitySessionToken(token)
}

export async function setMunicipalitySession(payload: Omit<MunicipalitySessionPayload, "exp">) {
  const cookieStore = await cookies()
  cookieStore.set(MUNICIPALITY_SESSION_COOKIE, createMunicipalitySessionToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  })
}

export async function clearMunicipalitySession() {
  const cookieStore = await cookies()
  cookieStore.set(MUNICIPALITY_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
