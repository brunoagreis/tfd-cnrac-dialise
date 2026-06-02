BEGIN;

-- =========================================================
-- 1) FUNÇÃO BASE DE UPDATED_AT
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =========================================================
-- 2) TABELA GLOBAL DE AUDITORIA
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sistema_auditoria (
  id BIGSERIAL PRIMARY KEY,
  schema_name TEXT NOT NULL DEFAULT 'public',
  table_name TEXT NOT NULL,
  action_type TEXT NOT NULL, -- INSERT / UPDATE / DELETE
  record_id TEXT NULL,
  module_code TEXT NULL,
  user_id TEXT NULL,
  user_name TEXT NULL,
  user_email TEXT NULL,
  session_id TEXT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  before_data JSONB NULL,
  after_data JSONB NULL,
  changed_fields JSONB NULL,
  notes TEXT NULL
);

CREATE INDEX IF NOT EXISTS ix_sistema_auditoria_table_name
  ON public.sistema_auditoria (table_name);

CREATE INDEX IF NOT EXISTS ix_sistema_auditoria_module_code
  ON public.sistema_auditoria (module_code);

CREATE INDEX IF NOT EXISTS ix_sistema_auditoria_user_id
  ON public.sistema_auditoria (user_id);

CREATE INDEX IF NOT EXISTS ix_sistema_auditoria_changed_at
  ON public.sistema_auditoria (changed_at DESC);

-- =========================================================
-- 3) CATÁLOGO DE MÓDULOS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sistema_modulos (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT NULL,
  ordem_exibicao INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_sistema_modulos_updated_at
  ON public.sistema_modulos;

CREATE TRIGGER trg_sistema_modulos_updated_at
BEFORE UPDATE ON public.sistema_modulos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sistema_modulos (codigo, nome, descricao, ordem_exibicao, ativo)
VALUES
  ('TFD', 'TFD', 'Tratamento Fora do Domicílio', 1, TRUE),
  ('CNRAC', 'CNRAC', 'Central Nacional de Regulação de Alta Complexidade', 2, TRUE),
  ('HEMODIALISE', 'HEMODIÁLISE', 'Módulo de hemodiálise', 3, TRUE),
  ('JUDICIAL', 'JUDICIAL', 'Demandas judiciais', 4, TRUE),
  ('PRE_JUDICIAL', 'PRÉ-JUDICIAL', 'Demandas pré-judiciais', 5, TRUE),
  ('AGENDAMENTO_DEMANDA', 'AGENDAMENTO DA DEMANDA', 'Agendamento de demandas', 6, TRUE),
  ('RELATORIOS', 'RELATÓRIOS', 'Relatórios e painéis', 7, TRUE)
ON CONFLICT (codigo) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ordem_exibicao = EXCLUDED.ordem_exibicao,
  ativo = EXCLUDED.ativo,
  updated_at = NOW();

-- =========================================================
-- 4) VÍNCULO USUÁRIO x MÓDULO
--    Use TEXT para não travar em um tipo de id errado do sistema.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sistema_usuario_modulos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  usuario_nome TEXT NULL,
  usuario_email TEXT NULL,
  modulo_codigo TEXT NOT NULL
    REFERENCES public.sistema_modulos(codigo),
  pode_acessar BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, modulo_codigo)
);

CREATE INDEX IF NOT EXISTS ix_sistema_usuario_modulos_usuario
  ON public.sistema_usuario_modulos (usuario_id);

CREATE INDEX IF NOT EXISTS ix_sistema_usuario_modulos_modulo
  ON public.sistema_usuario_modulos (modulo_codigo);

DROP TRIGGER IF EXISTS trg_sistema_usuario_modulos_updated_at
  ON public.sistema_usuario_modulos;

