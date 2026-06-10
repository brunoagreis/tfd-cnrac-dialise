import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AssignmentRow = {
  retAtribuicaoId?: string | null
  retMonitoramentoId?: string | null
  retStatus?: string | null
  atribuicaoId?: string | null
  monitoramentoId?: string | null
  status?: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

async function closePreviousDayIfAvailable() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF to_regprocedure('public.judicial_encerrar_monitoramento_dia(date)') IS NOT NULL THEN
        PERFORM public.judicial_encerrar_monitoramento_dia(CURRENT_DATE - 1);
      END IF;
    END $$;
  `)
}

async function assignWithCurrentFunction(userId: string, userName: string, userEmail: string) {
  return prisma.$queryRawUnsafe<AssignmentRow[]>(
    `
      SELECT
        ret_atribuicao_id::text AS "retAtribuicaoId",
        ret_monitoramento_id::text AS "retMonitoramentoId",
        ret_status::text AS "retStatus"
      FROM public.judicial_atribuir_proximo_lote(
        CURRENT_DATE,
        $1,
        $2,
        $3
      )
    `,
    userId,
    userName,
    userEmail,
  )
}

async function assignWithLegacyFunction(userId: string, userName: string, userEmail: string) {
  return prisma.$queryRawUnsafe<AssignmentRow[]>(
    `
      SELECT
        atribuicao_id::text AS "atribuicaoId",
        monitoramento_id::text AS "monitoramentoId",
        status::text AS status
      FROM public.judicial_atribuir_monitoramento(
        $1,
        $2,
        $3,
        NULL
      )
    `,
    userId,
    userName,
    userEmail,
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const userId = text(body?.user?.id || body?.userId)
    const userName = text(body?.user?.nome || body?.user?.name || body?.userName || "Monitor")
    const userEmail = text(body?.user?.email || body?.userEmail).toLowerCase()

    if (!userId && !userEmail) {
      return NextResponse.json(
        { ok: false, error: "Usuário não informado." },
        { status: 400 },
      )
    }

    await closePreviousDayIfAvailable()

    let rows: AssignmentRow[] = []
    let functionName = "judicial_atribuir_proximo_lote"

    try {
      rows = await assignWithCurrentFunction(userId, userName, userEmail)
    } catch (error) {
      console.warn("JUDICIAL_ASSIGN_CURRENT_FUNCTION_FALLBACK", error)
      functionName = "judicial_atribuir_monitoramento"
      rows = await assignWithLegacyFunction(userId, userName, userEmail)
    }

    return NextResponse.json({
      ok: true,
      functionName,
      quantidade: rows.length,
      items: rows,
    })
  } catch (error) {
    console.error("[POST /api/judicial/monitoramento/atribuir] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao garantir atribuição diária judicial." },
      { status: 500 },
    )
  }
}
