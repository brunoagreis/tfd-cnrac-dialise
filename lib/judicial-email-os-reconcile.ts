import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

function text(value: unknown) {
  return String(value ?? "").trim()
}

function digits(value: unknown) {
  return text(value).replace(/\D/g, "")
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

type JudicialMatch = {
  monitoramentoId: string
  demandaId: string | null
  protocolo: string | null
}

type EmailOsRow = {
  id: string
  protocolo: string | null
  assunto: string | null
  remetente: string | null
  pgeNet: string | null
  processo: string | null
  corpoResumo: string | null
  anexos: unknown
}

async function findJudicialMatchForEmailOs(os: EmailOsRow): Promise<JudicialMatch | null> {
  const pgeRaw = text(os.pgeNet)
  const processoRaw = text(os.processo)
  const assunto = text(os.assunto)
  const corpo = text(os.corpoResumo)

  const pgeDigits = digits(pgeRaw)
  const processoDigits = digits(processoRaw)

  const rows = await prisma.$queryRawUnsafe<JudicialMatch[]>(
    `
      -- EMAIL_OS_RECONCILE_DISTINCT_ORDER_FIX
      SELECT DISTINCT ON (b.id)
        b.id::text AS "monitoramentoId",
        b.demanda_id::text AS "demandaId",
        COALESCE(d.protocolo::text, b.demanda_id::text) AS protocolo
      FROM public.judicial_monitoramento_base b
      LEFT JOIN public.demandas d
        ON d.id = b.demanda_id
      LEFT JOIN public.judicial_processos_vinculados pv
        ON pv.monitoramento_id = b.id
       AND pv.ativo = TRUE
      WHERE UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'
        AND (
          NULLIF($1::text, '') IS NOT NULL
          AND (
            pv.numero ILIKE '%' || $1::text || '%'
            OR d.protocolo::text ILIKE '%' || $1::text || '%'
            OR b.demanda_id::text ILIKE '%' || $1::text || '%'
          )
          OR NULLIF($2::text, '') IS NOT NULL
          AND regexp_replace(COALESCE(pv.numero, ''), '[^0-9]', '', 'g') = $2::text
          OR NULLIF($3::text, '') IS NOT NULL
          AND (
            pv.numero ILIKE '%' || $3::text || '%'
            OR d.protocolo::text ILIKE '%' || $3::text || '%'
            OR b.demanda_id::text ILIKE '%' || $3::text || '%'
          )
          OR NULLIF($4::text, '') IS NOT NULL
          AND regexp_replace(COALESCE(pv.numero, ''), '[^0-9]', '', 'g') = $4::text
          OR NULLIF($5::text, '') IS NOT NULL
          AND pv.numero IS NOT NULL
          AND $5::text ILIKE '%' || pv.numero || '%'
          OR NULLIF($6::text, '') IS NOT NULL
          AND pv.numero IS NOT NULL
          AND $6::text ILIKE '%' || pv.numero || '%'
        )
      ORDER BY b.id DESC
      LIMIT 1
    `,
    pgeRaw,
    pgeDigits,
    processoRaw,
    processoDigits,
    assunto,
    corpo,
  )

  return rows[0] ?? null
}

export async function reconcileEmailOsWithExistingJudicialCases(limit = 300) {
  const osRows = await prisma.$queryRawUnsafe<EmailOsRow[]>(
    `
      SELECT
        id::text AS id,
        protocolo,
        assunto,
        remetente,
        pge_net AS "pgeNet",
        processo,
        corpo_resumo AS "corpoResumo",
        anexos
      FROM public.judicial_email_os
      WHERE UPPER(COALESCE(status, '')) IN (
        'AGUARDANDO_CADASTRO',
        'ATRIBUIDA',
        'ATRIBUÃDA',
        'PENDENTE',
        'NOVA',
        'OS_CRIADA'
      )
        AND UPPER(COALESCE(modulo_destino, 'judicial')) = 'JUDICIAL'
        AND (
          NULLIF(TRIM(COALESCE(pge_net, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(processo, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(assunto, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(corpo_resumo, '')), '') IS NOT NULL
        )
      ORDER BY recebido_em DESC NULLS LAST, id DESC
      LIMIT $1::int
    `,
    limit,
  )

  let matched = 0

  for (const os of osRows) {
    const match = await findJudicialMatchForEmailOs(os)
    if (!match?.monitoramentoId) continue

    const marker = "OS vinculada automaticamente: " + os.id
    const anexosJson = JSON.stringify(parseArray(os.anexos))

    const description = [
      "E-MAIL/OS VINCULADO AUTOMATICAMENTE AO PROCESSO",
      marker,
      "Protocolo OS: " + text(os.protocolo),
      "Assunto: " + text(os.assunto),
      "Remetente: " + text(os.remetente),
      "PGE.net: " + text(os.pgeNet),
      "Processo: " + text(os.processo),
      "Resumo: " + text(os.corpoResumo).slice(0, 4000),
    ]
      .filter(Boolean)
      .join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_email_os
          SET
            status = 'CONVERTIDA',
            modulo_destino = 'judicial',
            convertido_demanda_id = NULLIF($2::text, ''),
            convertido_protocolo = $3::text,
            convertido_em = COALESCE(convertido_em, NOW()),
            observacoes = COALESCE(NULLIF(observacoes, ''), '') || CASE
              WHEN COALESCE(NULLIF(observacoes, ''), '') = '' THEN ''
              ELSE E'\n'
            END || 'DEMANDA CADASTRADA NO SIGAJUS - vinculada automaticamente por PGE.net/processo ao protocolo ' || $3::text,
            updated_at = NOW()
          WHERE id::text = $1::text
            AND UPPER(COALESCE(status, '')) NOT IN ('CONVERTIDA', 'CADASTRADA', 'CADASTRADO', 'CONCLUIDA', 'CONCLUÃDA', 'INATIVA')
        `,
        os.id,
        match.demandaId || null,
        match.protocolo || match.demandaId || "",
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_email_processados
          SET
            demanda_id = NULLIF($2::text, ''),
            status = 'DEMANDA_CADASTRADA',
            updated_at = NOW(),
            lido_em = COALESCE(lido_em, NOW())
          WHERE os_id::text = $1::text
        `,
        os.id,
        match.demandaId || null,
      )

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
            created_at
          )
          SELECT
            $1::text,
            $2::bigint,
            NULLIF($3::text, ''),
            'monitoramento'::text,
            $4::text,
            COALESCE($5::jsonb, '[]'::jsonb),
            'sistema-email'::text,
            'IntegraÃ§Ã£o de e-mail'::text,
            NOW()
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.judicial_movimentacoes
            WHERE monitoramento_id = $2::bigint
              AND description ILIKE $6::text
          )
        `,
        "jmov_email_os_" + randomUUID(),
        match.monitoramentoId,
        match.demandaId || null,
        description,
        anexosJson,
        "%" + marker + "%",
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            ativo_monitoramento = TRUE,
            status_monitoramento_atual = 'PENDENTE',
            pendente_dia_anterior = FALSE,
            data_proximo_monitoramento = CURRENT_DATE + INTERVAL '1 day',
            motivo_proximo_monitoramento = 'RETORNO_OS_INCORPORADA_1_DIA',
            prazo_retorno_dias = 1,
            prioridade_monitoramento = GREATEST(COALESCE(prioridade_monitoramento, 0), 3),
            prioridade_motivo = 'OS incorporada ao processo; monitorar no dia seguinte com prioridade mÃ¡xima.',
            prioridade_atualizada_em = NOW(),
            prioridade_atualizada_por = 'sistema-email-os',
            updated_at = NOW()
          WHERE id::text = $1::text
        `,
        match.monitoramentoId,
      )
    })

    matched += 1
  }

  return {
    checked: osRows.length,
    matched,
  }
}
