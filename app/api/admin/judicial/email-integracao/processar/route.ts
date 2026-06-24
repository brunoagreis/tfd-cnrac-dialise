import { NextRequest, NextResponse } from "next/server"
import { processUnreadEmailTriage } from "@/lib/email-triage-processing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle(req: NextRequest) {
  try {
    const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("limit") || 10), 25))
    const result = await processUnreadEmailTriage(limit)
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
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
