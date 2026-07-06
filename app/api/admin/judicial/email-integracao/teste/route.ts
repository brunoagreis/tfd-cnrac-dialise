import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/security/server-session"
import { testEmailTriageConnection } from "@/lib/email-triage-test"
import { previewAllEmailTriage } from "@/lib/email-triage-preview"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "connection"

    if (action === "preview") {
      const result = await previewAllEmailTriage()
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
