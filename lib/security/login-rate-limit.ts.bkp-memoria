import { prisma } from "@/lib/prisma"

type LoginAttemptDbRow = {
  id: string
  quantidade: number
  primeiraTentativaEm: Date
  bloqueadoAte: Date | null
}

type LoginAttemptKey = {
  id: string
  email: string
  ip: string | null
  tipo: "email" | "combo"
}

const LOGIN_MAX_FAILURES = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_WINDOW_SECONDS = 15 * 60
const LOGIN_BLOCK_MS = 30 * 60 * 1000

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = req.headers.get("x-real-ip")?.trim()
  const cfIp = req.headers.get("cf-connecting-ip")?.trim()

  return String(forwarded || realIp || cfIp || "ip-desconhecido")
    .replace(/[^\w:., -]/g, "")
    .slice(0, 80)
}

function normalizeEmail(email: string) {
  return String(email ?? "").trim().toLowerCase().slice(0, 320) || "email-vazio"
}

function keys(req: Request, email: string): LoginAttemptKey[] {
  const ip = getClientIp(req)
  const cleanEmail = normalizeEmail(email)

  return [
    {
      id: `email:${cleanEmail}`,
      email: cleanEmail,
      ip: null,
      tipo: "email",
    },
    {
      id: `combo:${ip}:${cleanEmail}`,
      email: cleanEmail,
      ip,
      tipo: "combo",
    },
  ]
}

async function clearExpired() {
  await prisma.$executeRawUnsafe(
    `
      DELETE FROM public.login_tentativas
      WHERE primeira_tentativa_em < NOW() - ($1::int * INTERVAL '1 second')
        AND (bloqueado_ate IS NULL OR bloqueado_ate < NOW())
    `,
    LOGIN_WINDOW_SECONDS,
  )
}

async function getAttempt(id: string) {
  const rows = await prisma.$queryRawUnsafe<LoginAttemptDbRow[]>(
    `
      SELECT
        id,
        quantidade,
        primeira_tentativa_em AS "primeiraTentativaEm",
        bloqueado_ate AS "bloqueadoAte"
      FROM public.login_tentativas
      WHERE id = $1
      LIMIT 1
    `,
    id,
  )

  return rows[0] ?? null
}

function isWindowExpired(row: LoginAttemptDbRow) {
  return Date.now() - new Date(row.primeiraTentativaEm).getTime() > LOGIN_WINDOW_MS
}

async function saveNewAttempt(item: LoginAttemptKey) {
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO public.login_tentativas (
        id,
        email,
        ip,
        tipo,
        quantidade,
        primeira_tentativa_em,
        bloqueado_ate,
        ultima_tentativa_em,
        criado_em,
        atualizado_em
      )
      VALUES ($1, $2, $3, $4, 1, NOW(), NULL, NOW(), NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        ip = EXCLUDED.ip,
        tipo = EXCLUDED.tipo,
        quantidade = 1,
        primeira_tentativa_em = NOW(),
        bloqueado_ate = NULL,
        ultima_tentativa_em = NOW(),
        atualizado_em = NOW()
    `,
    item.id,
    item.email,
    item.ip,
    item.tipo,
  )
}

async function saveExistingAttempt(item: LoginAttemptKey, row: LoginAttemptDbRow) {
  const quantidade = Number(row.quantidade ?? 0) + 1
  const bloqueadoAte =
    quantidade >= LOGIN_MAX_FAILURES
      ? new Date(Date.now() + LOGIN_BLOCK_MS)
      : row.bloqueadoAte

  await prisma.$executeRawUnsafe(
    `
      UPDATE public.login_tentativas
      SET
        email = $2,
        ip = $3,
        tipo = $4,
        quantidade = $5,
        bloqueado_ate = $6::timestamptz,
        ultima_tentativa_em = NOW(),
        atualizado_em = NOW()
      WHERE id = $1
    `,
    item.id,
    item.email,
    item.ip,
    item.tipo,
    quantidade,
    bloqueadoAte,
  )
}

export async function checkLoginRateLimit(req: Request, email: string) {
  await clearExpired()

  for (const item of keys(req, email)) {
    const row = await prisma.$queryRawUnsafe<{ bloqueadoAte: Date | null }[]>(
      `
        SELECT bloqueado_ate AS "bloqueadoAte"
        FROM public.login_tentativas
        WHERE id = $1
          AND bloqueado_ate IS NOT NULL
          AND bloqueado_ate > NOW()
        LIMIT 1
      `,
      item.id,
    )

    const blockedUntil = row[0]?.bloqueadoAte

    if (blockedUntil) {
      return {
        blocked: true,
        retryAfterSeconds: Math.ceil(
          (new Date(blockedUntil).getTime() - Date.now()) / 1000,
        ),
      }
    }
  }

  return { blocked: false, retryAfterSeconds: 0 }
}

export async function registerFailedLogin(req: Request, email: string) {
  await clearExpired()

  for (const item of keys(req, email)) {
    const row = await getAttempt(item.id)

    if (!row || isWindowExpired(row)) {
      await saveNewAttempt(item)
    } else {
      await saveExistingAttempt(item, row)
    }
  }
}

export async function clearSuccessfulLoginAttempts(req: Request, email: string) {
  for (const item of keys(req, email)) {
    await prisma.$executeRawUnsafe(
      `
        DELETE FROM public.login_tentativas
        WHERE id = $1
      `,
      item.id,
    )
  }
}

export function delayInvalidLogin() {
  return new Promise((resolve) => setTimeout(resolve, 300))
}
