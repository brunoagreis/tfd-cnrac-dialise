-- ============================================================
-- NEXUS - Sistema Integrado de Gestão Municipal da Saúde
-- SEED: CATÁLOGOS E TERMINOLOGIAS
-- Dados de demonstração/validação
-- ============================================================

-- ============================================================
-- CID-10 - Capítulos (21 capítulos)
-- ============================================================
INSERT INTO cat_cid10_chapters (code, name, code_range) VALUES
('I', 'Algumas doenças infecciosas e parasitárias', 'A00-B99'),
('II', 'Neoplasias [tumores]', 'C00-D48'),
('III', 'Doenças do sangue e dos órgãos hematopoéticos e alguns transtornos imunitários', 'D50-D89'),
('IV', 'Doenças endócrinas, nutricionais e metabólicas', 'E00-E90'),
('V', 'Transtornos mentais e comportamentais', 'F00-F99'),
('VI', 'Doenças do sistema nervoso', 'G00-G99'),
('VII', 'Doenças do olho e anexos', 'H00-H59'),
('VIII', 'Doenças do ouvido e da apófise mastóide', 'H60-H95'),
('IX', 'Doenças do aparelho circulatório', 'I00-I99'),
('X', 'Doenças do aparelho respiratório', 'J00-J99'),
('XI', 'Doenças do aparelho digestivo', 'K00-K93'),
('XII', 'Doenças da pele e do tecido subcutâneo', 'L00-L99'),
('XIII', 'Doenças do sistema osteomuscular e do tecido conjuntivo', 'M00-M99'),
('XIV', 'Doenças do aparelho geniturinário', 'N00-N99'),
('XV', 'Gravidez, parto e puerpério', 'O00-O99'),
('XVI', 'Algumas afecções originadas no período perinatal', 'P00-P96'),
('XVII', 'Malformações congênitas, deformidades e anomalias cromossômicas', 'Q00-Q99'),
('XVIII', 'Sintomas, sinais e achados anormais de exames clínicos e de laboratório, não classificados em outra parte', 'R00-R99'),
('XIX', 'Lesões, envenenamento e algumas outras consequências de causas externas', 'S00-T98'),
('XX', 'Causas externas de morbidade e de mortalidade', 'V01-Y98'),
('XXI', 'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde', 'Z00-Z99');

-- CID-10 Grupos de exemplo (Capítulo I)
INSERT INTO cat_cid10_groups (chapter_id, code, name)
SELECT c.id, g.code, g.name
FROM cat_cid10_chapters c
CROSS JOIN (VALUES
    ('A00-A09', 'Doenças infecciosas intestinais'),
    ('A15-A19', 'Tuberculose'),
    ('A20-A28', 'Algumas doenças bacterianas zoonóticas'),
    ('A30-A49', 'Outras doenças bacterianas'),
    ('A50-A64', 'Infecções de transmissão predominantemente sexual'),
    ('B15-B19', 'Hepatite viral'),
    ('B20-B24', 'Doença pelo vírus da imunodeficiência humana [HIV]')
) g(code, name)
WHERE c.code = 'I';

-- CID-10 Categorias de exemplo
INSERT INTO cat_cid10_categories (group_id, code, name, is_notifiable) VALUES
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A00', 'Cólera', true),
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A01', 'Febres tifóide e paratifóide', true),
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A02', 'Outras infecções por Salmonella', false),
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A03', 'Shiguelose', false),
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A04', 'Outras infecções intestinais bacterianas', false),
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A05', 'Outras intoxicações alimentares bacterianas', false),
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A06', 'Amebíase', false),
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A07', 'Outras doenças intestinais por protozoários', false),
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A08', 'Infecções intestinais virais, outras e as não especificadas', false),
((SELECT id FROM cat_cid10_groups WHERE code = 'A00-A09'), 'A09', 'Diarréia e gastroenterite de origem infecciosa presumível', false),
((SELECT id FROM cat_cid10_groups WHERE code = 'A15-A19'), 'A15', 'Tuberculose respiratória, com confirmação bacteriológica e histológica', true),
((SELECT id FROM cat_cid10_groups WHERE code = 'A15-A19'), 'A16', 'Tuberculose das vias respiratórias, sem confirmação bacteriológica ou histológica', true),
((SELECT id FROM cat_cid10_groups WHERE code = 'B20-B24'), 'B20', 'Doença pelo vírus da imunodeficiência humana [HIV], resultando em doenças infecciosas e parasitárias', true),
((SELECT id FROM cat_cid10_groups WHERE code = 'B20-B24'), 'B24', 'Doença pelo vírus da imunodeficiência humana [HIV] não especificada', true);

