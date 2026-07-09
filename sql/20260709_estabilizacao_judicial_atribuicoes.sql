BEGIN;

-- =========================================================
-- ESTABILIZAÇÃO JUDICIAL - ATRIBUIÇÕES / MONITORAMENTO
-- Data: 2026-07-09
--
-- Objetivo:
-- 1. Garantir que judicial_monitoramento_atribuicoes tenha as colunas
--    usadas pela fila automática.
-- 2. Garantir tabela de atribuição manual.
-- 3. Garantir índices necessários.
-- =========================================================

ALTER TABLE public.judicial_monitoramento_atribuicoes
  ADD COLUMN IF NOT EXISTS bloco_numero INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tamanho_bloco INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS ordem_no_bloco INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS motivo_prioridade TEXT NOT NULL DEFAULT 'ROTINA',
  ADD COLUMN IF NOT EXISTS prioridade_nivel SMALLINT NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ATRIBUIDO',
  ADD COLUMN IF NOT EXISTS atribuida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS iniciado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS judicial_monitoramento_atribuicoes_data_monitoramento_uniq
  ON public.judicial_monitoramento_atribuicoes (data_referencia, monitoramento_id);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_atribuicoes_usuario_data
  ON public.judicial_monitoramento_atribuicoes (usuario_id, data_referencia);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_atribuicoes_status
  ON public.judicial_monitoramento_atribuicoes (status);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_atribuicoes_prioridade
  ON public.judicial_monitoramento_atribuicoes (data_referencia, prioridade_nivel, motivo_prioridade);

CREATE TABLE IF NOT EXISTS public.judicial_monitoramento_atribuicoes_manuais (
  id BIGSERIAL PRIMARY KEY,
  monitoramento_id BIGINT NOT NULL,
  usuario_id TEXT NOT NULL,
  usuario_nome TEXT NOT NULL,
  usuario_email TEXT,
  origem_atribuicao TEXT NOT NULL DEFAULT 'MANUAL',
  motivo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  atribuida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS judicial_monitoramento_atribuicoes_manuais_uniq_ativa
  ON public.judicial_monitoramento_atribuicoes_manuais (monitoramento_id)
  WHERE ativo = TRUE;

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_atribuicoes_manuais_usuario
  ON public.judicial_monitoramento_atribuicoes_manuais (usuario_id);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_atribuicoes_manuais_email
  ON public.judicial_monitoramento_atribuicoes_manuais (LOWER(COALESCE(usuario_email, '')));

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_atribuicoes_manuais_ativo
  ON public.judicial_monitoramento_atribuicoes_manuais (ativo);

COMMIT;
