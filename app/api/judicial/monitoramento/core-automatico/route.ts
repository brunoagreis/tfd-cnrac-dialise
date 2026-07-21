import { NextRequest, NextResponse } from "next/server"
import { createHash, randomUUID } from "crypto"
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
  ambProcedimento: string | null
  leitoFicha: string | null
  leitoSituacao: string | null
  leitoProcedimento: string | null
}

type CoreSituation = {
  tabela: string
  ficha: string
  situacao: string
  situacaoProcedimento: string
  encontrada: boolean
}

type ProcessResult = {
  monitoramentoId: string
  ficha: string
  tabela: string
  situacao: string
  situacaoProcedimento?: string
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

function isAutomaticCoreStatus(situacaoFichaValue: unknown, situacaoProcedimentoValue?: unknown) {
  const situacaoFicha = normalizeStatus(situacaoFichaValue)
  const situacaoProcedimento = normalizeStatus(situacaoProcedimentoValue)

  if (situacaoFicha === "ABERTA" || situacaoFicha === "EM ANDAMENTO") {
    return true
  }

  if (situacaoFicha === "REGULADA") {
    return (
      situacaoProcedimento === "AGUARDANDO AGENDAMENTO" ||
      situacaoProcedimento === "AGUARDANDO REGULADOR"
    )
  }

  return false
}

function nextDaysIso(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function nextDayIso() {
  return nextDaysIso(1)
}

function resolveFicha(row: CoreCandidateRow) {
  return text(row.fichaCore || row.fichaNumero)
}

function resolveCoreSituation(row: CoreCandidateRow): CoreSituation {
  if (row.ambFicha) {
    return {
      tabela: "core_ambulatorial",
      ficha: text(row.ambFicha),
      situacao: text(row.ambSituacao),
      situacaoProcedimento: text(row.ambProcedimento),
      encontrada: true,
    }
  }

  if (row.leitoFicha) {
    return {
      tabela: "core_leitos",
      ficha: text(row.leitoFicha),
      situacao: text(row.leitoSituacao),
      situacaoProcedimento: text(row.leitoProcedimento),
      encontrada: true,
    }
  }

  return {
    tabela: "CORE",
    ficha: resolveFicha(row),
    situacao: "NÃO ENCONTRADA",
    situacaoProcedimento: "",
    encontrada: false,
  }
}

// CORE_AUTOMATICO_MOVIMENTACAO_AUDITORIA
async function insertAutomaticMovement(tx: any, params: {
  row: CoreCandidateRow
  tabela: string
  ficha: string
  situacao: string
  description: string
}) {
  const movementId = `jmov_core_auto_${randomUUID()}`

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
    movementId,
    params.row.monitoramentoId,
    params.row.demandaId || null,
    params.description,
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
        'judicial_movimentacoes',
        'monitoramento_automatico_core',
        $1::text,
        'sistema',
        'Sistema - Monitoramento Automático CORE',
        NULL,
        'JUDICIAL',
        NOW(),
        jsonb_build_object(),
        jsonb_build_object(
          'movimentacao_id', $2::text,
          'monitoramento_id', $1::text,
          'demanda_id', $3::text,
          'type', 'monitoramento_automatico_core',
          'tabela_core', $4::text,
          'ficha_core', $5::text,
          'situacao_core', $6::text,
          'descricao', $7::text
        ),
        jsonb_build_array(
          'judicial_movimentacoes',
          'monitoramento_automatico_core',
          'judicial_core_monitoramento_controle'
        ),
        $7::text
      )
    `,
    params.row.monitoramentoId,
    movementId,
    params.row.demandaId || null,
    params.tabela || null,
    params.ficha || null,
    params.situacao || null,
    params.description,
  )
}

function coreStatusHash(statusFicha: string, statusProcedimento: string) {
  return createHash("sha1")
    .update(`${normalizeStatus(statusFicha)}|${normalizeStatus(statusProcedimento)}`)
    .digest("hex")
}

async function upsertCoreControl(tx: any, params: {
  row: CoreCandidateRow
  core: CoreSituation
  ficha: string
  nextDate: string | null
  automatico: boolean
  motivoSaida: string | null
  observacao: string
}) {
  const statusFicha = params.core.encontrada ? text(params.core.situacao) : "NÃO ENCONTRADA"
  const statusProcedimento = text(params.core.situacaoProcedimento)
  const statusHash = coreStatusHash(statusFicha, statusProcedimento)
  const tipoCore = params.core.encontrada ? text(params.core.tabela) : "NAO_ENCONTRADA"

  await tx.$executeRawUnsafe(
    `
      INSERT INTO public.judicial_core_monitoramento_controle AS jcmc (
        monitoramento_id,
        demanda_id,
        ficha_id,
        ficha_core,
        sistema,
        tipo_core,
        status_ficha_atual,
        status_procedimento_atual,
        status_hash_atual,
        status_ficha_anterior,
        status_procedimento_anterior,
        status_hash_anterior,
        consultas_total,
        consultas_mesmo_status,
        primeira_consulta_em,
        ultima_consulta_em,
        proxima_consulta_em,
        ativo,
        motivo_saida_automatico,
        saiu_automatico_em,
        observacao,
        created_at,
        updated_at
      )
      VALUES (
        $1::bigint,
        $2,
        $3,
        $4,
        'CORE',
        $5,
        $6,
        $7,
        $8,
        NULL,
        NULL,
        NULL,
        1,
        1,
        NOW(),
        NOW(),
        $9::timestamptz,
        $10::boolean,
        $11,
        CASE WHEN $10::boolean = FALSE THEN NOW() ELSE NULL END,
        $12,
        NOW(),
        NOW()
      )
      ON CONFLICT (monitoramento_id, ficha_core)
      DO UPDATE SET
        demanda_id = EXCLUDED.demanda_id,
        ficha_id = EXCLUDED.ficha_id,
        sistema = 'CORE',
        tipo_core = EXCLUDED.tipo_core,
        status_ficha_anterior = jcmc.status_ficha_atual,
        status_procedimento_anterior = jcmc.status_procedimento_atual,
        status_hash_anterior = jcmc.status_hash_atual,
        status_ficha_atual = EXCLUDED.status_ficha_atual,
        status_procedimento_atual = EXCLUDED.status_procedimento_atual,
        status_hash_atual = EXCLUDED.status_hash_atual,
        consultas_total = COALESCE(jcmc.consultas_total, 0) + 1,
        consultas_mesmo_status = CASE
          WHEN jcmc.status_hash_atual = EXCLUDED.status_hash_atual THEN COALESCE(jcmc.consultas_mesmo_status, 0) + 1
          ELSE 1
        END,
        primeira_consulta_em = COALESCE(jcmc.primeira_consulta_em, NOW()),
        ultima_consulta_em = NOW(),
        proxima_consulta_em = EXCLUDED.proxima_consulta_em,
        ativo = EXCLUDED.ativo,
        motivo_saida_automatico = EXCLUDED.motivo_saida_automatico,
        saiu_automatico_em = CASE
          WHEN EXCLUDED.ativo = FALSE THEN COALESCE(jcmc.saiu_automatico_em, NOW())
          ELSE NULL
        END,
        observacao = EXCLUDED.observacao,
        updated_at = NOW()
    `,
    params.row.monitoramentoId,
    params.row.demandaId || null,
    params.row.fichaId || null,
    params.ficha,
    tipoCore || null,
    statusFicha || null,
    statusProcedimento || null,
    statusHash,
    params.nextDate,
    params.automatico,
    params.motivoSaida,
    params.observacao,
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
      "Status: NÃO ENCONTRADA nas tabelas core_ambulatorial/core_leitos",
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



    await upsertCoreControl(tx, {
      row,
      core,
      ficha,
      nextDate: nextDayIso(),
      automatico: false,
      motivoSaida: "CORE_NAO_ENCONTRADA_ANALISE_HUMANA",
      observacao: description,
    })

    return {
      monitoramentoId: row.monitoramentoId,
      ficha,
      tabela: core.tabela,
      situacao: core.situacao,
      situacaoProcedimento: core.situacaoProcedimento,
      acao: "pendente_core",
    }
  }

  if (isAutomaticCoreStatus(core.situacao, core.situacaoProcedimento)) {
    const description = [
      "Monitoramento automático CORE",
      `Data do monitoramento: ${new Date().toLocaleString("pt-BR")}`,
      `Tabela: ${core.tabela}`,
      `Ficha: ${ficha}`,
      `Status da ficha: ${core.situacao}`,
      `Situação do procedimento: ${core.situacaoProcedimento || "não informada"}`,
      "Ação: mantido em monitoramento automático; próximo monitoramento programado para 2 dias.",
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
          data_proximo_monitoramento = $3::timestamptz,
          motivo_proximo_monitoramento = 'CORE_MONITORAMENTO_AUTOMATICO',
          prazo_retorno_dias = 2,
          updated_at = NOW()
        WHERE id::text = $1
      `,
      row.monitoramentoId,
      ficha,
      nextDaysIso(2),
    )

    await insertAutomaticMovement(tx, {
      row,
      tabela: core.tabela,
      ficha,
      situacao: core.situacao,
      description,
    })



    await upsertCoreControl(tx, {
      row,
      core,
      ficha,
      nextDate: nextDaysIso(2),
      automatico: true,
      motivoSaida: null,
      observacao: description,
    })

    return {
      monitoramentoId: row.monitoramentoId,
      ficha,
      tabela: core.tabela,
      situacao: core.situacao,
      situacaoProcedimento: core.situacaoProcedimento,
      acao: "automatico",
    }
  }

  const description = [
    "Monitoramento automático CORE",
    `Data do monitoramento: ${new Date().toLocaleString("pt-BR")}`,
    `Tabela: ${core.tabela}`,
    `Ficha: ${ficha}`,
    `Status da ficha: ${core.situacao}`,
    `Situação do procedimento: ${core.situacaoProcedimento || "não informada"}`,
    "Ação: status fora da regra automática; encaminhado para análise humana no dia seguinte.",
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



  await upsertCoreControl(tx, {
    row,
    core,
    ficha,
    nextDate: nextDayIso(),
    automatico: false,
    motivoSaida: "CORE_SITUACAO_DIFERENTE_ANALISE_HUMANA",
    observacao: description,
  })

    return {
    monitoramentoId: row.monitoramentoId,
    ficha,
    tabela: core.tabela,
    situacao: core.situacao,
    situacaoProcedimento: core.situacaoProcedimento,
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
          (to_jsonb(ca)->>'situacao_procedimento') AS "ambProcedimento",
          cl.numero_ficha::text AS "leitoFicha",
          cl.situacao_ficha::text AS "leitoSituacao",
          (to_jsonb(cl)->>'situacao_procedimento') AS "leitoProcedimento"
        FROM public.judicial_monitoramento_base jm
        LEFT JOIN ficha_core_ativa fca
          ON fca.monitoramento_id = jm.id::text
        LEFT JOIN public.judicial_core_monitoramento_controle jcmc
          ON jcmc.monitoramento_id = jm.id
         AND jcmc.ficha_core = COALESCE(NULLIF(jm.ficha_core, ''), fca.ficha_numero)::text
        LEFT JOIN public.core_ambulatorial ca
          ON ca.nr_ficha::text = COALESCE(NULLIF(jm.ficha_core, ''), fca.ficha_numero)::text
        LEFT JOIN public.core_leitos cl
          ON cl.numero_ficha::text = COALESCE(NULLIF(jm.ficha_core, ''), fca.ficha_numero)::text
        WHERE COALESCE(jm.ativo_monitoramento, TRUE) = TRUE
          AND UPPER(COALESCE(jm.origem_modulo, '')) = 'JUDICIAL'
          AND jm.status_monitoramento_atual = 'MONITORAMENTO_AUTOMATICO'
          AND COALESCE(jcmc.ativo, TRUE) = TRUE
          AND COALESCE(NULLIF(jm.ficha_core, ''), fca.ficha_numero) IS NOT NULL
          AND (
            jm.data_ultimo_monitoramento IS NULL
            OR COALESCE(jcmc.proxima_consulta_em, jm.data_proximo_monitoramento) <= NOW()
            OR (
              COALESCE(jcmc.proxima_consulta_em, jm.data_proximo_monitoramento) IS NULL
              AND jm.data_ultimo_monitoramento <= NOW() - INTERVAL '2 days'
            )
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
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { ok: false, error: "Erro ao executar monitoramento automático CORE.", detail },
      { status: 500 },
    )
  }
}
