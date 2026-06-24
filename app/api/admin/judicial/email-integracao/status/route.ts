import { NextResponse } from "next/server"
import { getEmailTriageStatus } from "@/lib/email-triage-job"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const status = await getEmailTriageStatus()
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    console.error("[email-integracao/status] erro:", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao carregar status." }, { status: 500 })
  }
}