CREATE TRIGGER trg_sistema_usuario_modulos_updated_at
BEFORE UPDATE ON public.sistema_usuario_modulos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 5) USUÁRIOS / SESSÕES ONLINE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sistema_usuarios_online (
  id BIGSERIAL PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  usuario_nome TEXT NULL,
  usuario_email TEXT NULL,
  modulo_codigo TEXT NULL
    REFERENCES public.sistema_modulos(codigo),
  status TEXT NOT NULL DEFAULT 'ONLINE', -- ONLINE / OFFLINE / EXPIRADA
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sistema_usuarios_online_usuario
  ON public.sistema_usuarios_online (usuario_id);

CREATE INDEX IF NOT EXISTS ix_sistema_usuarios_online_status
  ON public.sistema_usuarios_online (status);

CREATE INDEX IF NOT EXISTS ix_sistema_usuarios_online_last_seen
  ON public.sistema_usuarios_online (last_seen_at DESC);

DROP TRIGGER IF EXISTS trg_sistema_usuarios_online_updated_at
  ON public.sistema_usuarios_online;

CREATE TRIGGER trg_sistema_usuarios_online_updated_at
BEFORE UPDATE ON public.sistema_usuarios_online
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 6) BASE DE MONITORAMENTO JUDICIAL
--    Esta é a fila-base dos pacientes/demandas aptos a monitoramento.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.judicial_monitoramento_base (
  id BIGSERIAL PRIMARY KEY,
  modulo_codigo TEXT NOT NULL DEFAULT 'JUDICIAL'
    REFERENCES public.sistema_modulos(codigo),
  demanda_id TEXT NOT NULL,
  paciente_id TEXT NOT NULL,
  ficha_core TEXT NULL,
  nome_paciente TEXT NOT NULL,
  cpf TEXT NULL,
  cns TEXT NULL,
  procedimento_codigo TEXT NULL,
  procedimento_descricao TEXT NULL,
  cid_codigo TEXT NULL,
  cid_descricao TEXT NULL,
  data_ultimo_monitoramento TIMESTAMPTZ NULL,
  pendente_dia_anterior BOOLEAN NOT NULL DEFAULT FALSE,
  ativo_monitoramento BOOLEAN NOT NULL DEFAULT TRUE,
  status_monitoramento_atual TEXT NOT NULL DEFAULT 'PENDENTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (modulo_codigo, demanda_id)
);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_base_ativo
  ON public.judicial_monitoramento_base (ativo_monitoramento);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_base_pendente_dia_anterior
  ON public.judicial_monitoramento_base (pendente_dia_anterior);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_base_data_ultimo_monitoramento
  ON public.judicial_monitoramento_base (data_ultimo_monitoramento);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_base_proc_codigo_normalizado
  ON public.judicial_monitoramento_base (
    (regexp_replace(COALESCE(procedimento_codigo, ''), '\D', '', 'g'))
  );

DROP TRIGGER IF EXISTS trg_judicial_monitoramento_base_updated_at
  ON public.judicial_monitoramento_base;

CREATE TRIGGER trg_judicial_monitoramento_base_updated_at
BEFORE UPDATE ON public.judicial_monitoramento_base
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 7) ATRIBUIÇÕES DE MONITORAMENTO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.judicial_monitoramento_atribuicoes (
  id BIGSERIAL PRIMARY KEY,
  data_referencia DATE NOT NULL,
  monitoramento_id BIGINT NOT NULL
    REFERENCES public.judicial_monitoramento_base(id)
    ON DELETE CASCADE,
  usuario_id TEXT NOT NULL,
  usuario_nome TEXT NULL,
  usuario_email TEXT NULL,
  sessao_online_id BIGINT NULL
    REFERENCES public.sistema_usuarios_online(id)
    ON DELETE SET NULL,
  bloco_numero INTEGER NOT NULL DEFAULT 1,
  tamanho_bloco INTEGER NOT NULL DEFAULT 20,
  ordem_no_bloco INTEGER NOT NULL DEFAULT 1,
  motivo_prioridade TEXT NOT NULL DEFAULT 'ROTINA',
  prioridade_nivel SMALLINT NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'ATRIBUIDO', -- ATRIBUIDO / EM_MONITORAMENTO / FINALIZADO / NAO_FINALIZADO_DIA / CANCELADO
  atribuida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  iniciado_em TIMESTAMPTZ NULL,
  finalizado_em TIMESTAMPTZ NULL,
  observacao TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (data_referencia, monitoramento_id)
);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_atribuicoes_usuario_data
  ON public.judicial_monitoramento_atribuicoes (usuario_id, data_referencia);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_atribuicoes_status
  ON public.judicial_monitoramento_atribuicoes (status);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_atribuicoes_prioridade
  ON public.judicial_monitoramento_atribuicoes (data_referencia, prioridade_nivel, motivo_prioridade);