-- CID-10 Subcategorias de exemplo
INSERT INTO cat_cid10_subcategories (category_id, code, name, is_notifiable)
SELECT c.id, s.code, s.name, s.is_notifiable
FROM cat_cid10_categories c
CROSS JOIN (VALUES
    ('A00', 'A00.0', 'Cólera devida a Vibrio cholerae 01, biótipo cholerae', true),
    ('A00', 'A00.1', 'Cólera devida a Vibrio cholerae 01, biótipo El Tor', true),
    ('A00', 'A00.9', 'Cólera não especificada', true),
    ('A01', 'A01.0', 'Febre tifóide', true),
    ('A01', 'A01.1', 'Febre paratifóide A', true),
    ('A01', 'A01.2', 'Febre paratifóide B', true),
    ('A01', 'A01.3', 'Febre paratifóide C', true),
    ('A01', 'A01.4', 'Febre paratifóide não especificada', true),
    ('A09', 'A09.0', 'Outras gastroenterites e colites de origem infecciosa', false),
    ('A09', 'A09.9', 'Gastroenterite e colite de origem não especificada', false)
) s(cat_code, code, name, is_notifiable)
WHERE c.code = s.cat_code;

-- Adicionar mais categorias CID-10 importantes (Capítulo IX - Circulatório)
INSERT INTO cat_cid10_groups (chapter_id, code, name)
SELECT c.id, g.code, g.name
FROM cat_cid10_chapters c
CROSS JOIN (VALUES
    ('I10-I15', 'Doenças hipertensivas'),
    ('I20-I25', 'Doenças isquêmicas do coração'),
    ('I30-I52', 'Outras formas de doença do coração'),
    ('I60-I69', 'Doenças cerebrovasculares')
) g(code, name)
WHERE c.code = 'IX';

INSERT INTO cat_cid10_categories (group_id, code, name)
SELECT g.id, c.code, c.name
FROM cat_cid10_groups g
CROSS JOIN (VALUES
    ('I10-I15', 'I10', 'Hipertensão essencial (primária)'),
    ('I10-I15', 'I11', 'Doença cardíaca hipertensiva'),
    ('I20-I25', 'I20', 'Angina pectoris'),
    ('I20-I25', 'I21', 'Infarto agudo do miocárdio'),
    ('I20-I25', 'I22', 'Infarto do miocárdio recorrente'),
    ('I20-I25', 'I25', 'Doença isquêmica crônica do coração'),
    ('I60-I69', 'I60', 'Hemorragia subaracnóide'),
    ('I60-I69', 'I61', 'Hemorragia intracerebral'),
    ('I60-I69', 'I63', 'Infarto cerebral'),
    ('I60-I69', 'I64', 'Acidente vascular cerebral, não especificado como hemorrágico ou isquêmico')
) c(grp_code, code, name)
WHERE g.code = c.grp_code;

-- ============================================================
-- CIAP-2 - Capítulos
-- ============================================================
INSERT INTO cat_ciap2_chapters (code, name, description) VALUES
('A', 'Geral e não especificado', 'Problemas gerais e não específicos'),
('B', 'Sangue, órgãos hematopoéticos e linfáticos (baço, medula óssea)', NULL),
('D', 'Aparelho digestivo', NULL),
('F', 'Olho', NULL),
('H', 'Ouvido', NULL),
('K', 'Aparelho circulatório', NULL),
('L', 'Sistema musculoesquelético', NULL),
('N', 'Sistema neurológico', NULL),
('P', 'Psicológico', NULL),
('R', 'Aparelho respiratório', NULL),
('S', 'Pele', NULL),
('T', 'Endócrino, metabólico e nutricional', NULL),
('U', 'Aparelho urinário', NULL),
('W', 'Gravidez, parto, planejamento familiar', NULL),
('X', 'Aparelho genital feminino (incluindo mama)', NULL),
('Y', 'Aparelho genital masculino', NULL),
('Z', 'Problemas sociais', NULL);

