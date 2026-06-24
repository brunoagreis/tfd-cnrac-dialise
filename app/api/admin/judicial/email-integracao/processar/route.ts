import { NextRequest, NextResponse } from "next/server"
import { processUnreadEmailTriageV2 } from "@/lib/email-triage-processing-v2"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle(req: NextRequest) {
  try {
    const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("limit") || 10), 25))
    const running = processUnreadEmailTriageV2(limit)

    running.catch((error) => {
      console.error("[email-integracao/processar] erro assíncrono:", error)
    })

    const result = await Promise.race([
      running,
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            processing: true,
            processed: 0,
            message: "Triagem iniciada. O processamento continua por alguns instantes; atualize o histórico em seguida.",
          })
        }, 30000)
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
