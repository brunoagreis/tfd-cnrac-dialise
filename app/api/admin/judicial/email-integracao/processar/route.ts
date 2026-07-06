import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/security/server-session"
import { startEmailTriageJob } from "@/lib/email-triage-job"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get("source") || "manual"
    const nextRunAt = req.nextUrl.searchParams.get("nextRunAt") || undefined
    const result = await startEmailTriageJob(source, nextRunAt)
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) {
    console.error("[email-integracao/processar] erro:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao processar e-mails." },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {

  const adminGuardGet = await requireAdminRequest(req)
  if (!adminGuardGet.ok) return adminGuardGet.response
  return handle(req)
}

export async function POST(req: NextRequest) {

  const adminGuardPost = await requireAdminRequest(req)
  if (!adminGuardPost.ok) return adminGuardPost.response
  return handle(req)
}
