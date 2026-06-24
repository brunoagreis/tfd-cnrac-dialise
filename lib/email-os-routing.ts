import { prisma } from "@/lib/prisma"
import { ensureEmailTriageTables } from "@/lib/email-triage-processing"

export const EMAIL_OS_MODULES = ["judicial", "tfd", "cnrac", "hemodialise"] as const
export type EmailOsModule = (typeof EMAIL_OS_MODULES)[number]

export function normalizeEmailOsModule(value: unknown): EmailOsModule {
  const key = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_")
  if (key === "tfd") return "tfd"
  if (key === "cnrac") return "cnrac"
  if (key === "hemodialise" || key === "hemodialise") return "hemodialise"
  return "judicial"
}

export function inferEmailOsModule(subject: unknown, classifier: unknown): EmailOsModule {
  const text = `${subject ?? ""} ${classifier ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (text.includes("cnrac")) return "cnrac"
  if (text.includes("hemodialise") || text.includes("dialise") || text.includes("hemodialise")) return "hemodialise"
  if (text.includes("tfd") || text.includes("tratamento fora")) return "tfd"
  return "judicial"
}

export async function ensureEmailOsRoutingColumns() {
  await ensureEmailTriageTables()
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS corpo_resumo TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS modulo_destino TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS responsavel_id TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS responsavel_nome TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS responsavel_email TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS convertido_demanda_id TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS convertido_protocolo TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS convertido_em TIMESTAMPTZ`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS transferido_em TIMESTAMPTZ`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS transferido_por TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_os ADD COLUMN IF NOT EXISTS transferido_por_nome TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE public.judicial_email_regras ADD COLUMN IF NOT EXISTS modulo_destino TEXT`)
}
