-- ============================================================
-- NEXUS - Sistema Integrado de Gestão Municipal da Saúde
-- MÓDULO: MPI - Master Patient Index (Paciente Único)
-- ============================================================

-- ============================================================
-- TABELAS DO MPI
-- ============================================================

-- Pacientes (extensão da core_persons com dados clínicos)
CREATE TABLE IF NOT EXISTS mpi_patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    person_id UUID NOT NULL REFERENCES core_persons(id),
    
    -- Identificadores únicos
    medical_record_number VARCHAR(20), -- Prontuário interno
    external_ids JSONB DEFAULT '{}', -- {"SUS": "xxx", "HOSPITAL_X": "yyy"}
    
    -- Dados demográficos complementares
    marital_status VARCHAR(20), -- SOLTEIRO, CASADO, DIVORCIADO, VIUVO, UNIAO_ESTAVEL
    education_level VARCHAR(30), -- ANALFABETO, FUNDAMENTAL, MEDIO, SUPERIOR, POS
    occupation VARCHAR(100),
    religion VARCHAR(50),
    ethnicity VARCHAR(30), -- BRANCA, PRETA, PARDA, AMARELA, INDIGENA
    blood_type VARCHAR(3), -- A+, A-, B+, B-, AB+, AB-, O+, O-
    rh_factor VARCHAR(10),
    
    -- Responsável legal (para menores ou incapazes)
    legal_guardian_id UUID REFERENCES core_persons(id),
    legal_guardian_relationship VARCHAR(30),
    
    -- Dados de contato de emergência
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(30),
    
    -- Preferências e restrições
    preferred_language VARCHAR(10) DEFAULT 'pt-BR',
    needs_interpreter BOOLEAN DEFAULT false,
    accessibility_needs TEXT[],
    
    -- Óbito
    is_deceased BOOLEAN DEFAULT false,
    death_date DATE,
    death_certificate_number VARCHAR(50),
    death_cause_cid10 VARCHAR(10),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    merged_into_id UUID REFERENCES mpi_patients(id), -- Se foi unificado com outro
    
    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES core_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES core_users(id),
    version INTEGER DEFAULT 1,
    
    UNIQUE(tenant_id, person_id),
    UNIQUE(tenant_id, medical_record_number)
);

-- Índice de busca fonética (para deduplicação)
CREATE TABLE IF NOT EXISTS mpi_phonetic_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Valores fonéticos calculados
    name_soundex VARCHAR(50),
    name_metaphone VARCHAR(100),
    mother_name_soundex VARCHAR(50),
    mother_name_metaphone VARCHAR(100),
    
    -- Tokens de nome para busca parcial
    name_tokens TEXT[],
    
    -- Dados normalizados para comparação
    cpf_normalized VARCHAR(11),
    cns_normalized VARCHAR(15),
    birth_date_normalized DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, patient_id)
);

-- Possíveis duplicatas detectadas
CREATE TABLE IF NOT EXISTS mpi_duplicate_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    
    patient_id_a UUID NOT NULL REFERENCES mpi_patients(id),
    patient_id_b UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Score de similaridade (0-100)
    similarity_score DECIMAL(5,2) NOT NULL,
    
    -- Detalhes da comparação
    match_details JSONB NOT NULL, -- {"cpf": 100, "name": 85, "birth_date": 100, "mother": 90}
    
    -- Status da revisão
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, CONFIRMED_DUPLICATE, NOT_DUPLICATE, MERGED
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES core_users(id),
    review_notes TEXT,
    
    -- Se foi merged, qual registro sobreviveu
    surviving_patient_id UUID REFERENCES mpi_patients(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_duplicate_pair UNIQUE(tenant_id, patient_id_a, patient_id_b),
    CONSTRAINT different_patients CHECK (patient_id_a != patient_id_b)
);

