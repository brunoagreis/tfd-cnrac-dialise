import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  buildAssinaturaValidationUrl,
  hasMedicalDigitalSignature,
} from "@/lib/assinatura-digital"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Row = {
  id: string
  texto: string | null
  assinaturaUrl: string | null
}

export async function GET(req: NextRequest) {
  try {
    const id = String(req.nextUrl.searchParams.get("id") ?? "").trim()

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Informe o identificador da movimentação." },
        { status: 400 },
      )
    }

    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `
        SELECT
          i.id::text AS id,
          i.texto,
          i."assinaturaUrl" AS "assinaturaUrl"
        FROM public.interacoes i
        WHERE i.id::text = $1
        LIMIT 1
      `,
      id,
    )

    const item = rows[0]

    if (!item || !hasMedicalDigitalSignature(item.texto, item.assinaturaUrl)) {
      return NextResponse.json(
        { ok: false, error: "Assinatura digital não encontrada." },
        { status: 404 },
      )
    }

    const validationUrl = buildAssinaturaValidationUrl(req.nextUrl.origin, id)
    const QRCode = require("qrcode") as {
      toString: (
        value: string,
        options: Record<string, unknown>,
      ) => Promise<string>
    }

    const svg = await QRCode.toString(validationUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
    })

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[GET /api/assinaturas/qrcode] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao gerar QR Code da assinatura." },
      { status: 500 },
    )
  }
}
