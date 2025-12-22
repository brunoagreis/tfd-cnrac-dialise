-- ============================================================
-- NEXUS - SEED: HOSP - Gestão Hospitalar
-- Dados de demonstração
-- ============================================================

-- Criar leitos para o Hospital Municipal Central
INSERT INTO hosp_beds (tenant_id, unit_id, sector_id, bed_number, bed_type, status, has_oxygen, has_suction, has_monitor, has_ventilator)
SELECT 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Hospital Municipal Central
    s.sector_id,
    s.prefix || '-' || LPAD(n::text, 2, '0'),
    s.bed_type,
    'AVAILABLE',
    s.has_oxygen,
    s.has_suction,
    s.has_monitor,
    s.has_ventilator
FROM (
    SELECT 
        'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid as sector_id, 'EMG' as prefix, 'OBSERVACAO' as bed_type, 
        true as has_oxygen, true as has_suction, false as has_monitor, false as has_ventilator, 20 as qty
    UNION ALL SELECT 
        'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'UTI', 'UTI', true, true, true, true, 20
    UNION ALL SELECT 
        'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'UTIP', 'UTI_PED', true, true, true, true, 10
    UNION ALL SELECT 
        'c5eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'ECLI', 'ENFERMARIA', true, true, false, false, 30
    UNION ALL SELECT 
        'c6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'ECIR', 'ENFERMARIA', true, true, false, false, 20
    UNION ALL SELECT 
        'c7eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'MAT', 'BERCO', true, false, false, false, 15
) s
CROSS JOIN generate_series(1, s.qty) n;

-- Criar alguns atendimentos de exemplo
INSERT INTO hosp_encounters (
    id,
    tenant_id,
    patient_id,
    unit_id,
    sector_id,
    encounter_type,
    encounter_class,
    status,
    priority_color,
    priority_level,
    arrival_at,
    chief_complaint,
    encounter_number,
    created_by
)
SELECT 
    uuid_generate_v4(),
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    p.id,
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    (ARRAY['URGENCIA', 'EMERGENCIA'])[floor(random() * 2 + 1)],
    'PRESENCIAL',
    (ARRAY['WAITING', 'IN_PROGRESS', 'FINISHED'])[floor(random() * 3 + 1)],
    (ARRAY['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE'])[floor(random() * 5 + 1)],
    floor(random() * 5 + 1),
    NOW() - (random() * interval '24 hours'),
    (ARRAY[
        'Dor torácica', 'Dispneia', 'Cefaleia intensa', 'Dor abdominal', 
        'Febre alta', 'Trauma em MID', 'Mal-estar geral', 'Náuseas e vômitos'
    ])[floor(random() * 8 + 1)],
    'ATD-' || LPAD((ROW_NUMBER() OVER())::text, 8, '0'),
    '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
FROM mpi_patients p
WHERE p.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
LIMIT 15;

-- Criar triagens para os atendimentos
INSERT INTO hosp_triage (
    tenant_id,
    encounter_id,
    performed_by,
    priority_color,
    priority_level,
    max_wait_minutes,
    chief_complaint,
    blood_pressure_systolic,
    blood_pressure_diastolic,
    heart_rate,
    respiratory_rate,
    temperature,
    oxygen_saturation,
    pain_scale
)
SELECT 
    e.tenant_id,
    e.id,
    '04eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', -- Dr. Carlos (médico)
    e.priority_color,
    e.priority_level,
    CASE e.priority_color
        WHEN 'RED' THEN 0
        WHEN 'ORANGE' THEN 10
        WHEN 'YELLOW' THEN 60
        WHEN 'GREEN' THEN 120
        ELSE 240
    END,
    e.chief_complaint,
    floor(random() * 60 + 100), -- PA sistólica 100-160
    floor(random() * 30 + 60),  -- PA diastólica 60-90
    floor(random() * 40 + 60),  -- FC 60-100
    floor(random() * 10 + 12),  -- FR 12-22
    35.5 + random() * 3,        -- Temp 35.5-38.5
    floor(random() * 6 + 94),   -- SpO2 94-100
    floor(random() * 10)        -- Dor 0-9
FROM hosp_encounters e
WHERE e.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- Criar fila de espera para pacientes aguardando
INSERT INTO hosp_waiting_queue (
    tenant_id,
    encounter_id,
    unit_id,
    sector_id,
    queue_position,
    priority_color,
    priority_level,
    max_wait_minutes,
    target_service_at,
    ticket_number
)
SELECT 
    e.tenant_id,
    e.id,
    e.unit_id,
    e.sector_id,
    ROW_NUMBER() OVER(ORDER BY e.priority_level, e.arrival_at),
    e.priority_color,
    e.priority_level,
    CASE e.priority_color
        WHEN 'RED' THEN 0
        WHEN 'ORANGE' THEN 10
        WHEN 'YELLOW' THEN 60
        WHEN 'GREEN' THEN 120
        ELSE 240
    END,
    e.arrival_at + (CASE e.priority_color
        WHEN 'RED' THEN interval '0 minutes'
        WHEN 'ORANGE' THEN interval '10 minutes'
        WHEN 'YELLOW' THEN interval '60 minutes'
        WHEN 'GREEN' THEN interval '120 minutes'
        ELSE interval '240 minutes'
    END),
    e.priority_color || '-' || LPAD((ROW_NUMBER() OVER(ORDER BY e.arrival_at))::text, 4, '0')
FROM hosp_encounters e
WHERE e.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND e.status = 'WAITING';

