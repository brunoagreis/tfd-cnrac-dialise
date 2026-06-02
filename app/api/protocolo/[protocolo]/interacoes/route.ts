import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type InteracaoRow = {
  id: string
  demandaId: string
  texto: string
  pendencia: string | null
  createdAt: string | null
  createdBy: string | null
  createdByName: string | null
  createdByCpf: string | null
  assinaturaUrl: string | null
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function buildId(prefix: string) {
  return `${prefix}${randomUUID().replace(/-/g, "")}`
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ protocolo: string }> },
) {
  try {
    const { protocolo } = await context.params
    const decodedProtocol = decodeURIComponent(protocolo)

    const demandaRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        SELECT id::text AS id
        FROM public.demandas
        WHERE protocolo = $1
        LIMIT 1
      `,
      decodedProtocol,
    )

    const demanda = demandaRows[0]

    if (!demanda) {
      return NextResponse.json(
        { ok: false, error: "Protocolo não encontrado." },
        { status: 404 },
      )
    }

    const rows = await prisma.$queryRawUnsafe<InteracaoRow[]>(
      `
        SELECT
          i.id::text AS id,
          i."demandaId"::text AS "demandaId",
          i.texto,
          i.pendencia,
          i."createdAt"::text AS "createdAt",
          i."createdBy" AS "createdBy",
          i."createdByName" AS "createdByName",
          i."createdByCpf" AS "createdByCpf",
          i."assinaturaUrl" AS "assinaturaUrl"
        FROM public.interacoes i
        WHERE i."demandaId" = $1
        ORDER BY i."createdAt" DESC, i.id DESC
      `,
      demanda.id,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        demandaId: row.demandaId,
        texto: row.texto ?? "",
        pendencia: row.pendencia ?? undefined,
        anexos: [],
        criadoEm: row.createdAt ?? "",
        criadoPor: row.createdBy ?? "",
        criadoPorNome: row.createdByName ?? "",
        criadoPorCpf: row.createdByCpf ?? "",
        assinaturaUrl: row.assinaturaUrl ?? "",
      })),
    })
  } catch (error) {
    console.error("[GET /api/protocolo/[protocolo]/interacoes] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar interações do protocolo." },
      { status: 500 },
    )
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ protocolo: string }> },
) {
  try {
    const { protocolo } = await context.params
    const decodedProtocol = decodeURIComponent(protocolo)
    const body = await req.json().catch(() => null)

    const texto = normalizeText(body?.texto)
    const pendencia = normalizeText(body?.pendencia) || null
    const createdBy = normalizeText(body?.createdBy) || null
    const createdByName = normalizeText(body?.createdByName) || null
    const createdByCpf = normalizeText(body?.createdByCpf) || null
    const assinaturaUrl = normalizeText(body?.assinaturaUrl) || null

    if (!texto) {
      return NextResponse.json(
        { ok: false, error: "Texto da interação é obrigatório." },
        { status: 400 },
      )
    }

    const demandaRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        SELECT id::text AS id
        FROM public.demandas
        WHERE protocolo = $1
        LIMIT 1
      `,
      decodedProtocol,
    )

    const demanda = demandaRows[0]

    if (!demanda) {
      return NextResponse.json(
        { ok: false, error: "Protocolo não encontrado." },
        { status: 404 },
      )
    }

    const id = buildId("int_")

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO public.interacoes (
          id,
          "demandaId",
          texto,
          pendencia,
          "createdAt",
          "createdBy",
          "createdByName",
          "createdByCpf",
          "assinaturaUrl"
        )
        VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
      `,
      id,
      demanda.id,
      texto,
      pendencia,
      createdBy,
      createdByName,
      createdByCpf,
      assinaturaUrl,
    )

    return NextResponse.json({
      ok: true,
      item: {
        id,
        demandaId: demanda.id,
        texto,
        pendencia: pendencia ?? undefined,
        anexos: [],
        criadoEm: new Date().toISOString(),
        criadoPor: createdBy ?? "",
        criadoPorNome: createdByName ?? "",
        criadoPorCpf: createdByCpf ?? "",
        assinaturaUrl: assinaturaUrl ?? "",
      },
    })
  } catch (error) {
    console.error("[POST /api/protocolo/[protocolo]/interacoes] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao salvar interação do protocolo." },
      { status: 500 },
    )
  }
}