DROP TRIGGER IF EXISTS trg_judicial_monitoramento_atribuicoes_updated_at
  ON public.judicial_monitoramento_atribuicoes;

CREATE TRIGGER trg_judicial_monitoramento_atribuicoes_updated_at
BEFORE UPDATE ON public.judicial_monitoramento_atribuicoes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 8) CONTROLE DIÁRIO POR USUÁRIO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.judicial_monitoramento_execucao_diaria (
  id BIGSERIAL PRIMARY KEY,
  data_referencia DATE NOT NULL,
  usuario_id TEXT NOT NULL,
  usuario_nome TEXT NULL,
  usuario_email TEXT NULL,
  sessao_online_id BIGINT NULL
    REFERENCES public.sistema_usuarios_online(id)
    ON DELETE SET NULL,
  primeira_atribuicao_em TIMESTAMPTZ NULL,
  ultima_atribuicao_em TIMESTAMPTZ NULL,
  qtde_atribuida INTEGER NOT NULL DEFAULT 0,
  qtde_finalizada INTEGER NOT NULL DEFAULT 0,
  qtde_aberta INTEGER NOT NULL DEFAULT 0,
  blocos_gerados INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ABERTO', -- ABERTO / FECHADO
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (data_referencia, usuario_id)
);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_execucao_diaria_data
  ON public.judicial_monitoramento_execucao_diaria (data_referencia);

CREATE INDEX IF NOT EXISTS ix_judicial_monitoramento_execucao_diaria_usuario
  ON public.judicial_monitoramento_execucao_diaria (usuario_id);

DROP TRIGGER IF EXISTS trg_judicial_monitoramento_execucao_diaria_updated_at
  ON public.judicial_monitoramento_execucao_diaria;

CREATE TRIGGER trg_judicial_monitoramento_execucao_diaria_updated_at
BEFORE UPDATE ON public.judicial_monitoramento_execucao_diaria
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 9) FUNÇÃO GENÉRICA DE AUDITORIA
--    Para preencher user/module/session/ip no audit,
--    o backend deve fazer set_config antes do write.
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_record_id TEXT;
  v_changed JSONB := '{}'::jsonb;
