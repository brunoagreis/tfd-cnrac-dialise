import { NextRequest, NextResponse } from "next/server"

import { buildAssinaturaValidationUrl } from "@/lib/assinatura-digital"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const id = String(req.nextUrl.searchParams.get("id") ?? "").trim()

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Informe o identificador da movimentação." },
      { status: 400 },
    )
  }

  return NextResponse.redirect(buildAssinaturaValidationUrl(req.nextUrl.origin, id))
}
