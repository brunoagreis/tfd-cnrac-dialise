import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMunicipalitySession } from "@/lib/municipality-portal-session"
import { flagDemandForMunicipalityInteraction } from "@/lib/municipality-portal-notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(value: unknown) {
  return String(value ?? "").trim()
}

function buildId(prefix: string) {
  return `${prefix}${randomUUID().replace(/-/g, "")}`
}

async function findDemand(protocolo: string, municipio: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT d.id::text AS id
      FROM public.demandas d
      INNER JOIN public.pacientes p ON p.id = d."pacienteId"
      WHERE d.protocolo = $1
        AND LOWER(TRIM(COALESCE(NULLIF(TRIM(d."localSolicitado"), ''), p.municipio, ''))) = LOWER(TRIM($2))
      LIMIT 1
    `,
    protocolo,
    municipio,
  )
  return rows[0] || null
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMunicipalitySession()
    if (!session) return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const protocolo = text(body?.protocolo)
    const texto = text(body?.texto)

    if (!protocolo || !texto) {
      return NextResponse.json({ ok: false, error: "Informe protocolo e texto." }, { status: 400 })
    }

    const demand = await findDemand(protocolo, session.municipalityName)
    if (!demand) {
      return NextResponse.json({ ok: false, error: "Protocolo nao encontrado para este municipio." }, { status: 404 })
    }

    const id = buildId("int_")
    const createdBy = `municipio:${session.municipalityId}`
    const createdByName = `Municipio: ${session.municipalityName}`

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
        VALUES ($1, $2, $3, NULL, NOW(), $4, $5, NULL, NULL)
      `,
      id,
      demand.id,
      texto,
      createdBy,
      createdByName,
    )

    await flagDemandForMunicipalityInteraction({ demandaId: demand.id, protocolo })

    return NextResponse.json({ ok: true, item: { id, texto, createdByName, createdAt: new Date().toISOString() } })
  } catch (error) {
    console.error("[POST /api/municipio/demandas/interacao] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao salvar resposta." }, { status: 500 })
  }
}
