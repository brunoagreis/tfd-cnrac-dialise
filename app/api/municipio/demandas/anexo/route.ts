import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMunicipalitySession } from "@/lib/municipality-portal-session"
import { safeFlagDemandForMunicipalityInteraction } from "@/lib/municipality-portal-safe-signal"
import {
  buildMunicipalityUploadDownloadUrl,
  createMunicipalityUploadToken,
  ensureMunicipalityUploadTable,
} from "@/lib/municipality-portal-uploads"

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

    await ensureMunicipalityUploadTable()

    const form = await req.formData()
    const protocolo = text(form.get("protocolo"))
    const file = form.get("file")

    if (!protocolo || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Informe protocolo e arquivo." }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Arquivo maior que 10 MB." }, { status: 400 })
    }

    const demand = await findDemand(protocolo, session.municipalityName)
    if (!demand) {
      return NextResponse.json({ ok: false, error: "Protocolo nao encontrado para este municipio." }, { status: 404 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const token = createMunicipalityUploadToken()
    const downloadUrl = buildMunicipalityUploadDownloadUrl(token)

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO public.municipio_portal_anexos (
          protocolo,
          demanda_id,
          municipio_id,
          municipio_nome,
          email,
          nome_arquivo,
          mime_type,
          tamanho,
          conteudo,
          download_token,
          created_at
        )
        VALUES ($1, $2, $3::bigint, $4, $5, $6, $7, $8, $9, $10, NOW())
      `,
      protocolo,
      demand.id,
      session.municipalityId,
      session.municipalityName,
      session.email,
      file.name,
      file.type || "application/octet-stream",
      file.size,
      bytes,
      token,
    )

    const interactionText = `ANEXO DO MUNICIPIO\nArquivo: ${file.name}\nTamanho: ${Math.round(file.size / 1024)} KB\nLink: ${downloadUrl}`

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
        VALUES ($1, $2, $3, NULL, NOW(), $4, $5, NULL, $6)
      `,
      buildId("int_"),
      demand.id,
      interactionText,
      `municipio:${session.municipalityId}`,
      `Municipio: ${session.municipalityName}`,
      downloadUrl,
    )

    await safeFlagDemandForMunicipalityInteraction({ demandaId: demand.id, protocolo })

    return NextResponse.json({ ok: true, downloadUrl })
  } catch (error) {
    console.error("[POST /api/municipio/demandas/anexo] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao anexar arquivo." }, { status: 500 })
  }
}