-- Histórico de unificações (merge)
CREATE TABLE IF NOT EXISTS mpi_merge_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    
    -- Registros envolvidos
    surviving_patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    merged_patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Snapshot dos dados antes do merge
    merged_patient_snapshot JSONB NOT NULL,
    
    -- Dados que foram incorporados ao sobrevivente
    incorporated_data JSONB,
    
    -- Motivo e aprovação
    merge_reason TEXT,
    approved_by UUID NOT NULL REFERENCES core_users(id),
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Possibilidade de desfazer
    can_undo BOOLEAN DEFAULT true,
    undo_deadline TIMESTAMPTZ,
    undone_at TIMESTAMPTZ,
    undone_by UUID REFERENCES core_users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alergias do paciente
CREATE TABLE IF NOT EXISTS mpi_allergies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    allergy_type VARCHAR(30) NOT NULL, -- MEDICAMENTO, ALIMENTO, AMBIENTAL, CONTRASTE, LATEX, OUTRO
    allergen VARCHAR(200) NOT NULL, -- Nome do alérgeno
    allergen_code VARCHAR(20), -- Código se houver (ex: código do medicamento)
    
    severity VARCHAR(20) NOT NULL, -- LEVE, MODERADA, GRAVE, ANAFILAXIA
    reaction_description TEXT,
    
    onset_date DATE,
    diagnosed_by VARCHAR(150),
    
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, RESOLVED, ENTERED_IN_ERROR
    
    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES core_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES core_users(id),
    
    UNIQUE(tenant_id, patient_id, allergy_type, allergen)
);

-- Condições crônicas / Problemas ativos
CREATE TABLE IF NOT EXISTS mpi_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Diagnóstico
    condition_type VARCHAR(30) NOT NULL, -- CRONICA, AGUDA, ANTECEDENTE, FAMILIAR
    cid10_code VARCHAR(10),
    ciap2_code VARCHAR(10),
    description TEXT NOT NULL,
    
    -- Severidade e status
    severity VARCHAR(20), -- LEVE, MODERADA, GRAVE
    clinical_status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, RECURRENCE, RELAPSE, INACTIVE, REMISSION, RESOLVED
    verification_status VARCHAR(20) DEFAULT 'CONFIRMED', -- UNCONFIRMED, PROVISIONAL, DIFFERENTIAL, CONFIRMED, REFUTED
    
    -- Datas
    onset_date DATE,
    abatement_date DATE,
    recorded_date DATE DEFAULT CURRENT_DATE,
    
    -- Profissional que registrou
    recorded_by UUID REFERENCES core_users(id),
    asserter_name VARCHAR(150),
    
    notes TEXT,
    
    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Histórico de vacinação
CREATE TABLE IF NOT EXISTS mpi_immunizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Vacina
    vaccine_code VARCHAR(20), -- Código SIPNI
    vaccine_name VARCHAR(150) NOT NULL,
    manufacturer VARCHAR(100),
    lot_number VARCHAR(50),
    
    -- Administração
    administration_date DATE NOT NULL,
    dose_number INTEGER, -- 1ª dose, 2ª dose, reforço
    dose_sequence VARCHAR(20), -- D1, D2, D3, REF, REF2
    administration_site VARCHAR(50), -- Deltóide D, Deltóide E, Vasto lateral D, etc
    administration_route VARCHAR(20), -- IM, SC, VO, ID
    
    -- Local de aplicação
    administered_at_unit_id UUID REFERENCES core_units(id),
    administered_by VARCHAR(150),
    
    -- Status
    status VARCHAR(20) DEFAULT 'COMPLETED', -- COMPLETED, NOT_DONE, ENTERED_IN_ERROR
    status_reason TEXT,
    
    -- Reações adversas
    had_reaction BOOLEAN DEFAULT false,
    reaction_description TEXT,
    
    -- Importado de sistema externo?
    external_source VARCHAR(50),
    external_id VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES core_users(id)
);

