import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JudicialBaseRow = {
  monitoramentoId: string
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

async function findJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<JudicialBaseRow[]>(
    `
      SELECT b.id::text AS "monitoramentoId"
      FROM public.judicial_monitoramento_base b
      LEFT JOIN public.demandas d
        ON d.id = b.demanda_id
      WHERE UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'
        AND (
          b.id::text = $1
          OR b.demanda_id::text = $1
          OR b.origem_registro_id::text = $1
          OR d.id::text = $1
          OR d.protocolo::text = $1
        )
      ORDER BY b.id DESC
      LIMIT 1
    `,
    decodedId,
  )

  return rows[0] ?? null
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))

    const action = text(body?.action || body?.acao || "iniciar").toLowerCase()
    const userId = text(body?.user?.id || body?.userId)
    const userEmail = text(body?.user?.email || body?.userEmail).toLowerCase()
    const userName = text(body?.user?.nome || body?.user?.name || body?.userName)

    if (!userId && !userEmail) {
      return NextResponse.json(
        { ok: false, error: "Usuário não informado." },
        { status: 400 },
      )
    }

    const processo = await findJudicialCase(decodedId)

    if (!processo) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    if (action === "finalizar") {
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `
          UPDATE public.judicial_monitoramento_atribuicoes
          SET
            status = 'FINALIZADO',
            iniciado_em = COALESCE(iniciado_em, NOW()),
            finalizado_em = COALESCE(finalizado_em, NOW()),
            observacao = COALESCE(observacao, '') || CASE
              WHEN COALESCE(observacao, '') = '' THEN ''
              ELSE E'\n'
            END || 'Finalizado pelo monitor em ' || to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            usuario_nome = COALESCE(NULLIF($4, ''), usuario_nome),
            updated_at = NOW()
          WHERE data_referencia = CURRENT_DATE
            AND monitoramento_id = $1::bigint
            AND (
              NULLIF($2, '') IS NOT NULL AND usuario_id = $2
              OR NULLIF($3, '') IS NOT NULL AND LOWER(COALESCE(usuario_email, '')) = $3
            )
            AND status <> 'CANCELADO'
          RETURNING id::text AS id
        `,
        processo.monitoramentoId,
        userId,
        userEmail,
        userName,
      )

      return NextResponse.json({ ok: true, updated: rows.length })
    }

    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `
        UPDATE public.judicial_monitoramento_atribuicoes
        SET
          status = 'EM_MONITORAMENTO',
          iniciado_em = COALESCE(iniciado_em, NOW()),
          usuario_nome = COALESCE(NULLIF($4, ''), usuario_nome),
          updated_at = NOW()
        WHERE data_referencia = CURRENT_DATE
          AND monitoramento_id = $1::bigint
          AND (
            NULLIF($2, '') IS NOT NULL AND usuario_id = $2
            OR NULLIF($3, '') IS NOT NULL AND LOWER(COALESCE(usuario_email, '')) = $3
          )
          AND status IN ('ATRIBUIDO', 'EM_ANALISE', 'EM_MONITORAMENTO')
        RETURNING id::text AS id
      `,
      processo.monitoramentoId,
      userId,
      userEmail,
      userName,
    )

    return NextResponse.json({ ok: true, updated: rows.length })
  } catch (error) {
    console.error("[PATCH /api/judicial/casos/[id]/atribuicao] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar atribuição judicial." },
      { status: 500 },
    )
  }
}
