import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TemplateRow = {
  id: string
  type: string | null
  title: string | null
  subject: string | null
  body: string | null
  dispatchModule: string | null
  automaticDispatch: boolean | null
  updatedAt: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function mapRow(row: TemplateRow) {
  return {
    id: text(row.id),
    type: text(row.type),
    title: text(row.title || row.type || "Modelo de e-mail"),
    subject: text(row.subject),
    body: text(row.body),
    dispatchModule: text(row.dispatchModule),
    automaticDispatch: Boolean(row.automaticDispatch),
    updatedAt: text(row.updatedAt),
  }
}

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<TemplateRow[]>(
      [
        "SELECT",
        "  id::text AS id,",
        "  tipo_template AS type,",
        "  titulo AS title,",
        "  assunto AS subject,",
        "  corpo_html AS body,",
        "  COALESCE(modulo_disparo, '') AS \"dispatchModule\",",
        "  COALESCE(disparo_automatico, FALSE) AS \"automaticDispatch\",",
        "  updated_at::text AS \"updatedAt\"",
        "FROM public.admin_judicial_modelos_email",
        "WHERE COALESCE(corpo_html, '') <> ''",
        "ORDER BY titulo",
      ].join("\n"),
    )

    const items = rows.map(mapRow).filter((item) => item.id && item.body)

    return NextResponse.json({
      ok: true,
      items,
    })
  } catch (error) {
    console.error("[GET /api/judicial/email-modelos] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar modelos de e-mail." },
      { status: 500 },
    )
  }
}
