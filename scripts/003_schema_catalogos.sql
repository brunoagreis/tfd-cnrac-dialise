-- ============================================================
-- NEXUS - Sistema Integrado de Gestão Municipal da Saúde
-- PASSO 2: CATÁLOGOS E TERMINOLOGIAS
-- DDL Completo - PostgreSQL 15+
-- ============================================================

-- ============================================================
-- CID-10 - Classificação Internacional de Doenças
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_cid10_chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE, -- I, II, III...
    name VARCHAR(500) NOT NULL,
    code_range VARCHAR(20), -- A00-B99
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_cid10_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES cat_cid10_chapters(id),
    code VARCHAR(20) NOT NULL UNIQUE, -- A00-A09
    name VARCHAR(500) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_cid10_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES cat_cid10_groups(id),
    code VARCHAR(10) NOT NULL UNIQUE, -- A00, A01, etc.
    name VARCHAR(500) NOT NULL,
    sex_restriction CHAR(1), -- M, F, NULL (ambos)
    age_min INTEGER, -- idade mínima em dias
    age_max INTEGER, -- idade máxima em dias
    is_cause_of_death BOOLEAN DEFAULT true,
    is_notifiable BOOLEAN DEFAULT false, -- Doença de notificação compulsória
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_cid10_subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES cat_cid10_categories(id),
    code VARCHAR(10) NOT NULL UNIQUE, -- A00.0, A00.1, etc.
    name VARCHAR(500) NOT NULL,
    sex_restriction CHAR(1),
    age_min INTEGER,
    age_max INTEGER,
    is_cause_of_death BOOLEAN DEFAULT true,
    is_notifiable BOOLEAN DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cid10_cat_code ON cat_cid10_categories(code);
CREATE INDEX idx_cid10_subcat_code ON cat_cid10_subcategories(code);
CREATE INDEX idx_cid10_subcat_category ON cat_cid10_subcategories(category_id);
CREATE INDEX idx_cid10_cat_notifiable ON cat_cid10_categories(is_notifiable) WHERE is_notifiable = true;

-- ============================================================
-- CIAP-2 - Classificação Internacional de Atenção Primária
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_ciap2_chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code CHAR(1) NOT NULL UNIQUE, -- A, B, D, F, H, K, L, N, P, R, S, T, U, W, X, Y, Z
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_ciap2_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES cat_ciap2_chapters(id),
    code VARCHAR(10) NOT NULL UNIQUE, -- A01, A02, etc.
    name VARCHAR(500) NOT NULL,
    component_type VARCHAR(50), -- Sintomas/Queixas, Procedimentos, Infecções, Neoplasias, etc.
    icd10_mapping VARCHAR(10)[], -- Códigos CID-10 relacionados
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ciap2_code ON cat_ciap2_codes(code);
CREATE INDEX idx_ciap2_chapter ON cat_ciap2_codes(chapter_id);

