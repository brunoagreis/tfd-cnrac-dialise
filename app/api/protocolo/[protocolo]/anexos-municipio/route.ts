import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  buildMunicipalityUploadDownloadUrl,
  ensureMunicipalityUploadTable,
} from "@/lib/municipality-portal-uploads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UploadRow = {
  id: string
  nomeArquivo: string | null
  tamanho: number | null
  createdAt: string | null
  municipioNome: string | null
  email: string | null
  downloadToken: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ protocolo: string }> },
) {
  try {
    await ensureMunicipalityUploadTable()

    const { protocolo } = await context.params
    const decodedProtocol = decodeURIComponent(protocolo)

    const rows = await prisma.$queryRawUnsafe<UploadRow[]>(
      `
        SELECT
          id::text AS id,
          nome_arquivo AS "nomeArquivo",
          tamanho,
          created_at::text AS "createdAt",
          municipio_nome AS "municipioNome",
          email,
          download_token AS "downloadToken"
        FROM public.municipio_portal_anexos
        WHERE protocolo = $1
        ORDER BY created_at DESC, id DESC
      `,
      decodedProtocol,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        nomeArquivo: text(row.nomeArquivo),
        tamanho: row.tamanho || 0,
        criadoEm: row.createdAt || "",
        municipioNome: text(row.municipioNome),
        email: text(row.email),
        url: row.downloadToken ? buildMunicipalityUploadDownloadUrl(row.downloadToken) : "",
      })),
    })
  } catch (error) {
    console.error("[GET /api/protocolo/[protocolo]/anexos-municipio] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao listar anexos municipais." }, { status: 500 })
  }
}
