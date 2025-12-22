-- ============================================================
-- NEXUS - Sistema Integrado de Gestão Municipal da Saúde
-- MÓDULO: HOSP - Gestão Hospitalar
-- Recepção, Manchester, SOAP, Prescrição
-- ============================================================

-- ============================================================
-- RECEPÇÃO E ATENDIMENTOS
-- ============================================================

-- Atendimentos (Episódios de cuidado)
CREATE TABLE IF NOT EXISTS hosp_encounters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    
    -- Paciente
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Unidade e Setor
    unit_id UUID NOT NULL REFERENCES core_units(id),
    sector_id UUID REFERENCES core_sectors(id),
    
    -- Tipo de atendimento
    encounter_type VARCHAR(30) NOT NULL, -- URGENCIA, EMERGENCIA, INTERNACAO, AMBULATORIO, OBSERVACAO
    encounter_class VARCHAR(30) NOT NULL, -- PRESENCIAL, VIRTUAL, DOMICILIAR
    
    -- Status do atendimento
    status VARCHAR(30) DEFAULT 'WAITING', -- WAITING, IN_PROGRESS, FINISHED, CANCELLED, NO_SHOW
    
    -- Prioridade (Manchester)
    priority_color VARCHAR(10), -- RED, ORANGE, YELLOW, GREEN, BLUE
    priority_level INTEGER, -- 1-5 (1=mais urgente)
    
    -- Datas/Horas
    arrival_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triage_start_at TIMESTAMPTZ,
    triage_end_at TIMESTAMPTZ,
    service_start_at TIMESTAMPTZ,
    service_end_at TIMESTAMPTZ,
    discharge_at TIMESTAMPTZ,
    
    -- Origem e destino
    origin VARCHAR(50), -- DEMANDA_ESPONTANEA, SAMU, REFERENCIA, REGULACAO
    origin_unit_id UUID REFERENCES core_units(id),
    destination VARCHAR(50), -- ALTA, INTERNACAO, TRANSFERENCIA, OBITO, EVASAO
    destination_unit_id UUID REFERENCES core_units(id),
    
    -- Leito (se internação)
    bed_id UUID REFERENCES hosp_beds(id),
    
    -- Profissional responsável atual
    attending_professional_id UUID REFERENCES core_persons(id),
    
    -- Queixa principal
    chief_complaint TEXT,
    
    -- Diagnósticos
    primary_diagnosis_cid10 VARCHAR(10),
    secondary_diagnoses_cid10 VARCHAR(10)[],
    
    -- Desfecho
    discharge_type VARCHAR(30), -- ALTA_MELHORADO, ALTA_CURADO, ALTA_A_PEDIDO, TRANSFERENCIA, OBITO, EVASAO
    discharge_summary TEXT,
    
    -- Número do atendimento (sequencial por unidade/ano)
    encounter_number VARCHAR(20),
    
    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES core_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES core_users(id),
    version INTEGER DEFAULT 1
);

-- Leitos hospitalares
CREATE TABLE IF NOT EXISTS hosp_beds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    unit_id UUID NOT NULL REFERENCES core_units(id),
    sector_id UUID NOT NULL REFERENCES core_sectors(id),
    
    bed_number VARCHAR(20) NOT NULL,
    bed_type VARCHAR(30) NOT NULL, -- ENFERMARIA, UTI, UTI_PED, ISOLAMENTO, OBSERVACAO, BERCO
    
    -- Status
    status VARCHAR(20) DEFAULT 'AVAILABLE', -- AVAILABLE, OCCUPIED, MAINTENANCE, BLOCKED
    current_patient_id UUID REFERENCES mpi_patients(id),
    current_encounter_id UUID REFERENCES hosp_encounters(id),
    
    -- Características
    has_oxygen BOOLEAN DEFAULT false,
    has_suction BOOLEAN DEFAULT false,
    has_monitor BOOLEAN DEFAULT false,
    has_ventilator BOOLEAN DEFAULT false,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, unit_id, bed_number)
);

