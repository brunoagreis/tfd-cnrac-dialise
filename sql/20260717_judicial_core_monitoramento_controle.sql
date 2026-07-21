BEGIN;

CREATE TABLE IF NOT EXISTS public.judicial_core_monitoramento_controle (
  id BIGSERIAL PRIMARY KEY,

  monitoramento_id BIGINT NOT NULL,
  demanda_id TEXT,
  ficha_id TEXT,
  ficha_core TEXT NOT NULL,

  sistema TEXT NOT NULL DEFAULT 'CORE',
  tipo_core TEXT,

  status_ficha_atual TEXT,
  status_procedimento_atual TEXT,
  status_hash_atual TEXT,

  status_ficha_anterior TEXT,
  status_procedimento_anterior TEXT,
  status_hash_anterior TEXT,

  consultas_total INTEGER NOT NULL DEFAULT 0,
  consultas_mesmo_status INTEGER NOT NULL DEFAULT 0,

  primeira_consulta_em TIMESTAMPTZ,
  ultima_consulta_em TIMESTAMPTZ,
  proxima_consulta_em TIMESTAMPTZ,

  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  motivo_saida_automatico TEXT,
  saiu_automatico_em TIMESTAMPTZ,

  observacao TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_jcmc_consultas_total
    CHECK (consultas_total >= 0),

  CONSTRAINT chk_jcmc_consultas_mesmo_status
    CHECK (consultas_mesmo_status >= 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_jcmc_monitoramento'
  ) THEN
    ALTER TABLE public.judicial_core_monitoramento_controle
      ADD CONSTRAINT fk_jcmc_monitoramento
      FOREIGN KEY (monitoramento_id)
      REFERENCES public.judicial_monitoramento_base(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_jcmc_monitoramento_ficha
  ON public.judicial_core_monitoramento_controle (monitoramento_id, ficha_core);

CREATE INDEX IF NOT EXISTS idx_jcmc_ativo_proxima
  ON public.judicial_core_monitoramento_controle (ativo, proxima_consulta_em);

CREATE INDEX IF NOT EXISTS idx_jcmc_monitoramento
  ON public.judicial_core_monitoramento_controle (monitoramento_id);

CREATE INDEX IF NOT EXISTS idx_jcmc_ficha_core
  ON public.judicial_core_monitoramento_controle (ficha_core);

CREATE INDEX IF NOT EXISTS idx_jcmc_status_hash
  ON public.judicial_core_monitoramento_controle (status_hash_atual);

COMMIT;