-- ============================================================
-- SIGTAP - Sistema de Gerenciamento da Tabela de Procedimentos
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_sigtap_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(2) NOT NULL UNIQUE, -- 01, 02, 03...
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    competence_start DATE,
    competence_end DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_sigtap_subgroups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES cat_sigtap_groups(id),
    code VARCHAR(4) NOT NULL UNIQUE, -- 0101, 0102...
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_sigtap_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subgroup_id UUID NOT NULL REFERENCES cat_sigtap_subgroups(id),
    code VARCHAR(6) NOT NULL UNIQUE, -- 010101, 010102...
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_sigtap_procedures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES cat_sigtap_forms(id),
    code VARCHAR(10) NOT NULL UNIQUE, -- 0101010010
    name VARCHAR(500) NOT NULL,
    description TEXT,
    complexity VARCHAR(2), -- AB (Atenção Básica), MC (Média Complexidade), AC (Alta Complexidade)
    modality VARCHAR(2), -- 01 (Ambulatorial), 02 (Hospitalar), etc.
    financing_type VARCHAR(50), -- MAC, FAEC, etc.
    value_ambulatory DECIMAL(12,2),
    value_hospital_sh DECIMAL(12,2), -- Serviços Hospitalares
    value_hospital_sp DECIMAL(12,2), -- Serviços Profissionais
    value_total DECIMAL(12,2),
    sex_restriction CHAR(1),
    age_min INTEGER,
    age_max INTEGER,
    max_quantity INTEGER,
    stay_min INTEGER, -- Permanência mínima em dias
    stay_max INTEGER, -- Permanência máxima em dias
    cid10_required VARCHAR(10)[], -- CIDs obrigatórios
    cid10_compatible VARCHAR(10)[], -- CIDs compatíveis
    cbo_required VARCHAR(10)[], -- CBOs que podem executar
    service_class VARCHAR(10)[], -- Classes de serviço habilitadas
    instrument VARCHAR(10), -- AIH, BPA-I, BPA-C, APAC, etc.
    registration_type VARCHAR(10), -- 01-Principal, 02-Secundário, etc.
    requires_authorization BOOLEAN DEFAULT false,
    requires_cns BOOLEAN DEFAULT true,
    competence_start DATE,
    competence_end DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sigtap_proc_code ON cat_sigtap_procedures(code);
CREATE INDEX idx_sigtap_proc_form ON cat_sigtap_procedures(form_id);
CREATE INDEX idx_sigtap_proc_complexity ON cat_sigtap_procedures(complexity);
CREATE INDEX idx_sigtap_proc_active ON cat_sigtap_procedures(is_active) WHERE is_active = true;

-- ============================================================
-- CBO - Classificação Brasileira de Ocupações
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_cbo_families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(4) NOT NULL UNIQUE, -- 2231, 2232, etc.
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_cbo_occupations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES cat_cbo_families(id),
    code VARCHAR(6) NOT NULL UNIQUE, -- 223105, 223110, etc.
    name VARCHAR(255) NOT NULL,
    synonyms TEXT[], -- Nomes alternativos
    description TEXT,
    is_healthcare BOOLEAN DEFAULT false, -- Se é profissional de saúde
    council_type VARCHAR(50), -- CRM, COREN, CRF, etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cbo_code ON cat_cbo_occupations(code);
CREATE INDEX idx_cbo_family ON cat_cbo_occupations(family_id);
CREATE INDEX idx_cbo_healthcare ON cat_cbo_occupations(is_healthcare) WHERE is_healthcare = true;

