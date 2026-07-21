type TxLike = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

type CompleteJudicialMonitoringParams = {
  monitoramentoId: string | number
  userId?: string | null
  userEmail?: string | null
  userName?: string | null
  reason?: string | null
  defaultReturnDays?: number | null
  terminal?: boolean
}

/**
 * Regra geral:
 * qualquer movimentação humana dentro do processo judicial conta como monitoramento realizado.
 * Finaliza fila diária, remove atribuição manual ativa do usuário e programa retorno de rotina.
 */
export async function completeJudicialMonitoringAfterMovement(
  tx: TxLike,
  params: CompleteJudicialMonitoringParams,
) {
  const monitoramentoId = text(params.monitoramentoId)
  const userId = text(params.userId)
  const userEmail = text(params.userEmail).toLowerCase()
  const userName = text(params.userName) || "Monitor"
  const reason = text(params.reason) || "RETORNO_MONITORAMENTO_20_DIAS"
  const days = Number.isFinite(Number(params.defaultReturnDays))
    ? Math.max(0, Number(params.defaultReturnDays))
    : 20

  if (!monitoramentoId) return

  const observation =
    "Monitoramento concluído automaticamente: o usuário movimentou o processo judicial no sistema."

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
          NULLIF($2::text, '') IS NOT NULL AND usuario_id = $2::text
          OR NULLIF($3::text, '') IS NOT NULL AND LOWER(COALESCE(usuario_email, '')) = $3::text
        )
        AND status <> 'CANCELADO'
    `,
    monitoramentoId,
    userId,
    userEmail,
    userName,
    observation,
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
        END || $5::text
      WHERE monitoramento_id = $1::bigint
        AND ativo = TRUE
        AND (
          NULLIF($2::text, '') IS NOT NULL AND usuario_id = $2::text
          OR NULLIF($3::text, '') IS NOT NULL AND LOWER(COALESCE(usuario_email, '')) = $3::text
        )
    `,
    monitoramentoId,
    userId,
    userEmail,
    userName,
    observation,
  )

  await tx.$executeRawUnsafe(
    `
      UPDATE public.judicial_email_atribuicoes
      SET ativo = FALSE
      WHERE monitoramento_id = $1::bigint
        AND ativo = TRUE
        AND (
          NULLIF($2::text, '') IS NOT NULL AND usuario_id = $2::text
          OR NULLIF($3::text, '') IS NOT NULL AND LOWER(COALESCE(usuario_email, '')) = $3::text
        )
    `,
    monitoramentoId,
    userId,
    userEmail,
  ).catch(() => undefined)

  if (params.terminal) {
    await tx.$executeRawUnsafe(
      `
        UPDATE public.judicial_monitoramento_base
        SET
          pendente_dia_anterior = FALSE,
          data_ultimo_monitoramento = NOW(),
          updated_at = NOW()
        WHERE id::text = $1::text
      `,
      monitoramentoId,
    )

    return
  }

  await tx.$executeRawUnsafe(
    `
      UPDATE public.judicial_monitoramento_base
      SET
        ativo_monitoramento = TRUE,
        pendente_dia_anterior = FALSE,
        status_monitoramento_atual = CASE
          WHEN UPPER(COALESCE(status_monitoramento_atual, '')) = 'MONITORAMENTO_AUTOMATICO'
            THEN status_monitoramento_atual
          ELSE 'PENDENTE'
        END,
        data_ultimo_monitoramento = NOW(),
        data_proximo_monitoramento = COALESCE(
          data_proximo_monitoramento,
          NOW() + ($2::int * INTERVAL '1 day')
        ),
        motivo_proximo_monitoramento = COALESCE(
          NULLIF(motivo_proximo_monitoramento, ''),
          $3::text
        ),
        prazo_retorno_dias = COALESCE(prazo_retorno_dias, $2::int),
        updated_at = NOW()
      WHERE id::text = $1::text
    `,
    monitoramentoId,
    days,
    reason,
  )
}