-- CIAP-2 Códigos de exemplo
INSERT INTO cat_ciap2_codes (chapter_id, code, name, component_type)
SELECT c.id, cd.code, cd.name, cd.component
FROM cat_ciap2_chapters c
CROSS JOIN (VALUES
    ('A', 'A01', 'Dor generalizada/múltipla', 'Sintomas/Queixas'),
    ('A', 'A02', 'Calafrios', 'Sintomas/Queixas'),
    ('A', 'A03', 'Febre', 'Sintomas/Queixas'),
    ('A', 'A04', 'Debilidade/cansaço geral/fadiga', 'Sintomas/Queixas'),
    ('K', 'K85', 'Pressão arterial elevada', 'Sintomas/Queixas'),
    ('K', 'K86', 'Hipertensão sem complicações', 'Diagnósticos'),
    ('K', 'K87', 'Hipertensão com complicações', 'Diagnósticos'),
    ('K', 'K74', 'Doença isquêmica do coração com angina', 'Diagnósticos'),
    ('K', 'K75', 'Infarto agudo do miocárdio', 'Diagnósticos'),
    ('K', 'K76', 'Doença isquêmica do coração sem angina', 'Diagnósticos'),
    ('T', 'T89', 'Diabetes insulino-dependente', 'Diagnósticos'),
    ('T', 'T90', 'Diabetes não insulino-dependente', 'Diagnósticos'),
    ('R', 'R74', 'Infecção aguda do aparelho respiratório superior', 'Diagnósticos'),
    ('R', 'R78', 'Bronquite aguda/bronquiolite', 'Diagnósticos'),
    ('R', 'R81', 'Pneumonia', 'Diagnósticos')
) cd(chapter, code, name, component)
WHERE c.code = cd.chapter;

-- ============================================================
-- SIGTAP - Grupos e Procedimentos
-- ============================================================
INSERT INTO cat_sigtap_groups (code, name) VALUES
('01', 'Ações de promoção e prevenção em saúde'),
('02', 'Procedimentos com finalidade diagnóstica'),
('03', 'Procedimentos clínicos'),
('04', 'Procedimentos cirúrgicos'),
('05', 'Transplantes de órgãos, tecidos e células'),
('06', 'Medicamentos'),
('07', 'Órteses, próteses e materiais especiais'),
('08', 'Ações complementares da atenção à saúde');

INSERT INTO cat_sigtap_subgroups (group_id, code, name)
SELECT g.id, sg.code, sg.name
FROM cat_sigtap_groups g
CROSS JOIN (VALUES
    ('02', '0201', 'Coleta de material'),
    ('02', '0202', 'Diagnóstico em laboratório clínico'),
    ('02', '0203', 'Diagnóstico por anatomia patológica e citopatologia'),
    ('02', '0204', 'Diagnóstico por radiologia'),
    ('02', '0205', 'Diagnóstico por ultrasonografia'),
    ('02', '0206', 'Diagnóstico por tomografia'),
    ('02', '0207', 'Diagnóstico por ressonância magnética'),
    ('02', '0208', 'Diagnóstico por medicina nuclear in vivo'),
    ('03', '0301', 'Consultas / Atendimentos / Acompanhamentos'),
    ('03', '0302', 'Fisioterapia'),
    ('03', '0303', 'Tratamentos clínicos (outras especialidades)'),
    ('04', '0401', 'Pequenas cirurgias e cirurgias de pele, tecido subcutâneo e mucosa'),
    ('04', '0402', 'Cirurgia de glândulas endócrinas'),
    ('04', '0403', 'Cirurgia do sistema nervoso central e periférico'),
    ('04', '0404', 'Cirurgia das vias aéreas superiores, da face, da cabeça e do pescoço'),
    ('04', '0405', 'Cirurgia do aparelho da visão'),
    ('04', '0406', 'Cirurgia do aparelho circulatório'),
    ('04', '0407', 'Cirurgia do aparelho digestivo, órgãos anexos e parede abdominal'),
    ('04', '0408', 'Cirurgia do sistema osteomuscular'),
    ('04', '0409', 'Cirurgia do aparelho geniturinário'),
    ('04', '0410', 'Cirurgia de mama'),
    ('04', '0411', 'Cirurgia obstétrica'),
    ('04', '0412', 'Cirurgia torácica'),
    ('04', '0413', 'Cirurgia reparadora'),
    ('04', '0414', 'Bucomaxilofacial')
) sg(grp_code, code, name)
WHERE g.code = sg.grp_code;

-- SIGTAP Forms
INSERT INTO cat_sigtap_forms (subgroup_id, code, name)
SELECT sg.id, f.code, f.name
FROM cat_sigtap_subgroups sg
CROSS JOIN (VALUES
    ('0202', '020201', 'Exames bioquímicos'),
    ('0202', '020202', 'Exames hematológicos e hemostasia'),
    ('0202', '020203', 'Exames sorológicos e imunológicos'),
    ('0202', '020204', 'Exames microbiológicos'),
    ('0202', '020205', 'Exames de urina'),
    ('0204', '020401', 'Radiologia convencional'),
    ('0204', '020402', 'Radiologia intervencionista'),
    ('0205', '020501', 'Ultrassonografia do sistema circulatório'),
    ('0205', '020502', 'Ultrassonografia do abdome e pelve'),
    ('0205', '020503', 'Ultrassonografia em ginecologia e obstetrícia'),
    ('0206', '020601', 'Tomografia computadorizada'),
    ('0207', '020701', 'Ressonância magnética'),
    ('0301', '030101', 'Consulta médica'),
    ('0301', '030102', 'Consulta de profissionais de nível superior'),
    ('0301', '030103', 'Atendimento de urgência e emergência')
) f(sg_code, code, name)
WHERE sg.code = f.sg_code;

