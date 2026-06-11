import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizePriority(value: unknown) {
  const number = Number(value)

  if (!Number.isFinite(number)) return null
  if (![0, 1, 2, 3].includes(number)) return null

  return number
}

function priorityLabel(value: number) {
  if (value === 3) return "03 - Emergência"
  if (value === 2) return "02 - Urgente"
  if (value === 1) return "01 - Agilizar"
  return "00 - Normal"
}

async function findPriority(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{
    monitoramentoId: string
    prioridade: number | null
    motivo: string | null
    atualizadoEm: string | null
    atualizadoPor: string | null
  }>>(
    `
      SELECT
        b.id::text AS "monitoramentoId",
        COALESCE(b.prioridade_monitoramento, 0)::int AS prioridade,
        b.prioridade_motivo AS motivo,
        b.prioridade_atualizada_em::text AS "atualizadoEm",
        b.prioridade_atualizada_por AS "atualizadoPor"
      FROM public.judicial_monitoramento_base b
      LEFT JOIN public.demandas d ON d.id = b.demanda_id
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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const processo = await findPriority(decodedId)

    if (!processo) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    const prioridade = Number(processo.prioridade ?? 0)

    return NextResponse.json({
      ok: true,
      item: {
        monitoramentoId: processo.monitoramentoId,
        prioridade,
        prioridadeLabel: priorityLabel(prioridade),
        motivo: processo.motivo || null,
        atualizadoEm: processo.atualizadoEm || null,
        atualizadoPor: processo.atualizadoPor || null,
      },
    })
  } catch (error) {
    console.error("[GET /api/judicial/casos/[id]/prioridade] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao consultar prioridade judicial." },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))

    const prioridade = normalizePriority(body?.prioridade ?? body?.priority)
    const motivo = text(body?.motivo ?? body?.reason)
    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(body?.user?.nome || body?.user?.name || body?.userName || "Sistema")
    const userEmail = text(body?.user?.email || body?.userEmail).toLowerCase()

    if (prioridade === null) {
      return NextResponse.json(
        { ok: false, error: "Prioridade inválida. Use 0, 1, 2 ou 3." },
        { status: 400 },
      )
    }

    const processo = await findPriority(decodedId)

    if (!processo) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            prioridade_monitoramento = $2::int,
            prioridade_motivo = NULLIF($3, ''),
            prioridade_atualizada_em = NOW(),
            prioridade_atualizada_por = $4,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        processo.monitoramentoId,
        prioridade,
        motivo,
        userName,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.sistema_auditoria (
            tabela_nome,
            acao,
            registro_id,
            usuario_id,
            usuario_nome,
            usuario_email,
            modulo_codigo,
            data_hora,
            dados_anteriores,
            dados_novos,
            campos_alterados,
            observacao
          )
          VALUES (
            'judicial_monitoramento_base',
            'atualizar_prioridade_judicial',
            $1,
            $2,
            $3,
            $4,
            'JUDICIAL',
            NOW(),
            jsonb_build_object(),
            jsonb_build_object(
              'prioridade_monitoramento', $5::int,
              'prioridade_label', $6::text,
              'prioridade_motivo', $7::text
            ),
            jsonb_build_array('prioridade_monitoramento', 'prioridade_motivo'),
            $8
          )
        `,
        processo.monitoramentoId,
        userId,
        userName,
        userEmail || null,
        prioridade,
        priorityLabel(prioridade),
        motivo || null,
        `Prioridade judicial alterada para ${priorityLabel(prioridade)}${motivo ? `: ${motivo}` : ""}`,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        monitoramentoId: processo.monitoramentoId,
        prioridade,
        prioridadeLabel: priorityLabel(prioridade),
        motivo: motivo || null,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: userName,
      },
    })
  } catch (error) {
    console.error("[PATCH /api/judicial/casos/[id]/prioridade] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar prioridade judicial." },
      { status: 500 },
    )
  }
}