BEGIN
  v_before := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_after  := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;

  v_record_id := COALESCE(v_after ->> 'id', v_before ->> 'id');

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(
      jsonb_object_agg(src.key, jsonb_build_object('before', src.old_value, 'after', src.new_value)),
      '{}'::jsonb
    )
    INTO v_changed
    FROM (
      SELECT
        COALESCE(o.key, n.key) AS key,
        o.value AS old_value,
        n.value AS new_value
      FROM jsonb_each(COALESCE(v_before, '{}'::jsonb)) o
      FULL JOIN jsonb_each(COALESCE(v_after, '{}'::jsonb)) n
        ON n.key = o.key
      WHERE o.value IS DISTINCT FROM n.value
    ) src;
  ELSIF TG_OP = 'INSERT' THEN
    v_changed := COALESCE(v_after, '{}'::jsonb);
  ELSE
    v_changed := COALESCE(v_before, '{}'::jsonb);
  END IF;

  INSERT INTO public.sistema_auditoria (
    schema_name,
    table_name,
    action_type,
    record_id,
    module_code,
    user_id,
    user_name,
    user_email,
    session_id,
    ip_address,
    user_agent,
    changed_at,
    before_data,
    after_data,
    changed_fields
  )
  VALUES (
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    TG_OP,
    v_record_id,
    NULLIF(current_setting('app.module_code', TRUE), ''),
    NULLIF(current_setting('app.user_id', TRUE), ''),
    NULLIF(current_setting('app.user_name', TRUE), ''),
    NULLIF(current_setting('app.user_email', TRUE), ''),
    NULLIF(current_setting('app.session_id', TRUE), ''),
    NULLIF(current_setting('app.ip_address', TRUE), ''),
    NULLIF(current_setting('app.user_agent', TRUE), ''),
    NOW(),
    v_before,
    v_after,
    v_changed
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =========================================================
-- 10) TRIGGERS DE AUDITORIA
-- =========================================================
DROP TRIGGER IF EXISTS trg_audit_sistema_modulos
  ON public.sistema_modulos;
CREATE TRIGGER trg_audit_sistema_modulos
AFTER INSERT OR UPDATE OR DELETE ON public.sistema_modulos
FOR EACH ROW
EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_sistema_usuario_modulos
  ON public.sistema_usuario_modulos;
CREATE TRIGGER trg_audit_sistema_usuario_modulos
AFTER INSERT OR UPDATE OR DELETE ON public.sistema_usuario_modulos
FOR EACH ROW
EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_sistema_usuarios_online
  ON public.sistema_usuarios_online;
CREATE TRIGGER trg_audit_sistema_usuarios_online
AFTER INSERT OR UPDATE OR DELETE ON public.sistema_usuarios_online
FOR EACH ROW
EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_judicial_monitoramento_base
  ON public.judicial_monitoramento_base;
CREATE TRIGGER trg_audit_judicial_monitoramento_base
AFTER INSERT OR UPDATE OR DELETE ON public.judicial_monitoramento_base
FOR EACH ROW
EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_judicial_monitoramento_atribuicoes
  ON public.judicial_monitoramento_atribuicoes;
CREATE TRIGGER trg_audit_judicial_monitoramento_atribuicoes
AFTER INSERT OR UPDATE OR DELETE ON public.judicial_monitoramento_atribuicoes
FOR EACH ROW
EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_judicial_monitoramento_execucao_diaria
  ON public.judicial_monitoramento_execucao_diaria;
CREATE TRIGGER trg_audit_judicial_monitoramento_execucao_diaria
AFTER INSERT OR UPDATE OR DELETE ON public.judicial_monitoramento_execucao_diaria
FOR EACH ROW
EXECUTE FUNCTION public.audit_row_change();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'admin_judicial_prioridades'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_admin_judicial_prioridades ON public.admin_judicial_prioridades';
    EXECUTE 'CREATE TRIGGER trg_audit_admin_judicial_prioridades AFTER INSERT OR UPDATE OR DELETE ON public.admin_judicial_prioridades FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()';
  END IF;
END;
$$;

