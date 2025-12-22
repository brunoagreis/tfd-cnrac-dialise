-- ============================================================
-- NEXUS - Sistema Integrado de Gestão Municipal da Saúde
-- PASSO 1: CORE (Multi-tenant, RBAC, Logs, Auditoria, Notificações, Consentimento)
-- DDL Completo - PostgreSQL 15+
-- ============================================================

-- Extensões obrigatórias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE: TENANTS (Municípios/SMS)
-- ============================================================
CREATE TABLE IF NOT EXISTS core_tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    city VARCHAR(255) NOT NULL,
    state CHAR(2) NOT NULL,
    ibge_code VARCHAR(7),
    cnes_principal VARCHAR(7),
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_core_tenants_slug ON core_tenants(slug);
CREATE INDEX idx_core_tenants_active ON core_tenants(is_active) WHERE is_active = true;

-- ============================================================
-- CORE: UNIDADES DE SAÚDE
-- ============================================================
CREATE TABLE IF NOT EXISTS core_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    parent_unit_id UUID REFERENCES core_units(id),
    name VARCHAR(255) NOT NULL,
    cnes VARCHAR(7),
    unit_type VARCHAR(50) NOT NULL, -- HOSP, UBS, LAB, IMAG, PHARM, ALMOX, ADMIN, etc.
    address TEXT,
    city VARCHAR(255),
    state CHAR(2),
    zip_code VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_core_units_tenant ON core_units(tenant_id);
CREATE INDEX idx_core_units_type ON core_units(tenant_id, unit_type);
CREATE INDEX idx_core_units_cnes ON core_units(cnes) WHERE cnes IS NOT NULL;
CREATE INDEX idx_core_units_active ON core_units(tenant_id, is_active) WHERE is_active = true;

