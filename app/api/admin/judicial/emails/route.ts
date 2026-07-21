import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { readServerSession, requireAdminRequest } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TemplateRow = {
  id: string
  type: string
  title: string
  subject: string
  body: string
  dispatchModule: string | null
  automaticDispatch: boolean | null
  updatedAt: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeModule(value: unknown) {
  const module = normalizeText(value).toLowerCase().replace(/\s+/g, "_").replace("-", "_")
  if (["tfd", "cnrac", "hemodialise", "judicial", "pre_judicial"].includes(module)) return module
  return ""
}

function mapRow(row: TemplateRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subject: row.subject,
    body: row.body,
    dispatchModule: row.dispatchModule ?? "",
    automaticDispatch: Boolean(row.automaticDispatch),
    updatedAt: row.updatedAt,
  }
}

async function ensureEmailDispatchColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.admin_judicial_modelos_email
      ADD COLUMN IF NOT EXISTS modulo_disparo TEXT
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.admin_judicial_modelos_email
      ADD COLUMN IF NOT EXISTS disparo_automatico BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS admin_judicial_modelos_email_auto_modulo_uniq
    ON public.admin_judicial_modelos_email (LOWER(modulo_disparo))
    WHERE disparo_automatico = TRUE AND NULLIF(TRIM(modulo_disparo), '') IS NOT NULL
  `)
}

export async function GET(req: Request) {

  const session = readServerSession(req)
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sessão expirada. Faça login novamente." },
      { status: 401 },
    )
  }

  try {
    await ensureEmailDispatchColumns()

    const rows = await prisma.$queryRawUnsafe<TemplateRow[]>(`
      SELECT
        id::text AS id,
        tipo_template AS type,
        titulo AS title,
        assunto AS subject,
        corpo_html AS body,
        modulo_disparo AS "dispatchModule",
        disparo_automatico AS "automaticDispatch",
        updated_at::text AS "updatedAt"
      FROM public.admin_judicial_modelos_email
      ORDER BY titulo
    `)

    return NextResponse.json({
      ok: true,
      items: rows.map(mapRow),
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/emails] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar modelos de e-mail." },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    await ensureEmailDispatchColumns()

    const body = await req.json().catch(() => null)

    const id = normalizeText(body?.id)
    const type = normalizeText(body?.type)
    const title = normalizeText(body?.title)
    const subject = normalizeText(body?.subject)
    const bodyHtml = String(body?.body ?? "").trim()
    const dispatchModule = normalizeModule(body?.dispatchModule ?? body?.moduloDisparo ?? body?.module)
    const automaticDispatch = Boolean(body?.automaticDispatch ?? body?.disparoAutomatico)

    if (!type || !title || !subject || !bodyHtml) {
      return NextResponse.json(
        { ok: false, error: "Tipo, título, assunto e corpo são obrigatórios." },
        { status: 400 },
      )
    }

    if (automaticDispatch && !dispatchModule) {
      return NextResponse.json(
        { ok: false, error: "Informe o módulo do disparo automático." },
        { status: 400 },
      )
    }

    if (automaticDispatch && dispatchModule) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE public.admin_judicial_modelos_email
          SET disparo_automatico = FALSE
          WHERE LOWER(COALESCE(modulo_disparo, '')) = LOWER($1)
            AND ($2 = '' OR id::text <> $2)
        `,
        dispatchModule,
        id,
      )
    }

    let saved: TemplateRow | undefined

    if (id) {
      const updated = await prisma.$queryRawUnsafe<TemplateRow[]>(
        `
          UPDATE public.admin_judicial_modelos_email
          SET
            tipo_template = $1,
            titulo = $2,
            assunto = $3,
            corpo_html = $4,
            modulo_disparo = NULLIF($5, ''),
            disparo_automatico = $6,
            updated_at = NOW()
          WHERE id = $7::bigint
          RETURNING
            id::text AS id,
            tipo_template AS type,
            titulo AS title,
            assunto AS subject,
            corpo_html AS body,
            modulo_disparo AS "dispatchModule",
            disparo_automatico AS "automaticDispatch",
            updated_at::text AS "updatedAt"
        `,
        type,
        title,
        subject,
        bodyHtml,
        dispatchModule,
        automaticDispatch,
        id,
      )

      saved = updated[0]
    } else {
      // Sem id: sempre cria um novo modelo.
      // Modelos do mesmo tipo podem coexistir.
      const inserted = await prisma.$queryRawUnsafe<TemplateRow[]>(
        `
          INSERT INTO public.admin_judicial_modelos_email (
            tipo_template,
            titulo,
            assunto,
            corpo_html,
            modulo_disparo,
            disparo_automatico,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            NULLIF($5, ''),
            $6,
            NOW()
          )
          RETURNING
            id::text AS id,
            tipo_template AS type,
            titulo AS title,
            assunto AS subject,
            corpo_html AS body,
            modulo_disparo AS "dispatchModule",
            disparo_automatico AS "automaticDispatch",
            updated_at::text AS "updatedAt"
        `,
        type,
        title,
        subject,
        bodyHtml,
        dispatchModule,
        automaticDispatch,
      )

      saved = inserted[0]
    }

    if (!saved) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível salvar o modelo de e-mail." },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      item: mapRow(saved),
    })
  } catch (error) {
    console.error("[POST /api/admin/judicial/emails] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao salvar modelo de e-mail." },
      { status: 500 },
    )
  }
}