-- ============================================================
-- CATMAT/CATSER - Catálogo de Materiais e Serviços
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_catmat_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_catmat_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES cat_catmat_classes(id),
    code VARCHAR(20) NOT NULL UNIQUE, -- Código CATMAT
    name VARCHAR(500) NOT NULL,
    description TEXT,
    unit VARCHAR(20), -- UN, CX, FR, AMP, etc.
    is_medication BOOLEAN DEFAULT false,
    is_controlled BOOLEAN DEFAULT false, -- Controlado pela Portaria 344
    is_thermolabile BOOLEAN DEFAULT false, -- Termolábil
    storage_temp_min DECIMAL(5,2),
    storage_temp_max DECIMAL(5,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catmat_code ON cat_catmat_items(code);
CREATE INDEX idx_catmat_class ON cat_catmat_items(class_id);
CREATE INDEX idx_catmat_medication ON cat_catmat_items(is_medication) WHERE is_medication = true;

-- ============================================================
-- MEDICAMENTOS - Catálogo de Medicamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_medications_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL, -- Antibióticos, Anti-hipertensivos, etc.
    atc_code VARCHAR(10), -- Código ATC (Anatomical Therapeutic Chemical)
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES cat_medications_groups(id),
    catmat_id UUID REFERENCES cat_catmat_items(id),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL, -- Nome genérico
    active_principle VARCHAR(255) NOT NULL, -- Princípio ativo
    concentration VARCHAR(100), -- 500mg, 10mg/ml, etc.
    pharmaceutical_form VARCHAR(100), -- Comprimido, Solução, etc.
    unit VARCHAR(20), -- Unidade de dispensação
    presentation VARCHAR(255), -- Apresentação comercial
    atc_code VARCHAR(10),
    is_controlled BOOLEAN DEFAULT false, -- Portaria 344
    control_type VARCHAR(10), -- A1, A2, A3, B1, B2, C1, C2, etc.
    is_high_alert BOOLEAN DEFAULT false, -- Medicamento de alta vigilância
    is_look_alike_sound_alike BOOLEAN DEFAULT false, -- LASA
    is_refrigerated BOOLEAN DEFAULT false,
    storage_instructions TEXT,
    dilution_instructions TEXT,
    administration_routes VARCHAR(20)[], -- VO, IV, IM, SC, etc.
    max_daily_dose DECIMAL(10,2),
    max_daily_dose_unit VARCHAR(20),
    rename_component VARCHAR(255), -- RENAME
    is_rename BOOLEAN DEFAULT false, -- Se está no RENAME
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medications_code ON cat_medications(code);
CREATE INDEX idx_medications_name ON cat_medications(name);
CREATE INDEX idx_medications_principle ON cat_medications(active_principle);
CREATE INDEX idx_medications_controlled ON cat_medications(is_controlled) WHERE is_controlled = true;
CREATE INDEX idx_medications_high_alert ON cat_medications(is_high_alert) WHERE is_high_alert = true;

-- ============================================================
-- NANDA - Diagnósticos de Enfermagem
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_nanda_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    definition TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_nanda_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id UUID NOT NULL REFERENCES cat_nanda_domains(id),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    definition TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_nanda_diagnoses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES cat_nanda_classes(id),
    code VARCHAR(10) NOT NULL UNIQUE, -- Código NANDA
    name VARCHAR(500) NOT NULL,
    definition TEXT,
    diagnosis_type VARCHAR(50), -- Foco no problema, Risco, Promoção da saúde
    defining_characteristics TEXT[],
    related_factors TEXT[],
    risk_factors TEXT[],
    at_risk_populations TEXT[],
    associated_conditions TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nanda_code ON cat_nanda_diagnoses(code);
CREATE INDEX idx_nanda_class ON cat_nanda_diagnoses(class_id);

-- ============================================================
-- NIC - Classificação das Intervenções de Enfermagem
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_nic_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_nic_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id UUID NOT NULL REFERENCES cat_nic_domains(id),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_nic_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES cat_nic_classes(id),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    definition TEXT,
    activities TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nic_code ON cat_nic_interventions(code);
CREATE INDEX idx_nic_class ON cat_nic_interventions(class_id);

-- ============================================================
-- NOC - Classificação dos Resultados de Enfermagem
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_noc_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_noc_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id UUID NOT NULL REFERENCES cat_noc_domains(id),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_noc_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES cat_noc_classes(id),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    definition TEXT,
    indicators TEXT[],
    scale_type VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_noc_code ON cat_noc_outcomes(code);
CREATE INDEX idx_noc_class ON cat_noc_outcomes(class_id);

-- ============================================================
-- TUSS - Terminologia Unificada da Saúde Suplementar
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_tuss_procedures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    table_type VARCHAR(50), -- Procedimentos, Materiais, Medicamentos, Diárias/Taxas
    sigtap_code VARCHAR(10), -- Código SIGTAP equivalente
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tuss_code ON cat_tuss_procedures(code);
CREATE INDEX idx_tuss_sigtap ON cat_tuss_procedures(sigtap_code);

-- ============================================================
-- CNES - Tipos de Estabelecimento e Serviços
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_cnes_establishment_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_cnes_service_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_cnes_bed_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(100),
    is_sus BOOLEAN DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLASSIFICAÇÃO DE RISCO MANCHESTER
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_manchester_flowcharts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_manchester_discriminators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flowchart_id UUID NOT NULL REFERENCES cat_manchester_flowcharts(id),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    priority_level INTEGER NOT NULL, -- 1=Vermelho, 2=Laranja, 3=Amarelo, 4=Verde, 5=Azul
    priority_color VARCHAR(20) NOT NULL, -- RED, ORANGE, YELLOW, GREEN, BLUE
    max_wait_minutes INTEGER NOT NULL, -- Tempo máximo de espera
    order_index INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_manchester_flowchart ON cat_manchester_discriminators(flowchart_id);
CREATE INDEX idx_manchester_priority ON cat_manchester_discriminators(priority_level);

-- ============================================================
-- VACINAS - Calendário Nacional de Vacinação
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_vaccines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(20),
    manufacturer VARCHAR(255),
    disease_target VARCHAR(255)[],
    administration_route VARCHAR(20), -- IM, SC, VO, ID
    dose_volume DECIMAL(5,2),
    dose_unit VARCHAR(10),
    doses_required INTEGER,
    interval_days INTEGER[], -- Intervalo entre doses
    age_min_days INTEGER,
    age_max_days INTEGER,
    is_live_attenuated BOOLEAN DEFAULT false,
    contraindications TEXT[],
    storage_temp_min DECIMAL(5,2),
    storage_temp_max DECIMAL(5,2),
    is_pni BOOLEAN DEFAULT true, -- Programa Nacional de Imunizações
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vaccines_code ON cat_vaccines(code);
CREATE INDEX idx_vaccines_pni ON cat_vaccines(is_pni) WHERE is_pni = true;

-- ============================================================
-- EXAMES LABORATORIAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_lab_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL, -- Bioquímica, Hematologia, Microbiologia, etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_lab_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID REFERENCES cat_lab_sections(id),
    sigtap_id UUID REFERENCES cat_sigtap_procedures(id),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    abbreviation VARCHAR(50),
    material_type VARCHAR(100), -- Sangue, Urina, Fezes, etc.
    collection_tube VARCHAR(100), -- Tubo de coleta
    collection_volume DECIMAL(5,2),
    collection_instructions TEXT,
    fasting_required BOOLEAN DEFAULT false,
    fasting_hours INTEGER,
    stability_hours INTEGER, -- Estabilidade da amostra
    storage_temp VARCHAR(50),
    method VARCHAR(255), -- Método analítico
    unit VARCHAR(50), -- Unidade de medida
    reference_values JSONB, -- Valores de referência por idade/sexo
    critical_values JSONB, -- Valores críticos (pânico)
    turnaround_time_hours INTEGER, -- TAT esperado
    is_urgent_available BOOLEAN DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_exams_code ON cat_lab_exams(code);
CREATE INDEX idx_lab_exams_section ON cat_lab_exams(section_id);
CREATE INDEX idx_lab_exams_sigtap ON cat_lab_exams(sigtap_id);

-- ============================================================
-- EXAMES DE IMAGEM
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_imaging_modalities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE, -- RX, US, CT, MR, NM, etc.
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(500),
    dicom_modality VARCHAR(10), -- Código DICOM
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cat_imaging_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modality_id UUID NOT NULL REFERENCES cat_imaging_modalities(id),
    sigtap_id UUID REFERENCES cat_sigtap_procedures(id),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    body_part VARCHAR(100),
    laterality VARCHAR(20), -- BILATERAL, LEFT, RIGHT, NA
    contrast_required BOOLEAN DEFAULT false,
    contrast_type VARCHAR(100),
    preparation_instructions TEXT,
    contraindications TEXT[],
    radiation_dose_msv DECIMAL(8,4),
    typical_duration_minutes INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_imaging_exams_code ON cat_imaging_exams(code);
CREATE INDEX idx_imaging_exams_modality ON cat_imaging_exams(modality_id);
CREATE INDEX idx_imaging_exams_sigtap ON cat_imaging_exams(sigtap_id);

-- ============================================================
-- RLS para tabelas de catálogo (leitura pública)
-- ============================================================
ALTER TABLE cat_cid10_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_cid10_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_cid10_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_cid10_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_ciap2_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_ciap2_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_sigtap_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_sigtap_subgroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_sigtap_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_sigtap_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_cbo_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_cbo_occupations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_catmat_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_catmat_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_medications_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_nanda_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_nanda_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_nanda_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_nic_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_nic_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_nic_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_noc_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_noc_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_noc_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_tuss_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_cnes_establishment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_cnes_service_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_cnes_bed_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_manchester_flowcharts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_manchester_discriminators ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_vaccines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_lab_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_lab_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_imaging_modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_imaging_exams ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública para catálogos
CREATE POLICY "public_read_cid10_chapters" ON cat_cid10_chapters FOR SELECT USING (true);
CREATE POLICY "public_read_cid10_groups" ON cat_cid10_groups FOR SELECT USING (true);
CREATE POLICY "public_read_cid10_categories" ON cat_cid10_categories FOR SELECT USING (true);
CREATE POLICY "public_read_cid10_subcategories" ON cat_cid10_subcategories FOR SELECT USING (true);
CREATE POLICY "public_read_ciap2_chapters" ON cat_ciap2_chapters FOR SELECT USING (true);
CREATE POLICY "public_read_ciap2_codes" ON cat_ciap2_codes FOR SELECT USING (true);
CREATE POLICY "public_read_sigtap_groups" ON cat_sigtap_groups FOR SELECT USING (true);
CREATE POLICY "public_read_sigtap_subgroups" ON cat_sigtap_subgroups FOR SELECT USING (true);
CREATE POLICY "public_read_sigtap_forms" ON cat_sigtap_forms FOR SELECT USING (true);
CREATE POLICY "public_read_sigtap_procedures" ON cat_sigtap_procedures FOR SELECT USING (true);
CREATE POLICY "public_read_cbo_families" ON cat_cbo_families FOR SELECT USING (true);
CREATE POLICY "public_read_cbo_occupations" ON cat_cbo_occupations FOR SELECT USING (true);
CREATE POLICY "public_read_catmat_classes" ON cat_catmat_classes FOR SELECT USING (true);
CREATE POLICY "public_read_catmat_items" ON cat_catmat_items FOR SELECT USING (true);
CREATE POLICY "public_read_medications_groups" ON cat_medications_groups FOR SELECT USING (true);
CREATE POLICY "public_read_medications" ON cat_medications FOR SELECT USING (true);
CREATE POLICY "public_read_nanda_domains" ON cat_nanda_domains FOR SELECT USING (true);
CREATE POLICY "public_read_nanda_classes" ON cat_nanda_classes FOR SELECT USING (true);
CREATE POLICY "public_read_nanda_diagnoses" ON cat_nanda_diagnoses FOR SELECT USING (true);
CREATE POLICY "public_read_nic_domains" ON cat_nic_domains FOR SELECT USING (true);
CREATE POLICY "public_read_nic_classes" ON cat_nic_classes FOR SELECT USING (true);
CREATE POLICY "public_read_nic_interventions" ON cat_nic_interventions FOR SELECT USING (true);
CREATE POLICY "public_read_noc_domains" ON cat_noc_domains FOR SELECT USING (true);
CREATE POLICY "public_read_noc_classes" ON cat_noc_classes FOR SELECT USING (true);
CREATE POLICY "public_read_noc_outcomes" ON cat_noc_outcomes FOR SELECT USING (true);
CREATE POLICY "public_read_tuss" ON cat_tuss_procedures FOR SELECT USING (true);
CREATE POLICY "public_read_cnes_establishments" ON cat_cnes_establishment_types FOR SELECT USING (true);
CREATE POLICY "public_read_cnes_services" ON cat_cnes_service_classes FOR SELECT USING (true);
CREATE POLICY "public_read_cnes_beds" ON cat_cnes_bed_types FOR SELECT USING (true);
CREATE POLICY "public_read_manchester_flowcharts" ON cat_manchester_flowcharts FOR SELECT USING (true);
CREATE POLICY "public_read_manchester_discriminators" ON cat_manchester_discriminators FOR SELECT USING (true);
CREATE POLICY "public_read_vaccines" ON cat_vaccines FOR SELECT USING (true);
CREATE POLICY "public_read_lab_sections" ON cat_lab_sections FOR SELECT USING (true);
CREATE POLICY "public_read_lab_exams" ON cat_lab_exams FOR SELECT USING (true);
CREATE POLICY "public_read_imaging_modalities" ON cat_imaging_modalities FOR SELECT USING (true);
CREATE POLICY "public_read_imaging_exams" ON cat_imaging_exams FOR SELECT USING (true);

-- Políticas de escrita apenas para service_role
CREATE POLICY "admin_write_cid10_chapters" ON cat_cid10_chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_cid10_groups" ON cat_cid10_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_cid10_categories" ON cat_cid10_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_cid10_subcategories" ON cat_cid10_subcategories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_ciap2_chapters" ON cat_ciap2_chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_ciap2_codes" ON cat_ciap2_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_sigtap_groups" ON cat_sigtap_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_sigtap_subgroups" ON cat_sigtap_subgroups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_sigtap_forms" ON cat_sigtap_forms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_sigtap_procedures" ON cat_sigtap_procedures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_cbo_families" ON cat_cbo_families FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_cbo_occupations" ON cat_cbo_occupations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_catmat_classes" ON cat_catmat_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_catmat_items" ON cat_catmat_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_medications_groups" ON cat_medications_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_medications" ON cat_medications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_nanda_domains" ON cat_nanda_domains FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_nanda_classes" ON cat_nanda_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_nanda_diagnoses" ON cat_nanda_diagnoses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_nic_domains" ON cat_nic_domains FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_nic_classes" ON cat_nic_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_nic_interventions" ON cat_nic_interventions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_noc_domains" ON cat_noc_domains FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_noc_classes" ON cat_noc_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_noc_outcomes" ON cat_noc_outcomes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_tuss" ON cat_tuss_procedures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_cnes_establishments" ON cat_cnes_establishment_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_cnes_services" ON cat_cnes_service_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_cnes_beds" ON cat_cnes_bed_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_manchester_flowcharts" ON cat_manchester_flowcharts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_manchester_discriminators" ON cat_manchester_discriminators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_vaccines" ON cat_vaccines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_lab_sections" ON cat_lab_sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_lab_exams" ON cat_lab_exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_imaging_modalities" ON cat_imaging_modalities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_write_imaging_exams" ON cat_imaging_exams FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================
COMMENT ON TABLE cat_cid10_chapters IS 'CID-10: Capítulos da classificação';
COMMENT ON TABLE cat_cid10_categories IS 'CID-10: Categorias (códigos de 3 caracteres)';
COMMENT ON TABLE cat_cid10_subcategories IS 'CID-10: Subcategorias (códigos de 4+ caracteres)';
COMMENT ON TABLE cat_ciap2_chapters IS 'CIAP-2: Capítulos da classificação';
COMMENT ON TABLE cat_ciap2_codes IS 'CIAP-2: Códigos de atenção primária';
COMMENT ON TABLE cat_sigtap_procedures IS 'SIGTAP: Procedimentos SUS com valores e regras';
COMMENT ON TABLE cat_cbo_occupations IS 'CBO: Ocupações brasileiras';
COMMENT ON TABLE cat_medications IS 'Catálogo de medicamentos com informações farmacológicas';
COMMENT ON TABLE cat_nanda_diagnoses IS 'NANDA: Diagnósticos de enfermagem';
COMMENT ON TABLE cat_nic_interventions IS 'NIC: Intervenções de enfermagem';
COMMENT ON TABLE cat_noc_outcomes IS 'NOC: Resultados de enfermagem';
COMMENT ON TABLE cat_manchester_discriminators IS 'Protocolo Manchester: Discriminadores por fluxograma';
COMMENT ON TABLE cat_vaccines IS 'Vacinas do calendário nacional';
COMMENT ON TABLE cat_lab_exams IS 'Exames laboratoriais com valores de referência';
COMMENT ON TABLE cat_imaging_exams IS 'Exames de imagem por modalidade';