-- Consentimentos LGPD
CREATE TABLE IF NOT EXISTS mpi_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    consent_type VARCHAR(50) NOT NULL, -- TRATAMENTO, COMPARTILHAMENTO, PESQUISA, MARKETING, TELEMEDICINA
    consent_template_id UUID REFERENCES lgpd_consent_templates(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, EXPIRED
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    
    -- Como foi obtido
    collection_method VARCHAR(30), -- PRESENCIAL, DIGITAL, TELEFONE
    witness_name VARCHAR(150),
    
    -- Documento assinado
    document_url TEXT,
    digital_signature TEXT,
    
    -- IP e device se digital
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES core_users(id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mpi_patients_tenant ON mpi_patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpi_patients_person ON mpi_patients(person_id);
CREATE INDEX IF NOT EXISTS idx_mpi_patients_mrn ON mpi_patients(tenant_id, medical_record_number);
CREATE INDEX IF NOT EXISTS idx_mpi_patients_merged ON mpi_patients(merged_into_id) WHERE merged_into_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mpi_patients_deceased ON mpi_patients(tenant_id, is_deceased) WHERE is_deceased = true;

CREATE INDEX IF NOT EXISTS idx_mpi_phonetic_soundex ON mpi_phonetic_index(tenant_id, name_soundex);
CREATE INDEX IF NOT EXISTS idx_mpi_phonetic_metaphone ON mpi_phonetic_index(tenant_id, name_metaphone);
CREATE INDEX IF NOT EXISTS idx_mpi_phonetic_cpf ON mpi_phonetic_index(tenant_id, cpf_normalized);
CREATE INDEX IF NOT EXISTS idx_mpi_phonetic_cns ON mpi_phonetic_index(tenant_id, cns_normalized);
CREATE INDEX IF NOT EXISTS idx_mpi_phonetic_tokens ON mpi_phonetic_index USING GIN(name_tokens);

CREATE INDEX IF NOT EXISTS idx_mpi_duplicates_pending ON mpi_duplicate_candidates(tenant_id, status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_mpi_duplicates_score ON mpi_duplicate_candidates(similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_mpi_allergies_patient ON mpi_allergies(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_mpi_allergies_active ON mpi_allergies(tenant_id, patient_id, status) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_mpi_conditions_patient ON mpi_conditions(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_mpi_conditions_active ON mpi_conditions(tenant_id, patient_id, clinical_status) WHERE clinical_status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_mpi_conditions_cid ON mpi_conditions(cid10_code);

CREATE INDEX IF NOT EXISTS idx_mpi_immunizations_patient ON mpi_immunizations(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_mpi_immunizations_vaccine ON mpi_immunizations(vaccine_code);
CREATE INDEX IF NOT EXISTS idx_mpi_immunizations_date ON mpi_immunizations(administration_date DESC);

CREATE INDEX IF NOT EXISTS idx_mpi_consents_patient ON mpi_consents(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_mpi_consents_active ON mpi_consents(tenant_id, patient_id, status) WHERE status = 'ACTIVE';

-- ============================================================
-- FUNCTIONS PARA DEDUPLICAÇÃO
-- ============================================================

-- Função para gerar Soundex brasileiro (adaptado para português)
CREATE OR REPLACE FUNCTION fn_soundex_br(input_text TEXT)
RETURNS VARCHAR(50) AS $$
DECLARE
    result VARCHAR(50);
    normalized TEXT;
BEGIN
    IF input_text IS NULL OR input_text = '' THEN
        RETURN NULL;
    END IF;
    
    -- Normalizar: remover acentos, uppercase
    normalized := UPPER(unaccent(TRIM(input_text)));
    
    -- Remover caracteres não alfabéticos
    normalized := REGEXP_REPLACE(normalized, '[^A-Z ]', '', 'g');
    
    -- Aplicar soundex padrão como base
    result := SOUNDEX(normalized);
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para calcular similaridade entre dois pacientes
CREATE OR REPLACE FUNCTION fn_calculate_patient_similarity(
    p_patient_a_id UUID,
    p_patient_b_id UUID
)
RETURNS TABLE(
    total_score DECIMAL(5,2),
    match_details JSONB
) AS $$
DECLARE
    v_person_a RECORD;
    v_person_b RECORD;
    v_score DECIMAL(5,2) := 0;
    v_details JSONB := '{}';
    v_weight_total DECIMAL(5,2) := 0;
    v_weighted_score DECIMAL(5,2) := 0;
BEGIN
    -- Buscar dados dos pacientes
    SELECT p.*, per.cpf, per.cns, per.full_name, per.birth_date, per.mother_name, per.gender
    INTO v_person_a
    FROM mpi_patients p
    JOIN core_persons per ON p.person_id = per.id
    WHERE p.id = p_patient_a_id;
    
    SELECT p.*, per.cpf, per.cns, per.full_name, per.birth_date, per.mother_name, per.gender
    INTO v_person_b
    FROM mpi_patients p
    JOIN core_persons per ON p.person_id = per.id
    WHERE p.id = p_patient_b_id;
    
    -- CPF (peso 30)
    IF v_person_a.cpf IS NOT NULL AND v_person_b.cpf IS NOT NULL THEN
        v_weight_total := v_weight_total + 30;
        IF v_person_a.cpf = v_person_b.cpf THEN
            v_weighted_score := v_weighted_score + 30;
            v_details := v_details || '{"cpf": 100}';
        ELSE
            v_details := v_details || '{"cpf": 0}';
        END IF;
    END IF;
    
    -- CNS (peso 25)
    IF v_person_a.cns IS NOT NULL AND v_person_b.cns IS NOT NULL THEN
        v_weight_total := v_weight_total + 25;
        IF v_person_a.cns = v_person_b.cns THEN
            v_weighted_score := v_weighted_score + 25;
            v_details := v_details || '{"cns": 100}';
        ELSE
            v_details := v_details || '{"cns": 0}';
        END IF;
    END IF;
    
    -- Nome (peso 20) - usando similaridade de texto
    IF v_person_a.full_name IS NOT NULL AND v_person_b.full_name IS NOT NULL THEN
        v_weight_total := v_weight_total + 20;
        DECLARE
            name_sim DECIMAL(5,2);
        BEGIN
            name_sim := similarity(UPPER(unaccent(v_person_a.full_name)), UPPER(unaccent(v_person_b.full_name))) * 100;
            v_weighted_score := v_weighted_score + (name_sim / 100 * 20);
            v_details := v_details || jsonb_build_object('name', ROUND(name_sim, 2));
        END;
    END IF;
    
    -- Data de Nascimento (peso 15)
    IF v_person_a.birth_date IS NOT NULL AND v_person_b.birth_date IS NOT NULL THEN
        v_weight_total := v_weight_total + 15;
        IF v_person_a.birth_date = v_person_b.birth_date THEN
            v_weighted_score := v_weighted_score + 15;
            v_details := v_details || '{"birth_date": 100}';
        ELSE
            v_details := v_details || '{"birth_date": 0}';
        END IF;
    END IF;
    
    -- Nome da Mãe (peso 10)
    IF v_person_a.mother_name IS NOT NULL AND v_person_b.mother_name IS NOT NULL THEN
        v_weight_total := v_weight_total + 10;
        DECLARE
            mother_sim DECIMAL(5,2);
        BEGIN
            mother_sim := similarity(UPPER(unaccent(v_person_a.mother_name)), UPPER(unaccent(v_person_b.mother_name))) * 100;
            v_weighted_score := v_weighted_score + (mother_sim / 100 * 10);
            v_details := v_details || jsonb_build_object('mother_name', ROUND(mother_sim, 2));
        END;
    END IF;
    
    -- Calcular score final
    IF v_weight_total > 0 THEN
        v_score := (v_weighted_score / v_weight_total) * 100;
    END IF;
    
    RETURN QUERY SELECT ROUND(v_score, 2), v_details;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger para atualizar índice fonético ao inserir/atualizar paciente
CREATE OR REPLACE FUNCTION fn_update_phonetic_index()
RETURNS TRIGGER AS $$
DECLARE
    v_person RECORD;
    v_tokens TEXT[];
BEGIN
    -- Buscar dados da pessoa
    SELECT * INTO v_person FROM core_persons WHERE id = NEW.person_id;
    
    -- Gerar tokens do nome
    v_tokens := string_to_array(UPPER(unaccent(v_person.full_name)), ' ');
    
    -- Inserir ou atualizar índice fonético
    INSERT INTO mpi_phonetic_index (
        tenant_id,
        patient_id,
        name_soundex,
        name_metaphone,
        mother_name_soundex,
        mother_name_metaphone,
        name_tokens,
        cpf_normalized,
        cns_normalized,
        birth_date_normalized
    ) VALUES (
        NEW.tenant_id,
        NEW.id,
        fn_soundex_br(v_person.full_name),
        METAPHONE(unaccent(v_person.full_name), 20),
        fn_soundex_br(v_person.mother_name),
        METAPHONE(unaccent(COALESCE(v_person.mother_name, '')), 20),
        v_tokens,
        REGEXP_REPLACE(v_person.cpf, '[^0-9]', '', 'g'),
        REGEXP_REPLACE(v_person.cns, '[^0-9]', '', 'g'),
        v_person.birth_date
    )
    ON CONFLICT (tenant_id, patient_id) DO UPDATE SET
        name_soundex = EXCLUDED.name_soundex,
        name_metaphone = EXCLUDED.name_metaphone,
        mother_name_soundex = EXCLUDED.mother_name_soundex,
        mother_name_metaphone = EXCLUDED.mother_name_metaphone,
        name_tokens = EXCLUDED.name_tokens,
        cpf_normalized = EXCLUDED.cpf_normalized,
        cns_normalized = EXCLUDED.cns_normalized,
        birth_date_normalized = EXCLUDED.birth_date_normalized,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mpi_patient_phonetic
    AFTER INSERT OR UPDATE ON mpi_patients
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_phonetic_index();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE mpi_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpi_phonetic_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpi_duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpi_merge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpi_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpi_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpi_immunizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpi_consents ENABLE ROW LEVEL SECURITY;

-- Policies básicas (tenant isolation)
CREATE POLICY mpi_patients_tenant_policy ON mpi_patients
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY mpi_phonetic_tenant_policy ON mpi_phonetic_index
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY mpi_duplicates_tenant_policy ON mpi_duplicate_candidates
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY mpi_merge_tenant_policy ON mpi_merge_history
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY mpi_allergies_tenant_policy ON mpi_allergies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY mpi_conditions_tenant_policy ON mpi_conditions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY mpi_immunizations_tenant_policy ON mpi_immunizations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY mpi_consents_tenant_policy ON mpi_consents
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ============================================================
-- PERMISSÕES RBAC DO MPI
-- ============================================================
INSERT INTO rbac_permissions (id, module_code, resource, action, description, is_sensitive) VALUES
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'MPI', 'patients', 'create', 'Cadastrar paciente', false),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'MPI', 'patients', 'read', 'Visualizar paciente', true),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'MPI', 'patients', 'update', 'Editar paciente', false),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'MPI', 'patients', 'delete', 'Excluir paciente', false),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'MPI', 'patients', 'search', 'Buscar pacientes', true),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'MPI', 'patients', 'merge', 'Unificar pacientes duplicados', false),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'MPI', 'allergies', 'manage', 'Gerenciar alergias', false),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'MPI', 'conditions', 'manage', 'Gerenciar condições/problemas', false),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'MPI', 'immunizations', 'manage', 'Gerenciar imunizações', false),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'MPI', 'consents', 'manage', 'Gerenciar consentimentos', false),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'MPI', 'duplicates', 'review', 'Revisar duplicatas', false)
ON CONFLICT (id) DO NOTHING;