-- Fila de espera por classificação
CREATE TABLE IF NOT EXISTS hosp_waiting_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    encounter_id UUID NOT NULL REFERENCES hosp_encounters(id),
    unit_id UUID NOT NULL REFERENCES core_units(id),
    sector_id UUID REFERENCES core_sectors(id),
    
    -- Posição e prioridade
    queue_position INTEGER NOT NULL,
    priority_color VARCHAR(10) NOT NULL,
    priority_level INTEGER NOT NULL,
    
    -- Tempos
    entered_queue_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    max_wait_minutes INTEGER NOT NULL,
    target_service_at TIMESTAMPTZ NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'WAITING', -- WAITING, CALLED, IN_SERVICE, COMPLETED, NO_SHOW
    called_at TIMESTAMPTZ,
    called_by UUID REFERENCES core_users(id),
    
    -- Número da senha
    ticket_number VARCHAR(20) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLASSIFICAÇÃO DE RISCO (MANCHESTER)
-- ============================================================

-- Triagem/Classificação de Risco
CREATE TABLE IF NOT EXISTS hosp_triage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    encounter_id UUID NOT NULL REFERENCES hosp_encounters(id),
    
    -- Profissional que realizou
    performed_by UUID NOT NULL REFERENCES core_users(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Fluxograma Manchester utilizado
    flowchart_id UUID REFERENCES cat_manchester_flowcharts(id),
    flowchart_code VARCHAR(20),
    
    -- Discriminador selecionado
    discriminator_id UUID REFERENCES cat_manchester_discriminators(id),
    discriminator_text VARCHAR(200),
    
    -- Classificação final
    priority_color VARCHAR(10) NOT NULL, -- RED, ORANGE, YELLOW, GREEN, BLUE
    priority_level INTEGER NOT NULL, -- 1-5
    max_wait_minutes INTEGER NOT NULL,
    
    -- Queixa principal
    chief_complaint TEXT NOT NULL,
    
    -- Sinais vitais
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    temperature DECIMAL(4,1),
    oxygen_saturation INTEGER,
    pain_scale INTEGER, -- 0-10
    glasgow_score INTEGER, -- 3-15
    
    -- Glicemia
    blood_glucose INTEGER,
    
    -- Antropometria
    weight DECIMAL(5,2),
    height DECIMAL(3,2),
    
    -- Observações clínicas
    clinical_notes TEXT,
    
    -- Alergias informadas (referência rápida)
    reported_allergies TEXT[],
    
    -- Reclassificação
    is_reclassification BOOLEAN DEFAULT false,
    previous_triage_id UUID REFERENCES hosp_triage(id),
    reclassification_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_priority_color CHECK (priority_color IN ('RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE')),
    CONSTRAINT valid_priority_level CHECK (priority_level BETWEEN 1 AND 5)
);

-- ============================================================
-- PRONTUÁRIO ELETRÔNICO (SOAP)
-- ============================================================