-- SIGTAP Procedimentos de exemplo
INSERT INTO cat_sigtap_procedures (form_id, code, name, complexity, value_ambulatory, cbo_required, instrument)
SELECT f.id, p.code, p.name, p.complexity, p.value, p.cbo, p.instrument
FROM cat_sigtap_forms f
CROSS JOIN (VALUES
    ('020201', '0202010010', 'Dosagem de glicose', 'AB', 1.85, ARRAY['223505'], 'BPA-I'),
    ('020201', '0202010015', 'Dosagem de hemoglobina glicada', 'AB', 7.86, ARRAY['223505'], 'BPA-I'),
    ('020201', '0202010031', 'Dosagem de colesterol total', 'AB', 1.85, ARRAY['223505'], 'BPA-I'),
    ('020201', '0202010040', 'Dosagem de colesterol HDL', 'AB', 3.51, ARRAY['223505'], 'BPA-I'),
    ('020201', '0202010058', 'Dosagem de colesterol LDL', 'AB', 3.51, ARRAY['223505'], 'BPA-I'),
    ('020201', '0202010066', 'Dosagem de triglicerídeos', 'AB', 3.51, ARRAY['223505'], 'BPA-I'),
    ('020201', '0202010074', 'Dosagem de creatinina', 'AB', 1.85, ARRAY['223505'], 'BPA-I'),
    ('020201', '0202010082', 'Dosagem de uréia', 'AB', 1.85, ARRAY['223505'], 'BPA-I'),
    ('020201', '0202010295', 'Dosagem de sódio', 'AB', 1.85, ARRAY['223505'], 'BPA-I'),
    ('020201', '0202010287', 'Dosagem de potássio', 'AB', 1.85, ARRAY['223505'], 'BPA-I'),
    ('020202', '0202020029', 'Hemograma completo', 'AB', 4.11, ARRAY['223505'], 'BPA-I'),
    ('020202', '0202020380', 'Tempo de protrombina (TAP)', 'AB', 2.73, ARRAY['223505'], 'BPA-I'),
    ('020202', '0202020398', 'Tempo de tromboplastina parcial ativada (TTPA)', 'AB', 5.77, ARRAY['223505'], 'BPA-I'),
    ('020205', '0205020020', 'Urina tipo I com sedimentoscopia', 'AB', 3.70, ARRAY['223505'], 'BPA-I'),
    ('020401', '0204010012', 'Radiografia de tórax (PA)', 'AB', 5.95, ARRAY['225320'], 'BPA-I'),
    ('020401', '0204010039', 'Radiografia de tórax (PA e perfil)', 'AB', 8.95, ARRAY['225320'], 'BPA-I'),
    ('020502', '0205020097', 'Ultrassonografia de abdome total', 'MC', 37.95, ARRAY['225150'], 'BPA-I'),
    ('020601', '0206010010', 'Tomografia computadorizada de crânio', 'MC', 98.00, ARRAY['225150'], 'BPA-I'),
    ('020601', '0206010028', 'Tomografia computadorizada de tórax', 'MC', 136.00, ARRAY['225150'], 'BPA-I'),
    ('020701', '0207010013', 'Ressonância magnética de crânio', 'AC', 268.75, ARRAY['225150'], 'BPA-I'),
    ('030101', '0301010064', 'Consulta médica em atenção básica', 'AB', 10.00, ARRAY['225125','225130','225135','225140','225142'], 'BPA-C'),
    ('030101', '0301010072', 'Consulta médica em atenção especializada', 'MC', 10.00, ARRAY['225125','225130','225135','225140','225142'], 'BPA-C')
) p(form_code, code, name, complexity, value, cbo, instrument)
WHERE f.code = p.form_code;

-- ============================================================
-- CBO - Ocupações da Saúde
-- ============================================================
INSERT INTO cat_cbo_families (code, name) VALUES
('2231', 'Médicos'),
('2232', 'Cirurgiões-dentistas'),
('2234', 'Farmacêuticos'),
('2235', 'Enfermeiros e afins'),
('2236', 'Fisioterapeutas'),
('2237', 'Nutricionistas'),
('2238', 'Fonoaudiólogos'),
('2239', 'Terapeutas ocupacionais'),
('2241', 'Profissionais da educação física'),
('2251', 'Médicos veterinários'),
('2253', 'Profissionais de biologia e ciências biológicas'),
('3222', 'Técnicos e auxiliares de enfermagem'),
('3224', 'Técnicos em radiologia'),
('3225', 'Técnicos em laboratório');