-- ============================================================
-- CORE: SETORES
-- ============================================================
CREATE TABLE IF NOT EXISTS core_sectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES core_units(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sector_code VARCHAR(50),
    sector_type VARCHAR(50), -- EMERGENCIA, UTI, ENFERMARIA, CC, CME, FARMACIA, etc.
    capacity INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_core_sectors_tenant ON core_sectors(tenant_id);
CREATE INDEX idx_core_sectors_unit ON core_sectors(unit_id);
CREATE INDEX idx_core_sectors_type ON core_sectors(tenant_id, sector_type);

-- ============================================================
-- CORE: PESSOAS (Base para pacientes, profissionais, usuários)
-- ============================================================
CREATE TABLE IF NOT EXISTS core_persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    cpf VARCHAR(11) UNIQUE,
    cns VARCHAR(15),
    full_name VARCHAR(255) NOT NULL,
    social_name VARCHAR(255),
    birth_date DATE,
    gender CHAR(1), -- M, F, O, U
    mother_name VARCHAR(255),
    father_name VARCHAR(255),
    nationality VARCHAR(100) DEFAULT 'Brasileira',
    birth_city VARCHAR(255),
    birth_state CHAR(2),
    race_ethnicity VARCHAR(50),
    marital_status VARCHAR(50),
    education_level VARCHAR(100),
    occupation VARCHAR(255),
    phone_primary VARCHAR(20),
    phone_secondary VARCHAR(20),
    email VARCHAR(255),
    address_street VARCHAR(255),
    address_number VARCHAR(20),
    address_complement VARCHAR(100),
    address_neighborhood VARCHAR(100),
    address_city VARCHAR(255),
    address_state CHAR(2),
    address_zip VARCHAR(10),
    photo_url TEXT,
    is_deceased BOOLEAN DEFAULT false,
    deceased_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_core_persons_tenant ON core_persons(tenant_id);
CREATE INDEX idx_core_persons_cpf ON core_persons(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_core_persons_cns ON core_persons(cns) WHERE cns IS NOT NULL;
CREATE INDEX idx_core_persons_name ON core_persons(tenant_id, full_name);
CREATE INDEX idx_core_persons_birth ON core_persons(tenant_id, birth_date);

-- ============================================================
-- CORE: USUÁRIOS DO SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS core_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id) ON DELETE CASCADE, -- NULL = admin global
    person_id UUID REFERENCES core_persons(id),
    auth_user_id UUID UNIQUE, -- Referência ao auth.users do Supabase
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system_admin BOOLEAN NOT NULL DEFAULT false, -- Admin global do sistema
    force_password_change BOOLEAN NOT NULL DEFAULT true,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    two_factor_secret TEXT,
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(45),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_core_users_tenant ON core_users(tenant_id);
CREATE INDEX idx_core_users_email ON core_users(email);
CREATE INDEX idx_core_users_auth ON core_users(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX idx_core_users_person ON core_users(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_core_users_active ON core_users(tenant_id, is_active) WHERE is_active = true;

-- ============================================================
-- RBAC: PERFIS (ROLES)
-- ============================================================
CREATE TABLE IF NOT EXISTS rbac_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id) ON DELETE CASCADE, -- NULL = perfil global
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    scope VARCHAR(20) NOT NULL DEFAULT 'unit', -- global, unit, sector
    is_system BOOLEAN NOT NULL DEFAULT false, -- Perfis do sistema não podem ser editados
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_rbac_roles_tenant ON rbac_roles(tenant_id);
CREATE INDEX idx_rbac_roles_scope ON rbac_roles(scope);

-- ============================================================
-- RBAC: PERMISSÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS rbac_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code VARCHAR(50) NOT NULL, -- CORE, MPI, HOSP, LAB, etc.
    resource VARCHAR(100) NOT NULL, -- patients, prescriptions, lab_orders, etc.
    action VARCHAR(50) NOT NULL, -- create, read, update, delete, approve, etc.
    description TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT false, -- Requer log_access com motivo
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(module_code, resource, action)
);

CREATE INDEX idx_rbac_permissions_module ON rbac_permissions(module_code);
CREATE INDEX idx_rbac_permissions_resource ON rbac_permissions(resource);

-- ============================================================
-- RBAC: PERMISSÕES POR PERFIL
-- ============================================================
CREATE TABLE IF NOT EXISTS rbac_role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES rbac_permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID,
    UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_rbac_role_perms_role ON rbac_role_permissions(role_id);
CREATE INDEX idx_rbac_role_perms_perm ON rbac_role_permissions(permission_id);

-- ============================================================
-- RBAC: USUÁRIOS X PERFIS
-- ============================================================
CREATE TABLE IF NOT EXISTS rbac_user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES core_units(id) ON DELETE CASCADE, -- NULL = todas as unidades
    sector_id UUID REFERENCES core_sectors(id) ON DELETE CASCADE, -- NULL = todos os setores
    is_primary BOOLEAN NOT NULL DEFAULT false,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    UNIQUE(user_id, role_id, unit_id, sector_id)
);

CREATE INDEX idx_rbac_user_roles_user ON rbac_user_roles(user_id);
CREATE INDEX idx_rbac_user_roles_role ON rbac_user_roles(role_id);
CREATE INDEX idx_rbac_user_roles_unit ON rbac_user_roles(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX idx_rbac_user_roles_sector ON rbac_user_roles(sector_id) WHERE sector_id IS NOT NULL;
CREATE INDEX idx_rbac_user_roles_active ON rbac_user_roles(user_id, is_active) WHERE is_active = true;

-- ============================================================
-- FEATURE FLAGS (Módulos habilitáveis por tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
    module_code VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    enabled_at TIMESTAMPTZ,
    enabled_by UUID,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, module_code)
);

CREATE INDEX idx_feature_flags_tenant ON feature_flags(tenant_id);
CREATE INDEX idx_feature_flags_module ON feature_flags(module_code);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(tenant_id, is_enabled) WHERE is_enabled = true;