-- Criar algumas evoluções clínicas SOAP
INSERT INTO hosp_clinical_notes (
    tenant_id,
    encounter_id,
    patient_id,
    note_type,
    author_id,
    author_specialty,
    subjective,
    objective,
    assessment,
    plan,
    diagnoses,
    status,
    signed_at
)
SELECT 
    e.tenant_id,
    e.id,
    e.patient_id,
    'SOAP',
    '04eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
    'Clínica Médica',
    'Paciente refere ' || LOWER(e.chief_complaint) || ' há 2 dias, com piora progressiva. Nega febre, náuseas ou vômitos.',
    'REG, corado, hidratado, anictérico, acianótico. FC: 78bpm, FR: 18irpm, PA: 120x80mmHg, Tax: 36.5°C, SpO2: 98% AA. AR: MV+ bilateralmente, sem RA. ACV: RCR 2T BNF sem sopros. Abdome: plano, RHA+, indolor à palpação.',
    'Quadro clínico compatível com ' || e.chief_complaint || '. Aguardando resultados de exames complementares.',
    'Solicitar exames laboratoriais (hemograma, PCR, eletrólitos). Manter hidratação venosa. Analgesia se dor. Reavaliação em 4 horas.',
    '[{"cid10": "R10.4", "description": "Outras dores abdominais e as não especificadas", "type": "PRIMARY"}]'::jsonb,
    'SIGNED',
    NOW() - interval '2 hours'
FROM hosp_encounters e
WHERE e.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND e.status IN ('IN_PROGRESS', 'FINISHED')
LIMIT 10;

-- Criar prescrições para alguns atendimentos
INSERT INTO hosp_prescriptions (
    id,
    tenant_id,
    encounter_id,
    patient_id,
    prescription_type,
    prescriber_id,
    prescriber_council_type,
    prescriber_council_number,
    prescriber_council_state,
    status,
    prescription_number,
    diet_type,
    nursing_care,
    signed_at
)
SELECT 
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    e.patient_id,
    'HOSPITALAR',
    '04eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
    'CRM',
    '123456',
    'SP',
    'ACTIVE',
    'PRESC-' || LPAD((ROW_NUMBER() OVER())::text, 8, '0'),
    'LIVRE',
    ARRAY['Verificar sinais vitais de 4/4h', 'Manter decúbito elevado 30°', 'Comunicar alterações'],
    NOW()
FROM hosp_encounters e
WHERE e.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND e.status = 'IN_PROGRESS'
LIMIT 5;

-- Adicionar itens às prescrições
INSERT INTO hosp_prescription_items (
    tenant_id,
    prescription_id,
    medication_name,
    active_principle,
    dose,
    dose_unit,
    frequency,
    frequency_hours,
    administration_route,
    duration_value,
    duration_unit,
    instructions,
    display_order
)
SELECT 
    p.tenant_id,
    p.id,
    m.medication_name,
    m.active_principle,
    m.dose,
    m.dose_unit,
    m.frequency,
    m.frequency_hours,
    m.administration_route,
    m.duration_value,
    m.duration_unit,
    m.instructions,
    m.display_order
FROM hosp_prescriptions p
CROSS JOIN (VALUES
    ('Dipirona 500mg', 'Dipirona sódica', '1g', 'mg', '6/6h', 6, 'IV', 3, 'DIAS', 'Diluir em 100mL SF 0,9%', 1),
    ('Omeprazol 40mg', 'Omeprazol', '40mg', 'mg', '1x/dia', 24, 'IV', 5, 'DIAS', 'Em jejum', 2),
    ('Soro Fisiológico 0,9%', 'Cloreto de sódio', '1000mL', 'mL', '8/8h', 8, 'IV', 3, 'DIAS', 'Manter acesso venoso', 3),
    ('Ondansetrona 8mg', 'Ondansetrona', '8mg', 'mg', 'SOS', NULL, 'IV', NULL, NULL, 'Se náuseas ou vômitos', 4)
) m(medication_name, active_principle, dose, dose_unit, frequency, frequency_hours, administration_route, duration_value, duration_unit, instructions, display_order)
WHERE p.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- Criar solicitações de exames
INSERT INTO hosp_exam_requests (
    id,
    tenant_id,
    encounter_id,
    patient_id,
    requester_id,
    exam_type,
    priority,
    status,
    clinical_indication,
    request_number
)
SELECT 
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    e.patient_id,
    '04eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
    'LABORATORIO',
    CASE e.priority_color 
        WHEN 'RED' THEN 'EMERGENCY'
        WHEN 'ORANGE' THEN 'URGENT'
        ELSE 'ROUTINE'
    END,
    'REQUESTED',
    'Investigação de ' || e.chief_complaint,
    'REQ-' || LPAD((ROW_NUMBER() OVER())::text, 8, '0')
FROM hosp_encounters e
WHERE e.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND e.status IN ('IN_PROGRESS', 'WAITING')
LIMIT 10;

-- Adicionar itens às solicitações de exames
INSERT INTO hosp_exam_request_items (tenant_id, request_id, procedure_code, procedure_name, quantity)
SELECT 
    r.tenant_id,
    r.id,
    exm.code,
    exm.name,
    1
FROM hosp_exam_requests r
CROSS JOIN (VALUES
    ('0202020029', 'Hemograma completo'),
    ('0202010074', 'Dosagem de creatinina'),
    ('0202010082', 'Dosagem de uréia'),
    ('0202010010', 'Dosagem de glicose'),
    ('0202010295', 'Dosagem de sódio'),
    ('0202010287', 'Dosagem de potássio')
) exm(code, name)
WHERE r.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