INSERT INTO cat_cbo_occupations (family_id, code, name, is_healthcare, council_type)
SELECT f.id, o.code, o.name, true, o.council
FROM cat_cbo_families f
CROSS JOIN (VALUES
    ('2231', '225125', 'Médico clínico', 'CRM'),
    ('2231', '225130', 'Médico de família e comunidade', 'CRM'),
    ('2231', '225135', 'Médico geriatra', 'CRM'),
    ('2231', '225140', 'Médico pediatra', 'CRM'),
    ('2231', '225142', 'Médico ginecologista e obstetra', 'CRM'),
    ('2231', '225145', 'Médico cardiologista', 'CRM'),
    ('2231', '225150', 'Médico radiologista', 'CRM'),
    ('2231', '225155', 'Médico neurologista', 'CRM'),
    ('2231', '225160', 'Médico ortopedista e traumatologista', 'CRM'),
    ('2231', '225165', 'Médico psiquiatra', 'CRM'),
    ('2231', '225170', 'Médico cirurgião geral', 'CRM'),
    ('2231', '225185', 'Médico anestesiologista', 'CRM'),
    ('2231', '225195', 'Médico intensivista', 'CRM'),
    ('2231', '225320', 'Médico em medicina nuclear', 'CRM'),
    ('2235', '223505', 'Enfermeiro', 'COREN'),
    ('2235', '223510', 'Enfermeiro auditor', 'COREN'),
    ('2235', '223515', 'Enfermeiro de bordo', 'COREN'),
    ('2235', '223520', 'Enfermeiro de centro cirúrgico', 'COREN'),
    ('2235', '223525', 'Enfermeiro de terapia intensiva', 'COREN'),
    ('2235', '223530', 'Enfermeiro do trabalho', 'COREN'),
    ('2235', '223535', 'Enfermeiro nefrologista', 'COREN'),
    ('2235', '223540', 'Enfermeiro neonatologista', 'COREN'),
    ('2235', '223545', 'Enfermeiro obstétrico', 'COREN'),
    ('2234', '223405', 'Farmacêutico', 'CRF'),
    ('2234', '223415', 'Farmacêutico hospitalar', 'CRF'),
    ('2234', '223420', 'Farmacêutico bioquímico', 'CRF'),
    ('2236', '223605', 'Fisioterapeuta geral', 'CREFITO'),
    ('2237', '223710', 'Nutricionista', 'CRN'),
    ('3222', '322205', 'Técnico de enfermagem', 'COREN'),
    ('3222', '322210', 'Técnico de enfermagem de terapia intensiva', 'COREN'),
    ('3222', '322215', 'Técnico de enfermagem do trabalho', 'COREN'),
    ('3222', '322220', 'Técnico de enfermagem psiquiátrica', 'COREN'),
    ('3222', '322230', 'Auxiliar de enfermagem', 'COREN'),
    ('3224', '324105', 'Técnico em radiologia', 'CRTR'),
    ('3225', '324205', 'Técnico em laboratório clínico', NULL)
) o(fam_code, code, name, council)
WHERE f.code = o.fam_code;

-- ============================================================
-- MEDICAMENTOS - Grupos e Itens
-- Corrigida string não terminada no Ciprofloxacino
-- ============================================================
INSERT INTO cat_medications_groups (code, name, atc_code) VALUES
('ANTIBIO', 'Antibióticos', 'J01'),
('ANTIHIP', 'Anti-hipertensivos', 'C02'),
('ANTIDIAB', 'Antidiabéticos', 'A10'),
('ANALGES', 'Analgésicos', 'N02'),
('AINES', 'Anti-inflamatórios não esteroidais', 'M01'),
('ANTIDEP', 'Antidepressivos', 'N06A'),
('ANTIPSIC', 'Antipsicóticos', 'N05A'),
('CORTICO', 'Corticosteroides', 'H02'),
('ANTICOAG', 'Anticoagulantes', 'B01'),
('VACINAS', 'Vacinas', 'J07');