-- ============================================================
-- LOGS: AUDITORIA DE EVENTOS (IMUTÁVEL - somente INSERT)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_event_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id),
    user_id UUID REFERENCES core_users(id),
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    module_code VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, STATUS_CHANGE, APPROVE, REJECT, etc.
    action_description TEXT,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX idx_audit_log_tenant ON audit_event_log(tenant_id);
CREATE INDEX idx_audit_log_user ON audit_event_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_event_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_action ON audit_event_log(action);
CREATE INDEX idx_audit_log_module ON audit_event_log(module_code);
CREATE INDEX idx_audit_log_created ON audit_event_log(created_at DESC);
CREATE INDEX idx_audit_log_tenant_date ON audit_event_log(tenant_id, created_at DESC);

-- ============================================================
-- LOGS: ACESSO A DADOS SENSÍVEIS (IMUTÁVEL - somente INSERT)
-- ============================================================
CREATE TABLE IF NOT EXISTS log_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id),
    user_id UUID NOT NULL REFERENCES core_users(id),
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    module_code VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    access_type VARCHAR(50) NOT NULL, -- VIEW, PRINT, EXPORT, DOWNLOAD
    reason VARCHAR(500) NOT NULL, -- Motivo obrigatório para LGPD
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_access_tenant ON log_access(tenant_id);
CREATE INDEX idx_log_access_user ON log_access(user_id);
CREATE INDEX idx_log_access_entity ON log_access(entity_type, entity_id);
CREATE INDEX idx_log_access_created ON log_access(created_at DESC);
CREATE INDEX idx_log_access_tenant_date ON log_access(tenant_id, created_at DESC);

-- ============================================================
-- LOGS: ERROS DO SISTEMA (IMUTÁVEL - somente INSERT)
-- ============================================================
CREATE TABLE IF NOT EXISTS error_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id),
    user_id UUID REFERENCES core_users(id),
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    module_code VARCHAR(50),
    error_code VARCHAR(100),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    request_url TEXT,
    request_method VARCHAR(10),
    request_body JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_log_tenant ON error_log(tenant_id);
CREATE INDEX idx_error_log_module ON error_log(module_code);
CREATE INDEX idx_error_log_code ON error_log(error_code);
CREATE INDEX idx_error_log_created ON error_log(created_at DESC);

-- ============================================================
-- NOTIFICAÇÕES: TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS notify_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id) ON DELETE CASCADE, -- NULL = template global
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(20) NOT NULL, -- EMAIL, SMS, PUSH, WHATSAPP, INTERNAL
    subject VARCHAR(500),
    body_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- Lista de variáveis esperadas
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    UNIQUE(tenant_id, code, channel)
);

CREATE INDEX idx_notify_templates_tenant ON notify_templates(tenant_id);
CREATE INDEX idx_notify_templates_code ON notify_templates(code);

-- ============================================================
-- NOTIFICAÇÕES: OUTBOX (Fila de envio)
-- ============================================================
CREATE TABLE IF NOT EXISTS notify_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id),
    template_id UUID REFERENCES notify_templates(id),
    channel VARCHAR(20) NOT NULL,
    recipient_user_id UUID REFERENCES core_users(id),
    recipient_address VARCHAR(255) NOT NULL, -- email, telefone, etc.
    subject VARCHAR(500),
    body TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 5, -- 1 = mais alta
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, SENT, FAILED, CANCELLED
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notify_outbox_tenant ON notify_outbox(tenant_id);
CREATE INDEX idx_notify_outbox_status ON notify_outbox(status);
CREATE INDEX idx_notify_outbox_scheduled ON notify_outbox(scheduled_for) WHERE status = 'PENDING';
CREATE INDEX idx_notify_outbox_recipient ON notify_outbox(recipient_user_id);

