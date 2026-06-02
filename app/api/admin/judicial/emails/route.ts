import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TemplateRow = {
  id: string
  type: string
  title: string
  subject: string
  body: string
  updatedAt: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function mapRow(row: TemplateRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subject: row.subject,
    body: row.body,
    updatedAt: row.updatedAt,
  }
}

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<TemplateRow[]>(`
      SELECT
        id::text AS id,
        tipo_template AS type,
        titulo AS title,
        assunto AS subject,
        corpo_html AS body,
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
  try {
    const body = await req.json().catch(() => null)

    const id = normalizeText(body?.id)
    const type = normalizeText(body?.type)
    const title = normalizeText(body?.title)
    const subject = normalizeText(body?.subject)
    const bodyHtml = String(body?.body ?? "").trim()

    if (!type || !title || !subject || !bodyHtml) {
      return NextResponse.json(
        { ok: false, error: "Tipo, título, assunto e corpo são obrigatórios." },
        { status: 400 },
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
            corpo_html = $4
          WHERE id = $5::bigint
          RETURNING
            id::text AS id,
            tipo_template AS type,
            titulo AS title,
            assunto AS subject,
            corpo_html AS body,
            updated_at::text AS "updatedAt"
        `,
        type,
        title,
        subject,
        bodyHtml,
        id,
      )

      saved = updated[0]
    } else {
      const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `
          SELECT id::text AS id
          FROM public.admin_judicial_modelos_email
          WHERE LOWER(tipo_template) = LOWER($1)
          LIMIT 1
        `,
        type,
      )

      if (existing[0]?.id) {
        const updated = await prisma.$queryRawUnsafe<TemplateRow[]>(
          `
            UPDATE public.admin_judicial_modelos_email
            SET
              tipo_template = $1,
              titulo = $2,
              assunto = $3,
              corpo_html = $4
            WHERE id = $5::bigint
            RETURNING
              id::text AS id,
              tipo_template AS type,
              titulo AS title,
              assunto AS subject,
              corpo_html AS body,
              updated_at::text AS "updatedAt"
          `,
          type,
          title,
          subject,
          bodyHtml,
          existing[0].id,
        )

        saved = updated[0]
      } else {
        const inserted = await prisma.$queryRawUnsafe<TemplateRow[]>(
          `
            INSERT INTO public.admin_judicial_modelos_email (
              tipo_template,
              titulo,
              assunto,
              corpo_html
            )
            VALUES ($1, $2, $3, $4)
            RETURNING
              id::text AS id,
              tipo_template AS type,
              titulo AS title,
              assunto AS subject,
              corpo_html AS body,
              updated_at::text AS "updatedAt"
          `,
          type,
          title,
          subject,
          bodyHtml,
        )

        saved = inserted[0]
      }
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