-- =========================================================
-- 11) REGISTRO DE LOGIN / SESSÃO ONLINE
-- =========================================================
CREATE OR REPLACE FUNCTION public.judicial_registrar_login(
  p_usuario_id TEXT,
  p_usuario_nome TEXT,
  p_usuario_email TEXT DEFAULT NULL,
  p_modulo_codigo TEXT DEFAULT 'JUDICIAL',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO public.sistema_usuarios_online (
    usuario_id,
    usuario_nome,
    usuario_email,
    modulo_codigo,
    status,
    login_at,
    last_seen_at,
    ip_address,
    user_agent
  )
  VALUES (
    p_usuario_id,
    p_usuario_nome,
    p_usuario_email,
    p_modulo_codigo,
    'ONLINE',
    NOW(),
    NOW(),
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.judicial_registrar_logout(
  p_sessao_online_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.sistema_usuarios_online
  SET
    status = 'OFFLINE',
    logout_at = NOW(),
    last_seen_at = NOW()
  WHERE id = p_sessao_online_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.judicial_ping_usuario_online(
  p_sessao_online_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.sistema_usuarios_online
  SET
    last_seen_at = NOW()
  WHERE id = p_sessao_online_id
    AND status = 'ONLINE';
END;
$$;

-- =========================================================
-- 12) RECÁLCULO CONSOLIDADO DIÁRIO
-- =========================================================
CREATE OR REPLACE FUNCTION public.judicial_recalcular_execucao_diaria(
  p_data DATE,
  p_usuario_id TEXT,
  p_usuario_nome TEXT DEFAULT NULL,
  p_usuario_email TEXT DEFAULT NULL,
  p_sessao_online_id BIGINT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.judicial_monitoramento_execucao_diaria (
    data_referencia,
    usuario_id,
    usuario_nome,
    usuario_email,
    sessao_online_id,
    primeira_atribuicao_em,
    ultima_atribuicao_em,
    qtde_atribuida,
    qtde_finalizada,
    qtde_aberta,
    blocos_gerados,
    status
  )
  VALUES (
    p_data,
    p_usuario_id,
    p_usuario_nome,
    p_usuario_email,
    p_sessao_online_id,
    NULL,
    NULL,
    0,
    0,
    0,
    0,
    'ABERTO'
  )
  ON CONFLICT (data_referencia, usuario_id) DO NOTHING;

  UPDATE public.judicial_monitoramento_execucao_diaria ed
  SET
    usuario_nome = COALESCE(p_usuario_nome, ed.usuario_nome),
    usuario_email = COALESCE(p_usuario_email, ed.usuario_email),
    sessao_online_id = COALESCE(p_sessao_online_id, ed.sessao_online_id),
    primeira_atribuicao_em = (
      SELECT MIN(a.atribuida_em)
      FROM public.judicial_monitoramento_atribuicoes a
      WHERE a.data_referencia = p_data
        AND a.usuario_id = p_usuario_id
    ),
    ultima_atribuicao_em = (
      SELECT MAX(a.atribuida_em)
      FROM public.judicial_monitoramento_atribuicoes a
      WHERE a.data_referencia = p_data
        AND a.usuario_id = p_usuario_id
    ),
    qtde_atribuida = (
      SELECT COUNT(*)
      FROM public.judicial_monitoramento_atribuicoes a
      WHERE a.data_referencia = p_data
        AND a.usuario_id = p_usuario_id
    ),
    qtde_finalizada = (
      SELECT COUNT(*)
      FROM public.judicial_monitoramento_atribuicoes a
      WHERE a.data_referencia = p_data
        AND a.usuario_id = p_usuario_id
        AND a.status = 'FINALIZADO'
    ),
    qtde_aberta = (
      SELECT COUNT(*)
      FROM public.judicial_monitoramento_atribuicoes a
      WHERE a.data_referencia = p_data
        AND a.usuario_id = p_usuario_id
        AND a.status IN ('ATRIBUIDO', 'EM_MONITORAMENTO')
    ),
    blocos_gerados = COALESCE((
      SELECT MAX(a.bloco_numero)
      FROM public.judicial_monitoramento_atribuicoes a
      WHERE a.data_referencia = p_data
        AND a.usuario_id = p_usuario_id
    ), 0),
    updated_at = NOW()
  WHERE ed.data_referencia = p_data
    AND ed.usuario_id = p_usuario_id;
END;
$$;

-- =========================================================
-- 13) ATRIBUIÇÃO AUTOMÁTICA
--    REGRAS:
--    - 1º login do dia = 20
--    - depois de zerar abertas = +5
--    - prioridades:
--      1) admin_judicial_prioridades
--      2) sobras do dia anterior
--      3) > 30 dias do último monitoramento
-- =========================================================
CREATE OR REPLACE FUNCTION public.judicial_atribuir_monitoramento(
  p_usuario_id TEXT,
  p_usuario_nome TEXT,
  p_usuario_email TEXT DEFAULT NULL,
  p_sessao_online_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
  atribuicao_id BIGINT,
  monitoramento_id BIGINT,
  data_referencia DATE,
  bloco_numero INTEGER,
  ordem_no_bloco INTEGER,
  motivo_prioridade TEXT,
  prioridade_nivel SMALLINT,
  procedimento_codigo TEXT,
  procedimento_descricao TEXT,
  nome_paciente TEXT,
  cpf TEXT,
  status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_data DATE := CURRENT_DATE;
  v_existentes_hoje INTEGER := 0;
  v_bloco INTEGER := 1;
  v_lote INTEGER := 20;
BEGIN
  -- se o usuário ainda tem itens abertos hoje, devolve os abertos e não cria novo lote
  RETURN QUERY
  SELECT
    a.id,
    a.monitoramento_id,
    a.data_referencia,
    a.bloco_numero,
    a.ordem_no_bloco,
    a.motivo_prioridade,
    a.prioridade_nivel,
    b.procedimento_codigo,
    b.procedimento_descricao,
    b.nome_paciente,
    b.cpf,
    a.status
  FROM public.judicial_monitoramento_atribuicoes a
  INNER JOIN public.judicial_monitoramento_base b
    ON b.id = a.monitoramento_id
  WHERE a.data_referencia = v_data
    AND a.usuario_id = p_usuario_id
    AND a.status IN ('ATRIBUIDO', 'EM_MONITORAMENTO')
  ORDER BY a.bloco_numero, a.ordem_no_bloco;

  IF FOUND THEN
    PERFORM public.judicial_recalcular_execucao_diaria(
      v_data,
      p_usuario_id,
      p_usuario_nome,
      p_usuario_email,
      p_sessao_online_id
    );
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_existentes_hoje
  FROM public.judicial_monitoramento_atribuicoes
  WHERE data_referencia = v_data
    AND usuario_id = p_usuario_id;

  IF v_existentes_hoje = 0 THEN
    v_lote := 20;
    v_bloco := 1;
  ELSE
    v_lote := 5;

    SELECT COALESCE(MAX(bloco_numero), 0) + 1
    INTO v_bloco
    FROM public.judicial_monitoramento_atribuicoes
    WHERE data_referencia = v_data
      AND usuario_id = p_usuario_id;
  END IF;

  WITH candidatos AS (
    SELECT
      jm.id AS monitoramento_id,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.admin_judicial_prioridades p
          WHERE p.ativo = TRUE
            AND LOWER(COALESCE(p.tipo_prioridade, '')) = 'monitoramento'
            AND LOWER(COALESCE(p.modo, '')) = 'procedure'
            AND (p.expires_at IS NULL OR p.expires_at >= v_data)
            AND regexp_replace(COALESCE(p.valor, ''), '\D', '', 'g')
                = regexp_replace(COALESCE(jm.procedimento_codigo, ''), '\D', '', 'g')
        ) THEN 1
        WHEN jm.pendente_dia_anterior = TRUE THEN 2
        WHEN jm.data_ultimo_monitoramento IS NULL
          OR jm.data_ultimo_monitoramento <= NOW() - INTERVAL '30 days' THEN 3
        ELSE 4
      END AS prioridade_nivel,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.admin_judicial_prioridades p
          WHERE p.ativo = TRUE
            AND LOWER(COALESCE(p.tipo_prioridade, '')) = 'monitoramento'
            AND LOWER(COALESCE(p.modo, '')) = 'procedure'
            AND (p.expires_at IS NULL OR p.expires_at >= v_data)
            AND regexp_replace(COALESCE(p.valor, ''), '\D', '', 'g')
                = regexp_replace(COALESCE(jm.procedimento_codigo, ''), '\D', '', 'g')
        ) THEN 'PRIORIDADE_PROCEDIMENTO'
        WHEN jm.pendente_dia_anterior = TRUE THEN 'SOBRA_DIA_ANTERIOR'
        WHEN jm.data_ultimo_monitoramento IS NULL
          OR jm.data_ultimo_monitoramento <= NOW() - INTERVAL '30 days' THEN 'MAIS_30_DIAS'
        ELSE 'ROTINA'
      END AS motivo_prioridade,
      jm.data_ultimo_monitoramento
    FROM public.judicial_monitoramento_base jm
    WHERE jm.ativo_monitoramento = TRUE
      AND jm.modulo_codigo = 'JUDICIAL'
      AND NOT EXISTS (
        SELECT 1
        FROM public.judicial_monitoramento_atribuicoes a
        WHERE a.data_referencia = v_data
          AND a.monitoramento_id = jm.id
      )
    ORDER BY
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.admin_judicial_prioridades p
          WHERE p.ativo = TRUE
            AND LOWER(COALESCE(p.tipo_prioridade, '')) = 'monitoramento'
            AND LOWER(COALESCE(p.modo, '')) = 'procedure'
            AND (p.expires_at IS NULL OR p.expires_at >= v_data)
            AND regexp_replace(COALESCE(p.valor, ''), '\D', '', 'g')
                = regexp_replace(COALESCE(jm.procedimento_codigo, ''), '\D', '', 'g')
        ) THEN 1
        WHEN jm.pendente_dia_anterior = TRUE THEN 2
        WHEN jm.data_ultimo_monitoramento IS NULL
          OR jm.data_ultimo_monitoramento <= NOW() - INTERVAL '30 days' THEN 3
        ELSE 4
      END,
      jm.data_ultimo_monitoramento NULLS FIRST,
      jm.id
    LIMIT v_lote
    FOR UPDATE OF jm SKIP LOCKED
  ),
  inseridos AS (
    INSERT INTO public.judicial_monitoramento_atribuicoes (
      data_referencia,
      monitoramento_id,
      usuario_id,
      usuario_nome,
      usuario_email,
      sessao_online_id,
      bloco_numero,
      tamanho_bloco,
      ordem_no_bloco,
      motivo_prioridade,
      prioridade_nivel,
      status,
      atribuida_em
    )
    SELECT
      v_data,
      c.monitoramento_id,
      p_usuario_id,
      p_usuario_nome,
      p_usuario_email,
      p_sessao_online_id,
      v_bloco,
      v_lote,
      ROW_NUMBER() OVER (
        ORDER BY c.prioridade_nivel, c.data_ultimo_monitoramento NULLS FIRST, c.monitoramento_id
      ),
      c.motivo_prioridade,
      c.prioridade_nivel,
      'ATRIBUIDO',
      NOW()
    FROM candidatos c
    RETURNING id, monitoramento_id
  )
  UPDATE public.judicial_monitoramento_base jm
  SET
    status_monitoramento_atual = 'ATRIBUIDO',
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1
    FROM inseridos i
    WHERE i.monitoramento_id = jm.id
  );

  PERFORM public.judicial_recalcular_execucao_diaria(
    v_data,
    p_usuario_id,
    p_usuario_nome,
    p_usuario_email,
    p_sessao_online_id
  );

  RETURN QUERY
  SELECT
    a.id,
    a.monitoramento_id,
    a.data_referencia,
    a.bloco_numero,
    a.ordem_no_bloco,
    a.motivo_prioridade,
    a.prioridade_nivel,
    b.procedimento_codigo,
    b.procedimento_descricao,
    b.nome_paciente,
    b.cpf,
    a.status
  FROM public.judicial_monitoramento_atribuicoes a
  INNER JOIN public.judicial_monitoramento_base b
    ON b.id = a.monitoramento_id
  WHERE a.data_referencia = v_data
    AND a.usuario_id = p_usuario_id
    AND a.bloco_numero = v_bloco
  ORDER BY a.ordem_no_bloco;
