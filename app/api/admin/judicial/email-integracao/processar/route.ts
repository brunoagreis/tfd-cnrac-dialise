import { NextRequest, NextResponse } from "next/server"
import { processUnreadEmailTriage } from "@/lib/email-triage-processing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle(req: NextRequest) {
  try {
    const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("limit") || 10), 10))
    const processing = processUnreadEmailTriage(limit)

    processing.catch((error) => {
      console.error("[email-integracao/processar] erro assíncrono:", error)
    })

    const result = await Promise.race([
      processing,
      new Promise((resolve) => {
        setTimeout(
          () => resolve({
            ok: true,
            accepted: true,
            processing: true,
            processed: 0,
            message: "Triagem iniciada. Se houver anexos grandes, ela continua em segundo plano por alguns instantes.",
          }),
          15000,
        )
      }),
    ])

    return NextResponse.json(result, { status: (result as any)?.ok ? 200 : 400 })
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
