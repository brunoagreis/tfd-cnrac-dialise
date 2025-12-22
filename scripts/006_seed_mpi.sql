-- ============================================================
-- NEXUS - SEED: MPI - Master Patient Index
-- Dados de demonstração
-- ============================================================

-- Criar pacientes a partir das pessoas já cadastradas (exceto profissionais)
INSERT INTO mpi_patients (
    id,
    tenant_id,
    person_id,
    medical_record_number,
    marital_status,
    education_level,
    blood_type,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
    created_by
)
SELECT 
    uuid_generate_v4(),
    p.tenant_id,
    p.id,
    'PRONT-' || LPAD((ROW_NUMBER() OVER(ORDER BY p.created_at))::text, 6, '0'),
    (ARRAY['SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO', 'UNIAO_ESTAVEL'])[floor(random() * 5 + 1)],
    (ARRAY['FUNDAMENTAL', 'MEDIO', 'SUPERIOR'])[floor(random() * 3 + 1)],
    (ARRAY['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])[floor(random() * 8 + 1)],
    'Contato de ' || p.full_name,
    '11' || LPAD((random() * 99999999)::int::text, 8, '0'),
    (ARRAY['CONJUGE', 'PAI', 'MAE', 'FILHO', 'IRMAO'])[floor(random() * 5 + 1)],
    '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
FROM core_persons p
WHERE p.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND p.email IS NULL -- Pacientes não têm email corporativo
  AND NOT EXISTS (SELECT 1 FROM mpi_patients mp WHERE mp.person_id = p.id);

-- Inserir alergias para alguns pacientes
INSERT INTO mpi_allergies (tenant_id, patient_id, allergy_type, allergen, severity, reaction_description, created_by)
SELECT 
    mp.tenant_id,
    mp.id,
    a.allergy_type,
    a.allergen,
    a.severity,
    a.reaction,
    '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
FROM mpi_patients mp
CROSS JOIN (VALUES
    ('MEDICAMENTO', 'Dipirona', 'MODERADA', 'Urticária e prurido'),
    ('MEDICAMENTO', 'Penicilina', 'GRAVE', 'Edema de glote'),
    ('MEDICAMENTO', 'AAS', 'LEVE', 'Desconforto gástrico'),
    ('ALIMENTO', 'Amendoim', 'GRAVE', 'Anafilaxia'),
    ('ALIMENTO', 'Frutos do mar', 'MODERADA', 'Urticária generalizada'),
    ('CONTRASTE', 'Iodo', 'GRAVE', 'Choque anafilático'),
    ('LATEX', 'Látex', 'MODERADA', 'Dermatite de contato')
) a(allergy_type, allergen, severity, reaction)
WHERE mp.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND random() < 0.15 -- 15% dos pacientes
LIMIT 30;

-- Inserir condições crônicas para alguns pacientes
INSERT INTO mpi_conditions (tenant_id, patient_id, condition_type, cid10_code, description, severity, clinical_status, recorded_by)
SELECT 
    mp.tenant_id,
    mp.id,
    c.cond_type,
    c.cid10,
    c.description,
    c.severity,
    'ACTIVE',
    '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
FROM mpi_patients mp
CROSS JOIN (VALUES
    ('CRONICA', 'I10', 'Hipertensão arterial sistêmica', 'MODERADA'),
    ('CRONICA', 'E11', 'Diabetes mellitus tipo 2', 'MODERADA'),
    ('CRONICA', 'J45', 'Asma', 'LEVE'),
    ('CRONICA', 'M54', 'Dorsalgia', 'LEVE'),
    ('CRONICA', 'F32', 'Episódio depressivo', 'MODERADA'),
    ('CRONICA', 'E78', 'Dislipidemia', 'LEVE'),
    ('CRONICA', 'K21', 'Doença do refluxo gastroesofágico', 'LEVE'),
    ('ANTECEDENTE', 'Z87.1', 'Antecedente de doenças do aparelho digestivo', NULL),
    ('FAMILIAR', 'Z82.4', 'História familiar de doença isquêmica do coração', NULL)
) c(cond_type, cid10, description, severity)
WHERE mp.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND random() < 0.25 -- 25% dos pacientes
LIMIT 50;

-- Inserir vacinações
INSERT INTO mpi_immunizations (
    tenant_id, 
    patient_id, 
    vaccine_code, 
    vaccine_name, 
    administration_date, 
    dose_sequence, 
    administration_site, 
    administration_route,
    administered_at_unit_id,
    status,
    created_by
)
SELECT 
    mp.tenant_id,
    mp.id,
    v.code,
    v.name,
    CURRENT_DATE - (random() * 365 * 3)::int, -- Últimos 3 anos
    v.dose,
    'Deltóide E',
    'IM',
    'b6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', -- UBS Centro
    'COMPLETED',
    '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
FROM mpi_patients mp
CROSS JOIN (VALUES
    ('86', 'Vacina COVID-19', 'D1'),
    ('86', 'Vacina COVID-19', 'D2'),
    ('86', 'Vacina COVID-19', 'REF'),
    ('23', 'Vacina Influenza', 'ANUAL'),
    ('09', 'Vacina Hepatite B', 'D1'),
    ('09', 'Vacina Hepatite B', 'D2'),
    ('09', 'Vacina Hepatite B', 'D3'),
    ('28', 'Vacina dT (Difteria e Tétano)', 'REF')
) v(code, name, dose)
WHERE mp.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND random() < 0.4 -- 40% dos pacientes
LIMIT 100;

-- Inserir consentimentos LGPD
INSERT INTO mpi_consents (tenant_id, patient_id, consent_type, status, collection_method, created_by)
SELECT 
    mp.tenant_id,
    mp.id,
    ct.consent_type,
    'ACTIVE',
    'PRESENCIAL',
    '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
FROM mpi_patients mp
CROSS JOIN (VALUES
    ('TRATAMENTO'),
    ('COMPARTILHAMENTO')
) ct(consent_type)
WHERE mp.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- Criar alguns candidatos a duplicata para demonstração
-- (simulando pacientes que podem ser duplicados)
INSERT INTO mpi_duplicate_candidates (
    tenant_id,
    patient_id_a,
    patient_id_b,
    similarity_score,
    match_details,
    status
)
SELECT 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    p1.id,
    p2.id,
    75.50,
    '{"name": 92, "birth_date": 100, "mother_name": 85, "cpf": 0}'::jsonb,
    'PENDING'
FROM mpi_patients p1
CROSS JOIN mpi_patients p2
WHERE p1.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND p2.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND p1.id < p2.id
  AND p1.id != p2.id
LIMIT 3;