INSERT INTO cat_medications (group_id, code, name, active_principle, concentration, pharmaceutical_form, administration_routes, is_controlled, is_rename)
SELECT g.id, m.code, m.name, m.principle, m.concentration, m.form, m.routes, m.controlled, true
FROM cat_medications_groups g
CROSS JOIN (VALUES
    ('ANTIBIO', 'MED001', 'Amoxicilina 500mg', 'Amoxicilina', '500mg', 'Cápsula', ARRAY['VO'], false),
    ('ANTIBIO', 'MED002', 'Amoxicilina + Clavulanato 500/125mg', 'Amoxicilina + Ácido Clavulânico', '500mg + 125mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIBIO', 'MED003', 'Azitromicina 500mg', 'Azitromicina', '500mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIBIO', 'MED004', 'Cefalexina 500mg', 'Cefalexina', '500mg', 'Cápsula', ARRAY['VO'], false),
    ('ANTIBIO', 'MED005', 'Ciprofloxacino 500mg', 'Ciprofloxacino', '500mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIBIO', 'MED006', 'Metronidazol 400mg', 'Metronidazol', '400mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIBIO', 'MED007', 'Sulfametoxazol + Trimetoprima 400/80mg', 'Sulfametoxazol + Trimetoprima', '400mg + 80mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIHIP', 'MED010', 'Losartana 50mg', 'Losartana potássica', '50mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIHIP', 'MED011', 'Enalapril 10mg', 'Maleato de enalapril', '10mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIHIP', 'MED012', 'Captopril 25mg', 'Captopril', '25mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIHIP', 'MED013', 'Anlodipino 5mg', 'Besilato de anlodipino', '5mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIHIP', 'MED014', 'Atenolol 50mg', 'Atenolol', '50mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIHIP', 'MED015', 'Hidroclorotiazida 25mg', 'Hidroclorotiazida', '25mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIDIAB', 'MED020', 'Metformina 850mg', 'Cloridrato de metformina', '850mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIDIAB', 'MED021', 'Glibenclamida 5mg', 'Glibenclamida', '5mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIDIAB', 'MED022', 'Insulina NPH 100UI/mL', 'Insulina humana NPH', '100UI/mL', 'Suspensão injetável', ARRAY['SC'], true),
    ('ANTIDIAB', 'MED023', 'Insulina Regular 100UI/mL', 'Insulina humana regular', '100UI/mL', 'Solução injetável', ARRAY['SC', 'IV'], true),
    ('ANALGES', 'MED030', 'Dipirona 500mg', 'Dipirona sódica', '500mg', 'Comprimido', ARRAY['VO'], false),
    ('ANALGES', 'MED031', 'Paracetamol 500mg', 'Paracetamol', '500mg', 'Comprimido', ARRAY['VO'], false),
    ('ANALGES', 'MED032', 'Paracetamol 750mg', 'Paracetamol', '750mg', 'Comprimido', ARRAY['VO'], false),
    ('ANALGES', 'MED033', 'Tramadol 50mg', 'Cloridrato de tramadol', '50mg', 'Cápsula', ARRAY['VO'], true),
    ('ANALGES', 'MED034', 'Morfina 10mg', 'Sulfato de morfina', '10mg', 'Comprimido', ARRAY['VO'], true),
    ('AINES', 'MED040', 'Ibuprofeno 600mg', 'Ibuprofeno', '600mg', 'Comprimido', ARRAY['VO'], false),
    ('AINES', 'MED041', 'Diclofenaco 50mg', 'Diclofenaco sódico', '50mg', 'Comprimido', ARRAY['VO'], false),
    ('AINES', 'MED042', 'Nimesulida 100mg', 'Nimesulida', '100mg', 'Comprimido', ARRAY['VO'], false),
    ('ANTIDEP', 'MED050', 'Fluoxetina 20mg', 'Cloridrato de fluoxetina', '20mg', 'Cápsula', ARRAY['VO'], true),
    ('ANTIDEP', 'MED051', 'Sertralina 50mg', 'Cloridrato de sertralina', '50mg', 'Comprimido', ARRAY['VO'], true),
    ('ANTIDEP', 'MED052', 'Amitriptilina 25mg', 'Cloridrato de amitriptilina', '25mg', 'Comprimido', ARRAY['VO'], true),
    ('CORTICO', 'MED060', 'Prednisona 5mg', 'Prednisona', '5mg', 'Comprimido', ARRAY['VO'], false),
    ('CORTICO', 'MED061', 'Prednisona 20mg', 'Prednisona', '20mg', 'Comprimido', ARRAY['VO'], false),
    ('CORTICO', 'MED062', 'Dexametasona 4mg', 'Fosfato dissódico de dexametasona', '4mg/mL', 'Solução injetável', ARRAY['IV', 'IM'], false),
    ('ANTICOAG', 'MED070', 'Varfarina 5mg', 'Varfarina sódica', '5mg', 'Comprimido', ARRAY['VO'], true),
    ('ANTICOAG', 'MED071', 'Heparina 5000UI/mL', 'Heparina sódica', '5000UI/mL', 'Solução injetável', ARRAY['IV', 'SC'], true),
    ('ANTICOAG', 'MED072', 'Enoxaparina 40mg', 'Enoxaparina sódica', '40mg/0,4mL', 'Solução injetável', ARRAY['SC'], true)
) m(grp_code, code, name, principle, concentration, form, routes, controlled)
WHERE g.code = m.grp_code;

