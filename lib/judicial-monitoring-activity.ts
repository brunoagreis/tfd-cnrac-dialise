type RawSqlExecutor = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>
}

type MarkJudicialActivityParams = {
  monitoramentoId: string | number | null | undefined
  userId?: string | null
  userEmail?: string | null
  userName?: string | null
  reason?: string | null
  defaultReturnDays?: number | null
  defaultReturnReason?: string | null
  updateBase?: boolean
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeDays(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 20
  return Math.max(1, Math.floor(number))
}

export async function markJudicialActivityAsMonitored(
  tx: RawSqlExecutor,
  params: MarkJudicialActivityParams,
) {
  const monitoramentoId = text(params.monitoramentoId)
  if (!monitoramentoId) return

  const userId = text(params.userId)
  const userEmail = text(params.userEmail).toLowerCase()
  const userName = text(params.userName) || "Monitor"
  const days = normalizeDays(params.defaultReturnDays)
  const defaultReason =
    text(params.defaultReturnReason) ||
    (days === 20 ? "RETORNO_MONITORAMENTO_20_DIAS" : "RETORNO_MONITORAMENTO")
  const reason =
    text(params.reason) ||
    `Monitoramento do dia concluído por movimentação no processo. Retorno em ${days} dia(s).`

  await tx.$executeRawUnsafe(
    `
      UPDATE public.judicial_monitoramento_atribuicoes
      SET
        status = 'FINALIZADO',
        iniciado_em = COALESCE(iniciado_em, NOW()),
        finalizado_em = COALESCE(finalizado_em, NOW()),
        usuario_nome = COALESCE(NULLIF($4::text, ''), usuario_nome),
        observacao = COALESCE(NULLIF(observacao, ''), '') || CASE
          WHEN COALESCE(NULLIF(observacao, ''), '') = '' THEN ''
          ELSE E'\n'
        END || $5::text,
        updated_at = NOW()
      WHERE data_referencia = CURRENT_DATE
        AND monitoramento_id = $1::bigint
        AND (
          (NULLIF($2::text, '') IS NOT NULL AND usuario_id = $2::text)
          OR (NULLIF($3::text, '') IS NOT NULL AND LOWER(COALESCE(usuario_email, '')) = LOWER($3::text))
        )
        AND status <> 'CANCELADO'
    `,
    monitoramentoId,
    userId,
    userEmail,
    userName,
    reason,
  )

  await tx.$executeRawUnsafe(
    `
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
        atribuida_em,
        iniciado_em,
        finalizado_em,
        observacao
      )
      SELECT
        CURRENT_DATE,
        m.monitoramento_id,
        m.usuario_id,
        COALESCE(NULLIF(m.usuario_nome, ''), NULLIF($4::text, ''), 'Monitor'),
        NULLIF(m.usuario_email, ''),
        0,
        0,
        0,
        'ATRIBUICAO_MANUAL_MONITORADA',
        0,
        'FINALIZADO',
        COALESCE(m.atribuida_em, NOW()),
        NOW(),
        NOW(),
        $5::text
      FROM public.judicial_monitoramento_atribuicoes_manuais m
      WHERE m.monitoramento_id = $1::bigint
        AND COALESCE(m.ativo, TRUE) = TRUE
        AND (
          (NULLIF($2::text, '') IS NOT NULL AND m.usuario_id = $2::text)
          OR (NULLIF($3::text, '') IS NOT NULL AND LOWER(COALESCE(m.usuario_email, '')) = LOWER($3::text))
        )
      ON CONFLICT (data_referencia, monitoramento_id) DO UPDATE
      SET
        status = 'FINALIZADO',
        iniciado_em = COALESCE(public.judicial_monitoramento_atribuicoes.iniciado_em, NOW()),
        finalizado_em = COALESCE(public.judicial_monitoramento_atribuicoes.finalizado_em, NOW()),
        usuario_nome = COALESCE(NULLIF(EXCLUDED.usuario_nome, ''), public.judicial_monitoramento_atribuicoes.usuario_nome),
        observacao = COALESCE(NULLIF(public.judicial_monitoramento_atribuicoes.observacao, ''), '') || CASE
          WHEN COALESCE(NULLIF(public.judicial_monitoramento_atribuicoes.observacao, ''), '') = '' THEN ''
          ELSE E'\n'
        END || EXCLUDED.observacao,
        updated_at = NOW()
      WHERE
        public.judicial_monitoramento_atribuicoes.usuario_id = EXCLUDED.usuario_id
        OR LOWER(COALESCE(public.judicial_monitoramento_atribuicoes.usuario_email, '')) = LOWER(COALESCE(EXCLUDED.usuario_email, ''))
    `,
    monitoramentoId,
    userId,
    userEmail,
    userName,
    reason,
  )

  await tx.$executeRawUnsafe(
    `
      UPDATE public.judicial_monitoramento_atribuicoes_manuais
      SET
        ativo = FALSE,
        removida_em = COALESCE(removida_em, NOW()),
        motivo = COALESCE(NULLIF(motivo, ''), '') || CASE
          WHEN COALESCE(NULLIF(motivo, ''), '') = '' THEN ''
          ELSE E'\n'
        END || $4::text
      WHERE monitoramento_id = $1::bigint
        AND COALESCE(ativo, TRUE) = TRUE
        AND (
          (NULLIF($2::text, '') IS NOT NULL AND usuario_id = $2::text)
          OR (NULLIF($3::text, '') IS NOT NULL AND LOWER(COALESCE(usuario_email, '')) = LOWER($3::text))
        )
    `,
    monitoramentoId,
    userId,
    userEmail,
    reason,
  )

  await tx.$executeRawUnsafe(
    `
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
        atribuida_em,
        iniciado_em,
        finalizado_em,
        observacao
      )
      SELECT
        CURRENT_DATE,
        ea.monitoramento_id,
        ea.usuario_id,
        COALESCE(NULLIF(ea.usuario_nome, ''), NULLIF($4::text, ''), 'Monitor'),
        NULLIF(ea.usuario_email, ''),
        0,
        0,
        0,
        'ATRIBUICAO_EMAIL_MONITORADA',
        0,
        'FINALIZADO',
        COALESCE(ea.atribuida_em, NOW()),
        NOW(),
        NOW(),
        $5::text
      FROM public.judicial_email_atribuicoes ea
      WHERE ea.monitoramento_id = $1::bigint
        AND COALESCE(ea.ativo, TRUE) = TRUE
        AND (
          (NULLIF($2::text, '') IS NOT NULL AND ea.usuario_id = $2::text)
          OR (NULLIF($3::text, '') IS NOT NULL AND LOWER(COALESCE(ea.usuario_email, '')) = LOWER($3::text))
        )
      ON CONFLICT (data_referencia, monitoramento_id) DO UPDATE
      SET
        status = 'FINALIZADO',
        iniciado_em = COALESCE(public.judicial_monitoramento_atribuicoes.iniciado_em, NOW()),
        finalizado_em = COALESCE(public.judicial_monitoramento_atribuicoes.finalizado_em, NOW()),
        usuario_nome = COALESCE(NULLIF(EXCLUDED.usuario_nome, ''), public.judicial_monitoramento_atribuicoes.usuario_nome),
        observacao = COALESCE(NULLIF(public.judicial_monitoramento_atribuicoes.observacao, ''), '') || CASE
          WHEN COALESCE(NULLIF(public.judicial_monitoramento_atribuicoes.observacao, ''), '') = '' THEN ''
          ELSE E'\n'
        END || EXCLUDED.observacao,
        updated_at = NOW()
      WHERE
        public.judicial_monitoramento_atribuicoes.usuario_id = EXCLUDED.usuario_id
        OR LOWER(COALESCE(public.judicial_monitoramento_atribuicoes.usuario_email, '')) = LOWER(COALESCE(EXCLUDED.usuario_email, ''))
    `,
    monitoramentoId,
    userId,
    userEmail,
    userName,
    reason,
  )

  await tx.$executeRawUnsafe(
    `
      UPDATE public.judicial_email_atribuicoes
      SET ativo = FALSE
      WHERE monitoramento_id = $1::bigint
        AND COALESCE(ativo, TRUE) = TRUE
        AND (
          (NULLIF($2::text, '') IS NOT NULL AND usuario_id = $2::text)
          OR (NULLIF($3::text, '') IS NOT NULL AND LOWER(COALESCE(usuario_email, '')) = LOWER($3::text))
        )
    `,
    monitoramentoId,
    userId,
    userEmail,
  )

  if (params.updateBase === false) return

  await tx.$executeRawUnsafe(
    `
      UPDATE public.judicial_monitoramento_base
      SET
        ativo_monitoramento = TRUE,
        pendente_dia_anterior = FALSE,
        status_monitoramento_atual = CASE
          WHEN UPPER(COALESCE(status_monitoramento_atual, '')) IN (
            'FINALIZADO',
            'RESOLVIDO',
            'ARQUIVADO',
            'ENCERRADO',
            'OBITO',
            'CUMPRIDO',
            'BLOQUEIO',
            'SEQUESTRO',
            'DEVOLVIDA',
            'DEVOLVIDO'
          ) THEN status_monitoramento_atual
          WHEN UPPER(COALESCE(status_monitoramento_atual, '')) = 'MONITORAMENTO_AUTOMATICO' THEN status_monitoramento_atual
          ELSE 'PENDENTE'
        END,
        data_ultimo_monitoramento = NOW(),
        data_proximo_monitoramento = COALESCE(data_proximo_monitoramento, NOW() + ($2::int * INTERVAL '1 day')),
        motivo_proximo_monitoramento = COALESCE(NULLIF(motivo_proximo_monitoramento, ''), $3::text),
        prazo_retorno_dias = COALESCE(prazo_retorno_dias, $2::int),
        updated_at = NOW()
      WHERE id::text = $1::text
    `,
    monitoramentoId,
    days,
    defaultReason,
  )
}
