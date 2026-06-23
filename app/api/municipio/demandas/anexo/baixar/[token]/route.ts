import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureMunicipalityUploadTable } from "@/lib/municipality-portal-uploads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UploadRow = {
  nomeArquivo: string | null
  mimeType: string | null
  conteudo: Buffer | Uint8Array | string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function sanitizeFilename(value: unknown) {
  return text(value).replace(/[\r\n"]/g, "_") || "anexo"
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureMunicipalityUploadTable()

    const { token } = await context.params
    const safeToken = text(token)

    if (!safeToken) {
      return NextResponse.json({ ok: false, error: "Anexo inválido." }, { status: 400 })
    }

    const rows = await prisma.$queryRawUnsafe<UploadRow[]>(
      `
        SELECT
          nome_arquivo AS "nomeArquivo",
          mime_type AS "mimeType",
          conteudo
        FROM public.municipio_portal_anexos
        WHERE download_token = $1
        LIMIT 1
      `,
      safeToken,
    )

    const upload = rows[0]
    if (!upload?.conteudo) {
      return NextResponse.json({ ok: false, error: "Anexo não encontrado." }, { status: 404 })
    }

    const buffer = Buffer.isBuffer(upload.conteudo)
      ? upload.conteudo
      : typeof upload.conteudo === "string"
        ? Buffer.from(upload.conteudo, "base64")
        : Buffer.from(upload.conteudo)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": text(upload.mimeType) || "application/octet-stream",
        "Content-Disposition": `inline; filename="${sanitizeFilename(upload.nomeArquivo)}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("[GET /api/municipio/demandas/anexo/baixar/[token]] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao abrir anexo." }, { status: 500 })
  }
}
