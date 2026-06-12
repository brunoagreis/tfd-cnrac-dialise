import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AssignmentRow = {
  atribuicaoId: string
  monitoramentoId: string
  status: string
  blocoNumero: number | null
  ordemNoBloco: number | null
  motivoPrioridade: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

async function closePreviousOpenAssignments() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      UPDATE public.judicial_monitoramento_base b
      SET
        pendente_dia_anterior = TRUE,
        status_monitoramento_atual = 'PENDENTE',
        updated_at = NOW()
      FROM public.judicial_monitoramento_atribuicoes a
      WHERE a.monitoramento_id = b.id
        AND a.data_referencia < CURRENT_DATE
        AND a.status IN ('ATRIBUIDO', 'EM_ANALISE', 'EM_MONITORAMENTO')
        AND COALESCE(b.ativo_monitoramento, TRUE) = TRUE
        AND UPPER(COALESCE(b.status_monitoramento_atual, '')) <> 'MONITORAMENTO_AUTOMATICO'
    `)

    await tx.$executeRawUnsafe(`
      UPDATE public.judicial_monitoramento_atribuicoes
      SET
        status = 'NAO_FINALIZADO_DIA',
        observacao = CASE
          WHEN COALESCE(observacao, '') = '' THEN 'ENCERRADO AUTOMATICAMENTE AO ABRIR FILA DO DIA SEGUINTE'
          ELSE observacao || E'\nENCERRADO AUTOMATICAMENTE AO ABRIR FILA DO DIA SEGUINTE'
        END,
        updated_at = NOW()
      WHERE data_referencia < CURRENT_DATE
        AND status IN ('ATRIBUIDO', 'EM_ANALISE', 'EM_MONITORAMENTO')
    `)

    await tx.$executeRawUnsafe(`
      UPDATE public.judicial_monitoramento_execucao_diaria
      SET
        qtde_aberta = 0,
        status = 'FECHADO',
        updated_at = NOW()
      WHERE data_referencia < CURRENT_DATE
        AND status = 'ABERTO'
    `)
  })
}

async function ensureDailyAssignment(userId: string, userName: string, userEmail: string) {
  return prisma.$transaction(async (tx) => {
    const openedRows = await tx.$queryRawUnsafe<AssignmentRow[]>(
      `
        SELECT
          a.id::text AS "atribuicaoId",
          a.monitoramento_id::text AS "monitoramentoId",
          a.status,
          a.bloco_numero AS "blocoNumero",
          a.ordem_no_bloco AS "ordemNoBloco",
          a.motivo_prioridade AS "motivoPrioridade"
        FROM public.judicial_monitoramento_atribuicoes a
        WHERE a.data_referencia = CURRENT_DATE
          AND a.usuario_id = $1
          AND a.status IN ('ATRIBUIDO', 'EM_ANALISE', 'EM_MONITORAMENTO')
        ORDER BY a.bloco_numero, a.ordem_no_bloco, a.id
      `,
      userId,
    )

    if (openedRows.length > 0) {
      return {
        created: false,
        quantidade: openedRows.length,
        items: openedRows,
      }
    }

    const countRows = await tx.$queryRawUnsafe<Array<{ total: number }>>(
      `
        SELECT COUNT(*)::int AS total
        FROM public.judicial_monitoramento_atribuicoes
        WHERE data_referencia = CURRENT_DATE
          AND usuario_id = $1
      `,
      userId,
    )

    const totalToday = Number(countRows[0]?.total ?? 0)
    const lotSize = totalToday === 0 ? 20 : 5

    const blockRows = await tx.$queryRawUnsafe<Array<{ nextBlock: number }>>(
      `
        SELECT COALESCE(MAX(bloco_numero), 0)::int + 1 AS "nextBlock"
        FROM public.judicial_monitoramento_atribuicoes
        WHERE data_referencia = CURRENT_DATE
          AND usuario_id = $1
      `,
      userId,
    )

    const nextBlock = Number(blockRows[0]?.nextBlock ?? 1)

    const insertedRows = await tx.$queryRawUnsafe<AssignmentRow[]>(
      `
        WITH candidatos AS (
          SELECT
            jm.id AS monitoramento_id,
            GREATEST(0, LEAST(COALESCE(jm.prioridade_monitoramento, 0), 3))::int AS prioridade_manual,
            CASE
              WHEN jm.pendente_dia_anterior = TRUE THEN 1
              WHEN jm.data_proximo_monitoramento IS NOT NULL AND jm.data_proximo_monitoramento <= NOW() THEN 2
              WHEN jm.data_ultimo_monitoramento IS NULL THEN 3
              WHEN jm.data_ultimo_monitoramento <= NOW() - INTERVAL '20 days' THEN 4
              ELSE 5
            END AS prioridade_nivel,
            CASE
              WHEN GREATEST(0, LEAST(COALESCE(jm.prioridade_monitoramento, 0), 3)) = 3 THEN '03_EMERGENCIA'
              WHEN GREATEST(0, LEAST(COALESCE(jm.prioridade_monitoramento, 0), 3)) = 2 THEN '02_URGENTE'
              WHEN GREATEST(0, LEAST(COALESCE(jm.prioridade_monitoramento, 0), 3)) = 1 THEN '01_AGILIZAR'
              WHEN jm.pendente_dia_anterior = TRUE THEN 'SOBRA_DIA_ANTERIOR'
              WHEN jm.data_proximo_monitoramento IS NOT NULL AND jm.data_proximo_monitoramento <= NOW() THEN COALESCE(jm.motivo_proximo_monitoramento, 'RETORNO_PRAZO')
              WHEN jm.data_ultimo_monitoramento IS NULL THEN 'NUNCA_MONITORADO'
              WHEN jm.data_ultimo_monitoramento <= NOW() - INTERVAL '20 days' THEN 'MAIS_20_DIAS'
              ELSE 'ROTINA'
            END AS motivo_prioridade,
            jm.data_proximo_monitoramento,
            jm.data_ultimo_monitoramento
          FROM public.judicial_monitoramento_base jm
          WHERE COALESCE(jm.ativo_monitoramento, TRUE) = TRUE
            AND UPPER(COALESCE(jm.modulo_codigo, 'JUDICIAL')) = 'JUDICIAL'
            AND UPPER(COALESCE(jm.status_monitoramento_atual, '')) <> 'MONITORAMENTO_AUTOMATICO'
            AND NOT EXISTS (
              SELECT 1
              FROM public.judicial_monitoramento_atribuicoes a
              WHERE a.data_referencia = CURRENT_DATE
                AND a.monitoramento_id = jm.id
            )
          ORDER BY
            GREATEST(0, LEAST(COALESCE(jm.prioridade_monitoramento, 0), 3)) DESC,
            CASE
              WHEN jm.pendente_dia_anterior = TRUE THEN 1
              WHEN jm.data_proximo_monitoramento IS NOT NULL AND jm.data_proximo_monitoramento <= NOW() THEN 2
              WHEN jm.data_ultimo_monitoramento IS NULL THEN 3
              WHEN jm.data_ultimo_monitoramento <= NOW() - INTERVAL '20 days' THEN 4
              ELSE 5
            END,
            jm.data_proximo_monitoramento NULLS LAST,
            jm.data_ultimo_monitoramento NULLS FIRST,
            jm.id
          LIMIT $4::int
          FOR UPDATE OF jm SKIP LOCKED
        ),
        inseridos AS (
          INSERT INTO public.judicial_monitoramento_atribuicoes (
            data_referencia,
            monitoramento_id,
            usuario_id,
            usuario_nome,
            usuario_email,
            bloco_numero,
            tamanho_bloco,
            ordem_no_bloco,
            motivo_prioridade,
            prioridade_nivel,
            status,
            atribuida_em
          )
          SELECT
            CURRENT_DATE,
            c.monitoramento_id,
            $1,
            $2,
            $3,
            $5::int,
            $4::int,
            ROW_NUMBER() OVER (
              ORDER BY c.prioridade_manual DESC, c.prioridade_nivel, c.data_proximo_monitoramento NULLS LAST, c.data_ultimo_monitoramento NULLS FIRST, c.monitoramento_id
            ),
            c.motivo_prioridade,
            CASE WHEN c.prioridade_manual > 0 THEN 10 - c.prioridade_manual ELSE c.prioridade_nivel END,
            'ATRIBUIDO',
            NOW()
          FROM candidatos c
          ON CONFLICT (data_referencia, monitoramento_id) DO NOTHING
          RETURNING id, monitoramento_id, status, bloco_numero, ordem_no_bloco, motivo_prioridade
        ),
        atualizados AS (
          UPDATE public.judicial_monitoramento_base jm
          SET
            status_monitoramento_atual = 'ATRIBUIDO',
            data_proximo_monitoramento = NULL,
            motivo_proximo_monitoramento = NULL,
            prazo_retorno_dias = NULL,
            updated_at = NOW()
          WHERE EXISTS (
            SELECT 1
            FROM inseridos i
            WHERE i.monitoramento_id = jm.id
          )
          RETURNING jm.id
        )
        SELECT
          i.id::text AS "atribuicaoId",
          i.monitoramento_id::text AS "monitoramentoId",
          i.status,
          i.bloco_numero AS "blocoNumero",
          i.ordem_no_bloco AS "ordemNoBloco",
          i.motivo_prioridade AS "motivoPrioridade"
        FROM inseridos i
        ORDER BY i.ordem_no_bloco, i.id
      `,
      userId,
      userName,
      userEmail || null,
      lotSize,
      nextBlock,
    )

    await tx.$executeRawUnsafe(
      `
        INSERT INTO public.judicial_monitoramento_execucao_diaria (
          data_referencia,
          usuario_id,
          usuario_nome,
          usuario_email,
          primeira_atribuicao_em,
          ultima_atribuicao_em,
          qtde_atribuida,
          qtde_finalizada,
          qtde_aberta,
          blocos_gerados,
          status
        )
        SELECT
          CURRENT_DATE,
          $1,
          $2,
          $3,
          MIN(atribuida_em),
          MAX(atribuida_em),
          COUNT(*)::int,
          COUNT(*) FILTER (WHERE status = 'FINALIZADO')::int,
          COUNT(*) FILTER (WHERE status IN ('ATRIBUIDO', 'EM_ANALISE', 'EM_MONITORAMENTO'))::int,
          COALESCE(MAX(bloco_numero), 0)::int,
          'ABERTO'
        FROM public.judicial_monitoramento_atribuicoes
        WHERE data_referencia = CURRENT_DATE
          AND usuario_id = $1
        ON CONFLICT (data_referencia, usuario_id) DO UPDATE
        SET
          usuario_nome = EXCLUDED.usuario_nome,
          usuario_email = EXCLUDED.usuario_email,
          primeira_atribuicao_em = EXCLUDED.primeira_atribuicao_em,
          ultima_atribuicao_em = EXCLUDED.ultima_atribuicao_em,
          qtde_atribuida = EXCLUDED.qtde_atribuida,
          qtde_finalizada = EXCLUDED.qtde_finalizada,
          qtde_aberta = EXCLUDED.qtde_aberta,
          blocos_gerados = EXCLUDED.blocos_gerados,
          status = EXCLUDED.status,
          updated_at = NOW()
      `,
      userId,
      userName,
      userEmail || null,
    )

    return {
      created: insertedRows.length > 0,
      quantidade: insertedRows.length,
      items: insertedRows,
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const userId = text(body?.user?.id || body?.userId)
    const userName = text(body?.user?.nome || body?.user?.name || body?.userName || "Monitor")
    const userEmail = text(body?.user?.email || body?.userEmail).toLowerCase()

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Usuário não informado." },
        { status: 400 },
      )
    }

    await closePreviousOpenAssignments()
    const result = await ensureDailyAssignment(userId, userName, userEmail)

    return NextResponse.json({
      ok: true,
      strategy: "daily_batch_20_then_5_with_manual_priority_skip_automatic_core",
      ...result,
    })
  } catch (error) {
    console.error("[POST /api/judicial/monitoramento/atribuir] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao garantir atribuição diária judicial." },
      { status: 500 },
    )
  }
}