-- Evoluções clínicas (SOAP)
CREATE TABLE IF NOT EXISTS hosp_clinical_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    encounter_id UUID NOT NULL REFERENCES hosp_encounters(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Tipo de evolução
    note_type VARCHAR(30) NOT NULL, -- SOAP, ADMISSAO, EVOLUCAO, ALTA, INTERCONSULTA, PARECER
    
    -- Profissional
    author_id UUID NOT NULL REFERENCES core_users(id),
    author_specialty VARCHAR(100),
    
    -- SOAP
    subjective TEXT, -- S - Queixa do paciente
    objective TEXT,  -- O - Exame físico, sinais vitais
    assessment TEXT, -- A - Avaliação/Diagnóstico
    plan TEXT,       -- P - Plano terapêutico
    
    -- Diagnósticos desta evolução
    diagnoses JSONB DEFAULT '[]', -- [{cid10, description, type: PRIMARY|SECONDARY}]
    
    -- Procedimentos realizados
    procedures JSONB DEFAULT '[]', -- [{sigtap_code, description, quantity}]
    
    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, SIGNED, AMENDED, CANCELLED
    signed_at TIMESTAMPTZ,
    
    -- Assinatura digital
    digital_signature TEXT,
    signature_certificate TEXT,
    
    -- Versionamento para correções
    version INTEGER DEFAULT 1,
    amended_from_id UUID REFERENCES hosp_clinical_notes(id),
    amendment_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sinais vitais (registro frequente)
CREATE TABLE IF NOT EXISTS hosp_vital_signs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    encounter_id UUID NOT NULL REFERENCES hosp_encounters(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Profissional que aferiu
    recorded_by UUID NOT NULL REFERENCES core_users(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Sinais vitais
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    temperature DECIMAL(4,1),
    oxygen_saturation INTEGER,
    
    -- Dor e consciência
    pain_scale INTEGER,
    glasgow_score INTEGER,
    glasgow_details JSONB, -- {eye: 4, verbal: 5, motor: 6}
    
    -- Glicemia
    blood_glucose INTEGER,
    blood_glucose_timing VARCHAR(20), -- JEJUM, POS_PRANDIAL, ALEATORIO
    
    -- Balanço hídrico
    fluid_intake_ml INTEGER,
    fluid_output_ml INTEGER,
    
    -- Observações
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRESCRIÇÃO ELETRÔNICA
-- ============================================================

-- Prescrições médicas
CREATE TABLE IF NOT EXISTS hosp_prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    encounter_id UUID NOT NULL REFERENCES hosp_encounters(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Tipo de prescrição
    prescription_type VARCHAR(20) NOT NULL, -- HOSPITALAR, ALTA, AMBULATORIAL
    
    -- Prescritor
    prescriber_id UUID NOT NULL REFERENCES core_users(id),
    prescriber_council_type VARCHAR(10), -- CRM, COREN, CRO
    prescriber_council_number VARCHAR(20),
    prescriber_council_state VARCHAR(2),
    
    -- Validade
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, CANCELLED, COMPLETED
    
    -- Número da prescrição
    prescription_number VARCHAR(30),
    
    -- Observações gerais
    general_notes TEXT,
    
    -- Dieta
    diet_type VARCHAR(50), -- LIVRE, BRANDA, PASTOSA, LIQUIDA, ZERO, ENTERAL, PARENTERAL
    diet_restrictions TEXT,
    
    -- Cuidados de enfermagem
    nursing_care TEXT[],
    
    -- Assinatura
    signed_at TIMESTAMPTZ,
    digital_signature TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Itens da prescrição (medicamentos)
CREATE TABLE IF NOT EXISTS hosp_prescription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    prescription_id UUID NOT NULL REFERENCES hosp_prescriptions(id),
    
    -- Medicamento
    medication_id UUID REFERENCES cat_medications(id),
    medication_code VARCHAR(20),
    medication_name VARCHAR(200) NOT NULL,
    active_principle VARCHAR(200),
    
    -- Posologia
    dose VARCHAR(50) NOT NULL, -- Ex: "500mg", "10mL", "1 comprimido"
    dose_unit VARCHAR(20), -- mg, mL, UI, gotas
    frequency VARCHAR(50) NOT NULL, -- Ex: "8/8h", "12/12h", "1x/dia"
    frequency_hours INTEGER, -- Intervalo em horas
    administration_route VARCHAR(20) NOT NULL, -- VO, IV, IM, SC, SL, TOP, etc
    
    -- Duração
    duration_value INTEGER,
    duration_unit VARCHAR(20), -- DIAS, SEMANAS, MESES, CONTINUO
    
    -- Diluição (se aplicável)
    dilution VARCHAR(100), -- Ex: "SF 0,9% 100mL"
    infusion_time VARCHAR(50), -- Ex: "30 minutos", "1 hora"
    
    -- Horários específicos
    specific_times TIME[],
    
    -- Instruções
    instructions TEXT,
    
    -- Se necessário (SOS)
    is_if_needed BOOLEAN DEFAULT false,
    if_needed_condition TEXT,
    max_daily_doses INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, CANCELLED, COMPLETED
    suspended_at TIMESTAMPTZ,
    suspended_by UUID REFERENCES core_users(id),
    suspension_reason TEXT,
    
    -- Ordem de exibição
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aprazamento (checagem de medicamentos pela enfermagem)
CREATE TABLE IF NOT EXISTS hosp_medication_administration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    prescription_item_id UUID NOT NULL REFERENCES hosp_prescription_items(id),
    encounter_id UUID NOT NULL REFERENCES hosp_encounters(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Horário programado
    scheduled_at TIMESTAMPTZ NOT NULL,
    
    -- Administração
    status VARCHAR(20) DEFAULT 'SCHEDULED', -- SCHEDULED, ADMINISTERED, DELAYED, NOT_ADMINISTERED, CANCELLED
    administered_at TIMESTAMPTZ,
    administered_by UUID REFERENCES core_users(id),
    
    -- Dose efetivamente administrada
    dose_administered VARCHAR(50),
    
    -- Se não administrado
    not_administered_reason VARCHAR(50), -- RECUSA, JEJUM, AUSENTE, SUSPENSO, ESTOQUE
    not_administered_notes TEXT,
    
    -- Observações
    notes TEXT,
    
    -- Lote e validade (rastreabilidade)
    medication_lot VARCHAR(50),
    medication_expiry DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interações medicamentosas detectadas
CREATE TABLE IF NOT EXISTS hosp_drug_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    prescription_id UUID NOT NULL REFERENCES hosp_prescriptions(id),
    
    -- Medicamentos envolvidos
    medication_a_id UUID REFERENCES hosp_prescription_items(id),
    medication_a_name VARCHAR(200),
    medication_b_id UUID REFERENCES hosp_prescription_items(id),
    medication_b_name VARCHAR(200),
    
    -- Gravidade
    severity VARCHAR(20) NOT NULL, -- GRAVE, MODERADA, LEVE
    
    -- Descrição da interação
    interaction_description TEXT NOT NULL,
    clinical_effect TEXT,
    recommendation TEXT,
    
    -- Ação tomada
    action_taken VARCHAR(30), -- ACCEPTED, MODIFIED, CANCELLED
    action_by UUID REFERENCES core_users(id),
    action_at TIMESTAMPTZ,
    action_justification TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SOLICITAÇÕES DE EXAMES
-- ============================================================

-- Solicitações de exames
CREATE TABLE IF NOT EXISTS hosp_exam_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    encounter_id UUID NOT NULL REFERENCES hosp_encounters(id),
    patient_id UUID NOT NULL REFERENCES mpi_patients(id),
    
    -- Solicitante
    requester_id UUID NOT NULL REFERENCES core_users(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tipo de exame
    exam_type VARCHAR(30) NOT NULL, -- LABORATORIO, IMAGEM, OUTRO
    
    -- Prioridade
    priority VARCHAR(20) DEFAULT 'ROUTINE', -- EMERGENCY, URGENT, ROUTINE
    
    -- Status
    status VARCHAR(20) DEFAULT 'REQUESTED', -- REQUESTED, COLLECTED, IN_PROGRESS, COMPLETED, CANCELLED
    
    -- Indicação clínica
    clinical_indication TEXT,
    
    -- Número da requisição
    request_number VARCHAR(30),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Itens da solicitação de exames
CREATE TABLE IF NOT EXISTS hosp_exam_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core_tenants(id),
    request_id UUID NOT NULL REFERENCES hosp_exam_requests(id),
    
    -- Procedimento SIGTAP
    procedure_id UUID REFERENCES cat_sigtap_procedures(id),
    procedure_code VARCHAR(20),
    procedure_name VARCHAR(200) NOT NULL,
    
    -- Quantidade
    quantity INTEGER DEFAULT 1,
    
    -- Lateralidade (para imagem)
    laterality VARCHAR(10), -- DIREITA, ESQUERDA, BILATERAL
    
    -- Preparo necessário
    preparation_instructions TEXT,
    
    -- Status individual
    status VARCHAR(20) DEFAULT 'REQUESTED', -- REQUESTED, COLLECTED, IN_PROGRESS, COMPLETED, CANCELLED
    
    -- Resultado (resumo)
    result_summary TEXT,
    result_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hosp_encounters_tenant ON hosp_encounters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hosp_encounters_patient ON hosp_encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_hosp_encounters_unit ON hosp_encounters(unit_id);
CREATE INDEX IF NOT EXISTS idx_hosp_encounters_status ON hosp_encounters(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hosp_encounters_arrival ON hosp_encounters(arrival_at DESC);
CREATE INDEX IF NOT EXISTS idx_hosp_encounters_type ON hosp_encounters(encounter_type);

CREATE INDEX IF NOT EXISTS idx_hosp_beds_tenant ON hosp_beds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hosp_beds_status ON hosp_beds(tenant_id, unit_id, status);

CREATE INDEX IF NOT EXISTS idx_hosp_queue_tenant ON hosp_waiting_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hosp_queue_waiting ON hosp_waiting_queue(tenant_id, unit_id, status) WHERE status = 'WAITING';
CREATE INDEX IF NOT EXISTS idx_hosp_queue_priority ON hosp_waiting_queue(priority_level, entered_queue_at);

CREATE INDEX IF NOT EXISTS idx_hosp_triage_encounter ON hosp_triage(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hosp_triage_priority ON hosp_triage(priority_color);

CREATE INDEX IF NOT EXISTS idx_hosp_notes_encounter ON hosp_clinical_notes(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hosp_notes_patient ON hosp_clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_hosp_notes_author ON hosp_clinical_notes(author_id);

CREATE INDEX IF NOT EXISTS idx_hosp_vitals_encounter ON hosp_vital_signs(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hosp_vitals_recorded ON hosp_vital_signs(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_hosp_prescriptions_encounter ON hosp_prescriptions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hosp_prescriptions_patient ON hosp_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_hosp_prescriptions_active ON hosp_prescriptions(tenant_id, status) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_hosp_presc_items_prescription ON hosp_prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_hosp_presc_items_active ON hosp_prescription_items(prescription_id, status) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_hosp_med_admin_scheduled ON hosp_medication_administration(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_hosp_med_admin_status ON hosp_medication_administration(status);

CREATE INDEX IF NOT EXISTS idx_hosp_exams_encounter ON hosp_exam_requests(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hosp_exams_status ON hosp_exam_requests(status);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE hosp_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_waiting_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_triage ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_medication_administration ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_drug_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_exam_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosp_exam_request_items ENABLE ROW LEVEL SECURITY;

-- Policies de tenant
CREATE POLICY hosp_encounters_tenant_policy ON hosp_encounters
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_beds_tenant_policy ON hosp_beds
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_queue_tenant_policy ON hosp_waiting_queue
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_triage_tenant_policy ON hosp_triage
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_notes_tenant_policy ON hosp_clinical_notes
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_vitals_tenant_policy ON hosp_vital_signs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_prescriptions_tenant_policy ON hosp_prescriptions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_presc_items_tenant_policy ON hosp_prescription_items
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_med_admin_tenant_policy ON hosp_medication_administration
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_drug_interactions_tenant_policy ON hosp_drug_interactions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_exams_tenant_policy ON hosp_exam_requests
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY hosp_exam_items_tenant_policy ON hosp_exam_request_items
    FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ============================================================
-- PERMISSÕES RBAC DO HOSP
-- ============================================================
INSERT INTO rbac_permissions (id, module_code, resource, action, description, is_sensitive) VALUES
    -- Atendimentos
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'HOSP', 'encounters', 'create', 'Registrar atendimento', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'HOSP', 'encounters', 'read', 'Visualizar atendimento', true),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'HOSP', 'encounters', 'update', 'Editar atendimento', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'HOSP', 'encounters', 'discharge', 'Dar alta', false),
    
    -- Triagem
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'HOSP', 'triage', 'perform', 'Realizar triagem', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'HOSP', 'triage', 'reclassify', 'Reclassificar paciente', false),
    
    -- Evolução clínica
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'HOSP', 'clinical_notes', 'create', 'Criar evolução', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'HOSP', 'clinical_notes', 'read', 'Visualizar evolução', true),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'HOSP', 'clinical_notes', 'sign', 'Assinar evolução', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'HOSP', 'clinical_notes', 'amend', 'Retificar evolução', false),
    
    -- Sinais vitais
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', 'HOSP', 'vital_signs', 'record', 'Registrar sinais vitais', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'HOSP', 'vital_signs', 'read', 'Visualizar sinais vitais', false),
    
    -- Prescrição
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a40', 'HOSP', 'prescriptions', 'create', 'Criar prescrição', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'HOSP', 'prescriptions', 'read', 'Visualizar prescrição', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'HOSP', 'prescriptions', 'sign', 'Assinar prescrição', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 'HOSP', 'prescriptions', 'suspend', 'Suspender item', false),
    
    -- Administração de medicamentos
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a50', 'HOSP', 'medication_admin', 'schedule', 'Aprazar medicação', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'HOSP', 'medication_admin', 'administer', 'Administrar medicação', false),
    
    -- Exames
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a60', 'HOSP', 'exam_requests', 'create', 'Solicitar exame', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a61', 'HOSP', 'exam_requests', 'read', 'Visualizar solicitações', false),
    
    -- Leitos
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a70', 'HOSP', 'beds', 'manage', 'Gerenciar leitos', false),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a71', 'HOSP', 'beds', 'view_census', 'Visualizar censo', false)
ON CONFLICT (id) DO NOTHING;