-- ============================================================
-- CONSENTIMENTO LGPD
-- ============================================================
CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    person_id UUID NOT NULL REFERENCES core_persons(id),
    consent_type VARCHAR(100) NOT NULL, -- DATA_SHARING, PORTAL_ACCESS, EMAIL_NOTIFICATIONS, etc.
    consent_version VARCHAR(20) NOT NULL,
    is_granted BOOLEAN NOT NULL,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT,
    legal_basis VARCHAR(100), -- CONSENT, CONTRACT, LEGAL_OBLIGATION, VITAL_INTEREST, PUBLIC_INTEREST
    purpose TEXT,
    data_categories TEXT[], -- Categorias de dados abrangidos
    retention_period VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_tenant ON consent_records(tenant_id);
CREATE INDEX idx_consent_person ON consent_records(person_id);
CREATE INDEX idx_consent_type ON consent_records(consent_type);
CREATE INDEX idx_consent_granted ON consent_records(person_id, consent_type, is_granted) 
    WHERE is_granted = true AND revoked_at IS NULL;

-- ============================================================
-- INTEGRAÇÕES: OUTBOX (Padrão Transactional Outbox)
-- ============================================================
CREATE TABLE IF NOT EXISTS int_hub_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id),
    integration_code VARCHAR(50) NOT NULL, -- ESUS, CNES, RNDS, IMAG_MUN, etc.
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, SENT, FAILED, DLQ
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(idempotency_key)
);

CREATE INDEX idx_int_outbox_tenant ON int_hub_outbox(tenant_id);
CREATE INDEX idx_int_outbox_integration ON int_hub_outbox(integration_code);
CREATE INDEX idx_int_outbox_status ON int_hub_outbox(status);
CREATE INDEX idx_int_outbox_retry ON int_hub_outbox(next_retry_at) WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_int_outbox_entity ON int_hub_outbox(entity_type, entity_id);

-- ============================================================
-- INTEGRAÇÕES: INBOX (Eventos recebidos)
-- ============================================================
CREATE TABLE IF NOT EXISTS int_hub_inbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id),
    integration_code VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    external_id VARCHAR(255),
    payload JSONB NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, PROCESSED, FAILED, DLQ
    attempts INTEGER NOT NULL DEFAULT 0,
    processed_at TIMESTAMPTZ,
    last_error TEXT,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(idempotency_key)
);

CREATE INDEX idx_int_inbox_tenant ON int_hub_inbox(tenant_id);
CREATE INDEX idx_int_inbox_integration ON int_hub_inbox(integration_code);
CREATE INDEX idx_int_inbox_status ON int_hub_inbox(status);
CREATE INDEX idx_int_inbox_external ON int_hub_inbox(external_id);