-- ============================================================
-- NANDA - Diagnósticos de Enfermagem
-- ============================================================
INSERT INTO cat_nanda_domains (code, name) VALUES
('01', 'Promoção da saúde'),
('02', 'Nutrição'),
('03', 'Eliminação e troca'),
('04', 'Atividade/repouso'),
('05', 'Percepção/cognição'),
('06', 'Autopercepção'),
('07', 'Papéis e relacionamentos'),
('08', 'Sexualidade'),
('09', 'Enfrentamento/tolerância ao estresse'),
('10', 'Princípios de vida'),
('11', 'Segurança/proteção'),
('12', 'Conforto'),
('13', 'Crescimento/desenvolvimento');

INSERT INTO cat_nanda_classes (domain_id, code, name)
SELECT d.id, c.code, c.name
FROM cat_nanda_domains d
CROSS JOIN (VALUES
    ('04', '01', 'Sono/repouso'),
    ('04', '02', 'Atividade/exercício'),
    ('04', '03', 'Equilíbrio de energia'),
    ('04', '04', 'Respostas cardiovasculares/pulmonares'),
    ('04', '05', 'Autocuidado'),
    ('11', '01', 'Infecção'),
    ('11', '02', 'Lesão física'),
    ('11', '03', 'Violência'),
    ('11', '04', 'Riscos ambientais'),
    ('11', '05', 'Processos defensivos'),
    ('11', '06', 'Termorregulação'),
    ('12', '01', 'Conforto físico'),
    ('12', '02', 'Conforto ambiental'),
    ('12', '03', 'Conforto social')
) c(dom_code, code, name)
WHERE d.code = c.dom_code;

INSERT INTO cat_nanda_diagnoses (class_id, code, name, definition, risk_factors, related_factors)
SELECT c.id, diag.code, diag.name, diag.definition, diag.risk, diag.related
FROM cat_nanda_classes c
CROSS JOIN (VALUES
    ('01', '00095', 'Insônia', 'Incapacidade de iniciar ou manter o sono', ARRAY['Ansiedade','Depressão','Dor'], ARRAY['Estresse','Mudança de ambiente']),
    ('01', '00198', 'Padrão de sono perturbado', 'Interrupções na quantidade e qualidade do sono limitadas no tempo', ARRAY['Barulho','Iluminação'], ARRAY['Interrupções para procedimentos']),
    ('02', '00085', 'Mobilidade física prejudicada', 'Limitação no movimento físico independente', ARRAY['Dor','Fraqueza muscular'], ARRAY['Lesão musculoesquelética','Sedentarismo']),
    ('05', '00088', 'Deambulação prejudicada', 'Limitação do movimento independente a pé', ARRAY['Dor','Equilíbrio prejudicado'], ARRAY['Força muscular insuficiente']),
    ('01', '00046', 'Integridade da pele prejudicada', 'Epiderme e/ou derme alteradas', ARRAY['Imobilidade','Umidade'], ARRAY['Pressão','Cisalhamento']),
    ('02', '00044', 'Integridade tissular prejudicada', 'Dano às membranas mucosas, córnea, pele ou tecidos subcutâneos', ARRAY['Circulação alterada'], ARRAY['Fatores mecânicos','Radiação']),
    ('01', '00004', 'Risco de infecção', 'Suscetibilidade aumentada a organismos patogênicos', ARRAY['Procedimentos invasivos','Imunossupressão'], NULL),
    ('01', '00132', 'Dor aguda', 'Experiência sensorial e emocional desagradável associada a lesão tissular real ou potencial', NULL, ARRAY['Agentes lesivos biológicos','Agentes lesivos físicos']),
    ('01', '00133', 'Dor crônica', 'Experiência sensorial e emocional desagradável por mais de 3 meses', NULL, ARRAY['Condição musculoesquelética crônica','Compressão de nervo'])
) diag(class_code, code, name, definition, risk, related)
WHERE c.code = diag.class_code;

