import { NextRequest, NextResponse } from "next/server"
import { previewEmailTriage, testEmailTriageConnection } from "@/lib/email-triage-test"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "connection"
    const limit = Number(url.searchParams.get("limit") || 10)

    if (action === "preview") {
      const result = await previewEmailTriage(limit)
      return NextResponse.json(result, { status: result.ok ? 200 : 400 })
    }

    const result = await testEmailTriageConnection()
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) {
    console.error("[GET /api/admin/judicial/email-integracao/teste] erro:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao testar integração de e-mail." },
      { status: 500 },
    )
  }
}