-- ============================================================
-- INTEGRAÇÕES: DEAD LETTER QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS int_hub_deadletter (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES core_tenants(id),
    source_table VARCHAR(50) NOT NULL, -- outbox ou inbox
    source_id UUID NOT NULL,
    integration_code VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    error_history JSONB DEFAULT '[]',
    moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_int_dlq_tenant ON int_hub_deadletter(tenant_id);
CREATE INDEX idx_int_dlq_integration ON int_hub_deadletter(integration_code);
CREATE INDEX idx_int_dlq_resolved ON int_hub_deadletter(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE core_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notify_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notify_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE int_hub_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE int_hub_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE int_hub_deadletter ENABLE ROW LEVEL SECURITY;

-- Políticas para service_role (bypassa RLS para operações do sistema)
-- Isso permite que o backend use o service_role_key para operações administrativas

-- core_tenants: admins globais podem ver todos
CREATE POLICY "service_role_all_tenants" ON core_tenants FOR ALL USING (true) WITH CHECK (true);

-- core_units: usuários veem unidades do seu tenant
CREATE POLICY "service_role_all_units" ON core_units FOR ALL USING (true) WITH CHECK (true);

-- core_sectors: usuários veem setores do seu tenant
CREATE POLICY "service_role_all_sectors" ON core_sectors FOR ALL USING (true) WITH CHECK (true);

-- core_persons: usuários veem pessoas do seu tenant
CREATE POLICY "service_role_all_persons" ON core_persons FOR ALL USING (true) WITH CHECK (true);

-- core_users: acesso por tenant
CREATE POLICY "service_role_all_users" ON core_users FOR ALL USING (true) WITH CHECK (true);

-- rbac_*: acesso para gerenciamento
CREATE POLICY "service_role_all_roles" ON rbac_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_permissions" ON rbac_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_role_perms" ON rbac_role_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_user_roles" ON rbac_user_roles FOR ALL USING (true) WITH CHECK (true);

-- feature_flags
CREATE POLICY "service_role_all_flags" ON feature_flags FOR ALL USING (true) WITH CHECK (true);

-- logs (somente INSERT para imutabilidade)
CREATE POLICY "service_role_audit_log" ON audit_event_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_log_access" ON log_access FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_error_log" ON error_log FOR ALL USING (true) WITH CHECK (true);

-- notificações
CREATE POLICY "service_role_notify_templates" ON notify_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_notify_outbox" ON notify_outbox FOR ALL USING (true) WITH CHECK (true);

-- consentimento
CREATE POLICY "service_role_consent" ON consent_records FOR ALL USING (true) WITH CHECK (true);

-- integrações
CREATE POLICY "service_role_int_outbox" ON int_hub_outbox FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_int_inbox" ON int_hub_inbox FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_int_dlq" ON int_hub_deadletter FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FUNÇÕES UTILITÁRIAS
-- ============================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_core_tenants_updated_at BEFORE UPDATE ON core_tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_core_units_updated_at BEFORE UPDATE ON core_units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_core_sectors_updated_at BEFORE UPDATE ON core_sectors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_core_persons_updated_at BEFORE UPDATE ON core_persons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_core_users_updated_at BEFORE UPDATE ON core_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rbac_roles_updated_at BEFORE UPDATE ON rbac_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rbac_user_roles_updated_at BEFORE UPDATE ON rbac_user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notify_templates_updated_at BEFORE UPDATE ON notify_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notify_outbox_updated_at BEFORE UPDATE ON notify_outbox FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_int_outbox_updated_at BEFORE UPDATE ON int_hub_outbox FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_int_inbox_updated_at BEFORE UPDATE ON int_hub_inbox FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================
COMMENT ON TABLE core_tenants IS 'Municípios/SMS - Multi-tenant base';
COMMENT ON TABLE core_units IS 'Unidades de saúde (hospitais, UBS, laboratórios, etc.)';
COMMENT ON TABLE core_sectors IS 'Setores dentro das unidades';
COMMENT ON TABLE core_persons IS 'Cadastro base de pessoas (pacientes, profissionais)';
COMMENT ON TABLE core_users IS 'Usuários do sistema com autenticação';
COMMENT ON TABLE rbac_roles IS 'Perfis de acesso (roles)';
COMMENT ON TABLE rbac_permissions IS 'Permissões granulares por módulo/recurso/ação';
COMMENT ON TABLE rbac_role_permissions IS 'Associação perfil-permissão';
COMMENT ON TABLE rbac_user_roles IS 'Associação usuário-perfil com escopo (unidade/setor)';
COMMENT ON TABLE feature_flags IS 'Módulos habilitados por tenant';
COMMENT ON TABLE audit_event_log IS 'Log imutável de eventos de auditoria';
COMMENT ON TABLE log_access IS 'Log imutável de acesso a dados sensíveis (LGPD)';
COMMENT ON TABLE error_log IS 'Log imutável de erros do sistema';
COMMENT ON TABLE notify_templates IS 'Templates de notificação';
COMMENT ON TABLE notify_outbox IS 'Fila de notificações pendentes';
COMMENT ON TABLE consent_records IS 'Registros de consentimento LGPD';
COMMENT ON TABLE int_hub_outbox IS 'Outbox para integrações (padrão transactional outbox)';
COMMENT ON TABLE int_hub_inbox IS 'Inbox para eventos recebidos de integrações';
COMMENT ON TABLE int_hub_deadletter IS 'Dead letter queue para falhas de integração';
