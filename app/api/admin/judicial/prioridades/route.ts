import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PriorityRow = {
  id: string
  tipoPrioridade: string
  mode: "procedure" | "cid"
  value: string
  label: string
  expiresAt: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

type PriorityItemInput = {
  id?: string
  mode: "procedure" | "cid"
  value: string
  label: string
  expiresAt?: string | null
  createdAt?: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function mapRow(row: PriorityRow) {
  return {
    id: row.id,
    mode: row.mode,
    value: row.value,
    label: row.label,
    expiresAt: row.expiresAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tipoPrioridade =
      normalizeText(searchParams.get("tipoPrioridade")) || "monitoramento"

    const rows = await prisma.$queryRawUnsafe<PriorityRow[]>(
      `
        SELECT
          id::text AS id,
          tipo_prioridade AS "tipoPrioridade",
          modo AS mode,
          valor AS value,
          rotulo AS label,
          expires_at::text AS "expiresAt",
          ativo AS active,
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM public.admin_judicial_prioridades
        WHERE LOWER(tipo_prioridade) = LOWER($1)
          AND ativo = TRUE
        ORDER BY created_at, id
      `,
      tipoPrioridade,
    )

    return NextResponse.json({
      ok: true,
      tipoPrioridade,
      items: rows.map(mapRow),
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/prioridades] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar prioridades." },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const tipoPrioridade =
      normalizeText(body?.tipoPrioridade) || "monitoramento"

    const items = Array.isArray(body?.items)
      ? (body.items as PriorityItemInput[])
      : []

    await prisma.$executeRawUnsafe(
      `
        DELETE FROM public.admin_judicial_prioridades
        WHERE LOWER(tipo_prioridade) = LOWER($1)
      `,
      tipoPrioridade,
    )

    const sanitizedItems = items
      .map((item) => ({
        mode:
          item?.mode === "cid" || item?.mode === "procedure"
            ? item.mode
            : null,
        value: normalizeText(item?.value),
        label: normalizeText(item?.label),
        expiresAt: normalizeText(item?.expiresAt),
        createdAt: normalizeText(item?.createdAt),
      }))
      .filter((item) => item.mode && item.value && item.label)

    for (const item of sanitizedItems) {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO public.admin_judicial_prioridades (
            tipo_prioridade,
            modo,
            valor,
            rotulo,
            expires_at,
            ativo,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            NULLIF($5, '')::date,
            TRUE,
            COALESCE(NULLIF($6, '')::timestamptz, NOW()),
            NOW()
          )
        `,
        tipoPrioridade,
        item.mode,
        item.value,
        item.label,
        item.expiresAt || "",
        item.createdAt || "",
      )
    }

    const rows = await prisma.$queryRawUnsafe<PriorityRow[]>(
      `
        SELECT
          id::text AS id,
          tipo_prioridade AS "tipoPrioridade",
          modo AS mode,
          valor AS value,
          rotulo AS label,
          expires_at::text AS "expiresAt",
          ativo AS active,
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM public.admin_judicial_prioridades
        WHERE LOWER(tipo_prioridade) = LOWER($1)
          AND ativo = TRUE
        ORDER BY created_at, id
      `,
      tipoPrioridade,
    )

    return NextResponse.json({
      ok: true,
      tipoPrioridade,
      items: rows.map(mapRow),
    })
  } catch (error) {
    console.error("[POST /api/admin/judicial/prioridades] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao salvar prioridades." },
      { status: 500 },
    )
  }
}