-- ============================================================
-- Unidades de Medida
-- ============================================================
INSERT INTO cat_units_measure (code, name, symbol, category) VALUES
('UN', 'Unidade', 'un', 'QUANTIDADE'),
('AMP', 'Ampola', 'amp', 'QUANTIDADE'),
('COMP', 'Comprimido', 'comp', 'QUANTIDADE'),
('CAP', 'Cápsula', 'cap', 'QUANTIDADE'),
('FR', 'Frasco', 'fr', 'QUANTIDADE'),
('CX', 'Caixa', 'cx', 'QUANTIDADE'),
('PC', 'Pacote', 'pct', 'QUANTIDADE'),
('RL', 'Rolo', 'rl', 'QUANTIDADE'),
('ML', 'Mililitro', 'mL', 'VOLUME'),
('L', 'Litro', 'L', 'VOLUME'),
('MG', 'Miligrama', 'mg', 'MASSA'),
('G', 'Grama', 'g', 'MASSA'),
('KG', 'Quilograma', 'kg', 'MASSA'),
('UI', 'Unidade Internacional', 'UI', 'CONCENTRACAO'),
('MCG', 'Micrograma', 'mcg', 'MASSA'),
('CM', 'Centímetro', 'cm', 'COMPRIMENTO'),
('M', 'Metro', 'm', 'COMPRIMENTO');

-- ============================================================
-- Escala Manchester (Classificação de Risco)
-- ============================================================
INSERT INTO cat_manchester_colors (color, name, max_wait_minutes, description) VALUES
('RED', 'Emergência', 0, 'Atendimento imediato - Risco de morte'),
('ORANGE', 'Muito Urgente', 10, 'Atendimento em até 10 minutos'),
('YELLOW', 'Urgente', 60, 'Atendimento em até 60 minutos'),
('GREEN', 'Pouco Urgente', 120, 'Atendimento em até 120 minutos'),
('BLUE', 'Não Urgente', 240, 'Atendimento em até 240 minutos');

INSERT INTO cat_manchester_flowcharts (code, name, description) VALUES
('DOR_ABD', 'Dor Abdominal', 'Fluxograma para classificação de dor abdominal'),
('DOR_TOR', 'Dor Torácica', 'Fluxograma para classificação de dor torácica'),
('DISPNEIA', 'Dificuldade Respiratória', 'Fluxograma para dispneia'),
('FEBRE', 'Febre', 'Fluxograma para estados febris'),
('CEFALEIA', 'Cefaleia', 'Fluxograma para dor de cabeça'),
('TRAUMA', 'Trauma', 'Fluxograma para trauma geral'),
('ADULTO_MAL', 'Adulto com Mal-estar', 'Fluxograma geral adulto indisposto'),
('CRIANCA', 'Criança Indisposta', 'Fluxograma pediátrico geral');

INSERT INTO cat_manchester_discriminators (flowchart_id, color, discriminator, description, priority_order)
SELECT f.id, d.color, d.discriminator, d.description, d.priority
FROM cat_manchester_flowcharts f
CROSS JOIN (VALUES
    ('DOR_TOR', 'RED', 'Dor torácica cardíaca', 'Dor típica de síndrome coronariana', 1),
    ('DOR_TOR', 'RED', 'Comprometimento da via aérea', 'Obstrução de via aérea', 2),
    ('DOR_TOR', 'ORANGE', 'Dor pleurítica', 'Dor ventilatório-dependente', 3),
    ('DOR_TOR', 'ORANGE', 'Pulso anormal', 'Arritmia detectável', 4),
    ('DOR_TOR', 'YELLOW', 'Dor moderada', 'Dor torácica não cardíaca moderada', 5),
    ('DOR_TOR', 'GREEN', 'Dor leve recente', 'Dor torácica leve há menos de 7 dias', 6),
    ('DOR_TOR', 'BLUE', 'Dor leve crônica', 'Dor torácica leve há mais de 7 dias', 7),
    ('FEBRE', 'RED', 'Choque', 'Sinais de choque séptico', 1),
    ('FEBRE', 'ORANGE', 'Febre alta (≥40°C)', 'Temperatura axilar ≥40°C', 2),
    ('FEBRE', 'ORANGE', 'Rigidez de nuca', 'Suspeita de meningite', 3),
    ('FEBRE', 'YELLOW', 'Febre moderada', 'Temperatura entre 38,5 e 39,9°C', 4),
    ('FEBRE', 'GREEN', 'Febre baixa', 'Temperatura entre 37,5 e 38,4°C', 5),
    ('FEBRE', 'BLUE', 'Afebril com queixa de febre', 'Temperatura normal no momento', 6)
) d(flowchart_code, color, discriminator, description, priority)
WHERE f.code = d.flowchart_code;

-- ============================================================
-- FIM DO SEED DE CATÁLOGOS
-- ============================================================
