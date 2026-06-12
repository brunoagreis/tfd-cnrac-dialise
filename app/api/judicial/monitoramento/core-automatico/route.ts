import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CoreCandidateRow = {
  monitoramentoId: string
  demandaId: string | null
  pacienteNome: string | null
  fichaCore: string | null
  fichaId: string | null
  fichaNumero: string | null
  ultimaData: string | null
  ambFicha: string | null
  ambSituacao: string | null
  leitoFicha: string | null
  leitoSituacao: string | null
}

type ProcessResult = {
  monitoramentoId: string
  ficha: string
  tabela: string
  situacao: string
  acao: "automatico" | "humano" | "pendente_core"
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeStatus(value: unknown) {
  return text(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function isOpenCoreStatus(value: unknown) {
  const status = normalizeStatus(value)
  return status === "ABERTA" || status === "EM ANDAMENTO"
}

function nextDayIso() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString()
}

function resolveFicha(row: CoreCandidateRow) {
  return text(row.fichaCore || row.fichaNumero)
}

function resolveCoreSituation(row: CoreCandidateRow) {
  if (row.ambFicha) {
    return {
      tabela: "core_ambulatorial",
      ficha: text(row.ambFicha),
      situacao: text(row.ambSituacao),
      encontrada: true,
    }
  }

  if (row.leitoFicha) {
    return {
      tabela: "core_leito",
      ficha: text(row.leitoFicha),
      situacao: text(row.leitoSituacao),
      encontrada: true,
    }
  }

  return {
    tabela: "CORE",
    ficha: resolveFicha(row),
    situacao: "NÃO ENCONTRADA",
    encontrada: false,
  }
}

async function insertAutomaticMovement(tx: any, params: {
  row: CoreCandidateRow
  tabela: string
  ficha: string
  situacao: string
  description: string
}) {
  await tx.$executeRawUnsafe(
    `
      INSERT INTO public.judicial_movimentacoes (
        id,
        monitoramento_id,
        demanda_id,
        type,
        description,
        attachments,
        created_by,
        created_by_name,
        created_by_email,
        created_at
      )
      VALUES (
        $1,
        $2::bigint,
        $3,
        'monitoramento_automatico_core',
        $4,
        '[]'::jsonb,
        'sistema',
        'Monitoramento automático CORE',
        NULL,
        NOW()
      )
    `,
    `jmov_core_auto_${randomUUID()}`,
    params.row.monitoramentoId,
    params.row.demandaId || null,
    params.description,
  )
}

async function processCandidate(tx: any, row: CoreCandidateRow): Promise<ProcessResult> {
  const core = resolveCoreSituation(row)
  const ficha = core.ficha || resolveFicha(row)

  if (!core.encontrada) {
    const description = [
      "Monitoramento automático CORE",
      `Data do monitoramento: ${new Date().toLocaleString("pt-BR")}`,
      `Ficha: ${ficha || "não informada"}`,
      "Status: NÃO ENCONTRADA nas tabelas core_ambulatorial/core_leito",
      "Ação: encaminhado para análise humana no dia seguinte.",
    ].join("\n")

    await tx.$executeRawUnsafe(
      `
        UPDATE public.judicial_monitoramento_base
        SET
          status_monitoramento_atual = 'PENDENTE_CORE',
          pendente_dia_anterior = TRUE,
          ativo_monitoramento = TRUE,
          data_ultimo_monitoramento = NOW(),
          data_proximo_monitoramento = $2::timestamptz,
          motivo_proximo_monitoramento = 'CORE_NAO_ENCONTRADA_ANALISE_HUMANA',
          prazo_retorno_dias = 1,
          updated_at = NOW()
        WHERE id::text = $1
      `,
      row.monitoramentoId,
      nextDayIso(),
    )

    await insertAutomaticMovement(tx, {
      row,
      tabela: core.tabela,
      ficha,
      situacao: core.situacao,
      description,
    })

    return {
      monitoramentoId: row.monitoramentoId,
      ficha,
      tabela: core.tabela,
      situacao: core.situacao,
      acao: "pendente_core",
    }
  }

  if (isOpenCoreStatus(core.situacao)) {
    const description = [
      "Monitoramento automático CORE",
      `Data do monitoramento: ${new Date().toLocaleString("pt-BR")}`,
      `Tabela: ${core.tabela}`,
      `Ficha: ${ficha}`,
      `Status da ficha: ${core.situacao}`,
      "Ação: mantido em monitoramento automático; não atribuir a monitor humano.",
    ].join("\n")

    await tx.$executeRawUnsafe(
      `
        UPDATE public.judicial_monitoramento_base
        SET
          ficha_core = COALESCE(NULLIF($2, ''), ficha_core),
          status_monitoramento_atual = 'MONITORAMENTO_AUTOMATICO',
          pendente_dia_anterior = FALSE,
          ativo_monitoramento = TRUE,
          data_ultimo_monitoramento = NOW(),
          data_proximo_monitoramento = NULL,
          motivo_proximo_monitoramento = NULL,
          prazo_retorno_dias = NULL,
          updated_at = NOW()
        WHERE id::text = $1
      `,
      row.monitoramentoId,
      ficha,
    )

    await insertAutomaticMovement(tx, {
      row,
      tabela: core.tabela,
      ficha,
      situacao: core.situacao,
      description,
    })

    return {
      monitoramentoId: row.monitoramentoId,
      ficha,
      tabela: core.tabela,
      situacao: core.situacao,
      acao: "automatico",
    }
  }

  const description = [
    "Monitoramento automático CORE",
    `Data do monitoramento: ${new Date().toLocaleString("pt-BR")}`,
    `Tabela: ${core.tabela}`,
    `Ficha: ${ficha}`,
    `Status da ficha: ${core.situacao}`,
    "Ação: status diferente de ABERTA/EM ANDAMENTO; encaminhado para análise humana no dia seguinte.",
  ].join("\n")

  await tx.$executeRawUnsafe(
    `
      UPDATE public.judicial_monitoramento_base
      SET
        ficha_core = COALESCE(NULLIF($2, ''), ficha_core),
        status_monitoramento_atual = 'ANALISE_HUMANA_CORE',
        pendente_dia_anterior = TRUE,
        ativo_monitoramento = TRUE,
        data_ultimo_monitoramento = NOW(),
        data_proximo_monitoramento = $3::timestamptz,
        motivo_proximo_monitoramento = 'CORE_SITUACAO_DIFERENTE_ANALISE_HUMANA',
        prazo_retorno_dias = 1,
        updated_at = NOW()
      WHERE id::text = $1
    `,
    row.monitoramentoId,
    ficha,
    nextDayIso(),
  )

  await insertAutomaticMovement(tx, {
    row,
    tabela: core.tabela,
    ficha,
    situacao: core.situacao,
    description,
  })

  return {
    monitoramentoId: row.monitoramentoId,
    ficha,
    tabela: core.tabela,
    situacao: core.situacao,
    acao: "humano",
  }
}

async function runAutomaticCoreMonitoring(limit: number) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<CoreCandidateRow[]>(
      `
        WITH ficha_core_ativa AS (
          SELECT DISTINCT ON (jf.monitoramento_id)
            jf.monitoramento_id::text AS monitoramento_id,
            jf.id::text AS ficha_id,
            jf.number AS ficha_numero
          FROM public.judicial_fichas jf
          WHERE UPPER(COALESCE(jf.system, '')) = 'CORE'
            AND COALESCE(jf.active, TRUE) = TRUE
          ORDER BY jf.monitoramento_id, jf.updated_at DESC NULLS LAST, jf.created_at DESC NULLS LAST, jf.id DESC
        )
        SELECT
          jm.id::text AS "monitoramentoId",
          jm.demanda_id::text AS "demandaId",
          jm.nome_paciente AS "pacienteNome",
          jm.ficha_core AS "fichaCore",
          fca.ficha_id AS "fichaId",
          fca.ficha_numero AS "fichaNumero",
          jm.data_ultimo_monitoramento::text AS "ultimaData",
          ca.nr_ficha::text AS "ambFicha",
          ca.situacao_ficha::text AS "ambSituacao",
          cl.numero_ficha::text AS "leitoFicha",
          cl.situacao_ficha::text AS "leitoSituacao"
        FROM public.judicial_monitoramento_base jm
        LEFT JOIN ficha_core_ativa fca
          ON fca.monitoramento_id = jm.id::text
        LEFT JOIN public.core_ambulatorial ca
          ON ca.nr_ficha::text = COALESCE(NULLIF(jm.ficha_core, ''), fca.ficha_numero)::text
        LEFT JOIN public.core_leito cl
          ON cl.numero_ficha::text = COALESCE(NULLIF(jm.ficha_core, ''), fca.ficha_numero)::text
        WHERE COALESCE(jm.ativo_monitoramento, TRUE) = TRUE
          AND UPPER(COALESCE(jm.modulo_codigo, 'JUDICIAL')) = 'JUDICIAL'
          AND COALESCE(NULLIF(jm.ficha_core, ''), fca.ficha_numero) IS NOT NULL
          AND (
            UPPER(COALESCE(jm.status_monitoramento_atual, '')) = 'MONITORAMENTO_AUTOMATICO'
            OR jm.data_ultimo_monitoramento IS NULL
            OR jm.data_ultimo_monitoramento <= NOW() - INTERVAL '2 days'
          )
        ORDER BY
          jm.data_ultimo_monitoramento NULLS FIRST,
          jm.id
        LIMIT $1::int
        FOR UPDATE OF jm SKIP LOCKED
      `,
      limit,
    )

    const results: ProcessResult[] = []

    for (const row of rows) {
      results.push(await processCandidate(tx, row))
    }

    return results
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const limit = Math.max(1, Math.min(Number(body?.limit ?? 200) || 200, 1000))
    const items = await runAutomaticCoreMonitoring(limit)

    return NextResponse.json({
      ok: true,
      quantidade: items.length,
      items,
    })
  } catch (error) {
    console.error("[POST /api/judicial/monitoramento/core-automatico] erro:", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao executar monitoramento automático CORE." },
      { status: 500 },
    )
  }
}