END;
$$;

-- =========================================================
-- 14) INÍCIO / FINALIZAÇÃO DO MONITORAMENTO
-- =========================================================
CREATE OR REPLACE FUNCTION public.judicial_iniciar_monitoramento(
  p_atribuicao_id BIGINT,
  p_usuario_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.judicial_monitoramento_atribuicoes
  SET
    status = 'EM_MONITORAMENTO',
    iniciado_em = COALESCE(iniciado_em, NOW())
  WHERE id = p_atribuicao_id
    AND usuario_id = p_usuario_id
    AND status = 'ATRIBUIDO';
END;
$$;

CREATE OR REPLACE FUNCTION public.judicial_finalizar_monitoramento(
  p_atribuicao_id BIGINT,
  p_usuario_id TEXT,
  p_observacao TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_data DATE;
  v_usuario_nome TEXT;
  v_usuario_email TEXT;
  v_sessao_online_id BIGINT;
BEGIN
  SELECT
    data_referencia,
    usuario_nome,
    usuario_email,
    sessao_online_id
  INTO
    v_data,
    v_usuario_nome,
    v_usuario_email,
    v_sessao_online_id
  FROM public.judicial_monitoramento_atribuicoes
  WHERE id = p_atribuicao_id
    AND usuario_id = p_usuario_id
  LIMIT 1;

  UPDATE public.judicial_monitoramento_atribuicoes
  SET
    status = 'FINALIZADO',
    finalizado_em = NOW(),
    observacao = COALESCE(p_observacao, observacao)
  WHERE id = p_atribuicao_id
    AND usuario_id = p_usuario_id
    AND status IN ('ATRIBUIDO', 'EM_MONITORAMENTO');

  UPDATE public.judicial_monitoramento_base b
  SET
    data_ultimo_monitoramento = NOW(),
    pendente_dia_anterior = FALSE,
    status_monitoramento_atual = 'FINALIZADO',
    updated_at = NOW()
  FROM public.judicial_monitoramento_atribuicoes a
  WHERE a.id = p_atribuicao_id
    AND a.monitoramento_id = b.id;

  PERFORM public.judicial_recalcular_execucao_diaria(
    v_data,
    p_usuario_id,
    v_usuario_nome,
    v_usuario_email,
    v_sessao_online_id
  );
END;
$$;

-- =========================================================
-- 15) FECHAMENTO AUTOMÁTICO DO DIA - 23:50
--    Limpa lista aberta do dia e empurra sobras como prioridade do dia seguinte.
-- =========================================================
CREATE OR REPLACE FUNCTION public.judicial_encerrar_monitoramento_dia(
  p_data DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.judicial_monitoramento_base b
  SET
    pendente_dia_anterior = TRUE,
    status_monitoramento_atual = 'PENDENTE',
    updated_at = NOW()
  FROM public.judicial_monitoramento_atribuicoes a
  WHERE a.monitoramento_id = b.id
    AND a.data_referencia = p_data
    AND a.status IN ('ATRIBUIDO', 'EM_MONITORAMENTO');

  UPDATE public.judicial_monitoramento_atribuicoes
  SET
    status = 'NAO_FINALIZADO_DIA',
    observacao = CASE
      WHEN COALESCE(observacao, '') = '' THEN 'ENCERRADO AUTOMATICAMENTE NO FECHAMENTO DO DIA'
      ELSE observacao || ' | ENCERRADO AUTOMATICAMENTE NO FECHAMENTO DO DIA'
    END,
    updated_at = NOW()
  WHERE data_referencia = p_data
    AND status IN ('ATRIBUIDO', 'EM_MONITORAMENTO');

  UPDATE public.judicial_monitoramento_execucao_diaria
  SET
    qtde_aberta = 0,
    status = 'FECHADO',
    updated_at = NOW()
  WHERE data_referencia = p_data;
END;
$$;

COMMIT;