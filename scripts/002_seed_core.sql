-- ============================================================
-- NEXUS - Sistema Integrado de Gestão Municipal da Saúde
-- SEED DATA - Dados Fictícios Obrigatórios
-- ============================================================

-- ============================================================
-- 1. TENANT DE DEMONSTRAÇÃO
-- ============================================================
INSERT INTO core_tenants (id, name, slug, city, state, ibge_code, is_active)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'SMS EXEMPLO - CAPITAL',
    'sms-exemplo-capital',
    'Capital',
    'UF',
    '1234567',
    true
);

-- ============================================================
-- 2. FEATURE FLAGS - Habilitar todos os módulos para demo
-- ============================================================
INSERT INTO feature_flags (tenant_id, module_code, is_enabled, enabled_at)
SELECT 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    m.module_code,
    true,
    NOW()
FROM (VALUES
    ('CORE'),
    ('MPI'),
    ('HOSP'),
    ('LAB'),
    ('IMAG_HOSP'),
    ('IMAG_MUN'),
    ('REG'),
    ('TFD'),
    ('JUD'),
    ('LOG'),
    ('FARM'),
    ('COMPRAS'),
    ('CONTRATOS_SUS'),
    ('CAP_INST'),
    ('ENG_CLIN'),
    ('FAT'),
    ('AUD_PREVIA'),
    ('OUVIDORIA'),
    ('SEG_PAC'),
    ('GOV'),
    ('BI'),
    ('NEXUS_CIDADAO'),
    ('RH_SAUDE'),
    ('PATRIMONIO_SAUDE'),
    ('CONVENIOS_SAUDE'),
    ('GED_SAUDE')
) AS m(module_code);

-- ============================================================
-- 3. UNIDADES DE SAÚDE
-- ============================================================
INSERT INTO core_units (id, tenant_id, name, unit_type, cnes, address, city, state, is_active)
VALUES
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Hospital Municipal Central', 'HOSP', '1234567', 'Av. Central, 1000', 'Capital', 'UF', true),
    ('b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Laboratório Municipal', 'LAB', '1234568', 'Rua das Análises, 200', 'Capital', 'UF', true),
    ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Centro de Imagens Municipal', 'IMAG', '1234569', 'Rua dos Exames, 300', 'Capital', 'UF', true),
    ('b4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Farmácia Central', 'PHARM', '1234570', 'Av. Medicamentos, 400', 'Capital', 'UF', true),
    ('b5eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Almoxarifado Central', 'ALMOX', '1234571', 'Rua dos Insumos, 500', 'Capital', 'UF', true),
    ('b6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'UBS Centro', 'UBS', '1234572', 'Rua da Saúde, 100', 'Capital', 'UF', true),
    ('b7eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'UPA Norte', 'UPA', '1234573', 'Av. Norte, 2000', 'Capital', 'UF', true),
    ('b8eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Central de Regulação', 'REG', '1234574', 'Rua da Regulação, 50', 'Capital', 'UF', true),
    ('b9eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Secretaria Municipal de Saúde', 'ADMIN', '1234575', 'Praça Central, 1', 'Capital', 'UF', true);

-- ============================================================
-- 4. SETORES DO HOSPITAL
-- ============================================================
INSERT INTO core_sectors (id, tenant_id, unit_id, name, sector_type, capacity)
VALUES
    ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Emergência', 'EMERGENCIA', 50),
    ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'UTI Adulto', 'UTI', 20),
    ('c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'UTI Pediátrica', 'UTI_PED', 10),
    ('c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Centro Cirúrgico', 'CC', 8),
    ('c5eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Enfermaria Clínica', 'ENFERMARIA', 60),
    ('c6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Enfermaria Cirúrgica', 'ENFERMARIA', 40),
    ('c7eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Maternidade', 'MATERNIDADE', 30),
    ('c8eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Farmácia Hospitalar', 'FARMACIA', null),
    ('c9eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CME', 'CME', null),
    ('ca0ebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Recepção', 'RECEPCAO', null);

-- ============================================================
-- 5. PERFIS RBAC (Roles do Sistema)
-- ============================================================
INSERT INTO rbac_roles (id, tenant_id, name, display_name, description, scope, is_system)
VALUES
    -- Perfis globais (sem tenant)
    ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, 'SYSTEM_ADMIN', 'Administrador do Sistema', 'Acesso total ao sistema', 'global', true),
    
    -- Perfis por tenant
    ('d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ADMIN_MUNICIPAL', 'Administrador Municipal', 'Administrador da SMS', 'global', true),
    ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'GESTOR_SMS', 'Gestor SMS', 'Gestor da Secretaria de Saúde', 'global', true),
    ('d4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'REGULADOR', 'Regulador', 'Profissional de regulação', 'unit', true),
    ('d5eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'UNIDADE_HOSP_ADMIN', 'Admin Hospitalar', 'Administrador de unidade hospitalar', 'unit', true),
    ('d6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'MEDICO', 'Médico', 'Profissional médico', 'unit', true),
    ('d7eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ENFERMEIRO', 'Enfermeiro', 'Profissional de enfermagem', 'unit', true),
    ('d8eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'TECNICO_ENF', 'Técnico de Enfermagem', 'Técnico de enfermagem', 'sector', true),
    ('d9eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'LAB_BIOQUIMICO', 'Bioquímico', 'Profissional de laboratório', 'unit', true),
    ('da0ebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'IMAGEM_RADIOLOGISTA', 'Radiologista', 'Médico radiologista', 'unit', true),
    ('db0ebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'IMAGEM_TECNICO', 'Técnico de Radiologia', 'Técnico de radiologia', 'unit', true),
    ('dc0ebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'FARMACIA_ADMIN', 'Admin Farmácia', 'Administrador de farmácia', 'unit', true),
    ('dd0ebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'FARMACEUTICO', 'Farmacêutico', 'Profissional farmacêutico', 'unit', true),
    ('de0ebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ALMOXARIFADO', 'Almoxarifado', 'Profissional de almoxarifado', 'unit', true),
    ('df0ebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'COMPRAS', 'Compras', 'Profissional de compras', 'global', true),
    ('e00ebc99-9c0b-4ef8-bb6d-6bb9bd380a26', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'FATURAMENTO', 'Faturamento', 'Profissional de faturamento', 'unit', true),
    ('e10ebc99-9c0b-4ef8-bb6d-6bb9bd380a27', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'OUVIDORIA', 'Ouvidoria', 'Profissional de ouvidoria', 'global', true),
    ('e20ebc99-9c0b-4ef8-bb6d-6bb9bd380a28', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'RECEPCAO', 'Recepção', 'Recepcionista', 'sector', true),
    ('e30ebc99-9c0b-4ef8-bb6d-6bb9bd380a29', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CIDADAO', 'Cidadão', 'Acesso ao portal do cidadão', 'global', true);

-- ============================================================
-- 6. PERMISSÕES DO CORE
-- ============================================================
INSERT INTO rbac_permissions (id, module_code, resource, action, description, is_sensitive)
VALUES
    -- CORE - Tenants
    ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CORE', 'tenants', 'create', 'Criar tenant', false),
    ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'CORE', 'tenants', 'read', 'Visualizar tenant', false),
    ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'CORE', 'tenants', 'update', 'Editar tenant', false),
    ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'CORE', 'tenants', 'delete', 'Excluir tenant', false),
    
    -- CORE - Units
    ('e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CORE', 'units', 'create', 'Criar unidade', false),
    ('e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'CORE', 'units', 'read', 'Visualizar unidade', false),
    ('e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'CORE', 'units', 'update', 'Editar unidade', false),
    ('e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'CORE', 'units', 'delete', 'Excluir unidade', false),
    
    -- CORE - Sectors
    ('e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CORE', 'sectors', 'create', 'Criar setor', false),
    ('e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'CORE', 'sectors', 'read', 'Visualizar setor', false),
    ('e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'CORE', 'sectors', 'update', 'Editar setor', false),
    ('e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'CORE', 'sectors', 'delete', 'Excluir setor', false),
    
    -- CORE - Persons
    ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CORE', 'persons', 'create', 'Cadastrar pessoa', false),
    ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'CORE', 'persons', 'read', 'Visualizar pessoa', true),
    ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'CORE', 'persons', 'update', 'Editar pessoa', false),
    ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'CORE', 'persons', 'delete', 'Excluir pessoa', false),
    
    -- CORE - Users
    ('e5eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CORE', 'users', 'create', 'Criar usuário', false),
    ('e5eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'CORE', 'users', 'read', 'Visualizar usuário', false),
    ('e5eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'CORE', 'users', 'update', 'Editar usuário', false),
    ('e5eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'CORE', 'users', 'delete', 'Excluir usuário', false),
    ('e5eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'CORE', 'users', 'assign_roles', 'Atribuir perfis', false),
    
    -- CORE - RBAC
    ('e6eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CORE', 'roles', 'create', 'Criar perfil', false),
    ('e6eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'CORE', 'roles', 'read', 'Visualizar perfil', false),
    ('e6eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'CORE', 'roles', 'update', 'Editar perfil', false),
    ('e6eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'CORE', 'roles', 'delete', 'Excluir perfil', false),
    ('e6eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'CORE', 'roles', 'assign_permissions', 'Atribuir permissões', false),
    
    -- CORE - Feature Flags
    ('e7eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CORE', 'feature_flags', 'read', 'Visualizar módulos', false),
    ('e7eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'CORE', 'feature_flags', 'update', 'Habilitar/desabilitar módulos', false),
    
    -- CORE - Audit
    ('e8eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CORE', 'audit_log', 'read', 'Visualizar logs de auditoria', true),
    ('e8eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'CORE', 'access_log', 'read', 'Visualizar logs de acesso', true),
    ('e8eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'CORE', 'error_log', 'read', 'Visualizar logs de erro', false),
    
    -- CORE - Notifications
    ('e9eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CORE', 'notifications', 'create', 'Criar notificação', false),
    ('e9eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'CORE', 'notifications', 'read', 'Visualizar notificações', false),
    ('e9eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'CORE', 'notify_templates', 'manage', 'Gerenciar templates', false);

-- ============================================================
-- 7. PERMISSÕES POR PERFIL (Role-Permission)
-- ============================================================

-- SYSTEM_ADMIN - Todas as permissões
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', id FROM rbac_permissions;

-- ADMIN_MUNICIPAL - Todas as permissões do tenant
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT 'd2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', id FROM rbac_permissions;

-- GESTOR_SMS - Leitura e algumas edições
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', id 
FROM rbac_permissions 
WHERE action IN ('read', 'update');

-- ============================================================
-- 8. PESSOAS (Profissionais e Pacientes Fictícios)
-- ============================================================

-- Profissionais de Saúde
INSERT INTO core_persons (id, tenant_id, cpf, cns, full_name, birth_date, gender, phone_primary, email)
VALUES
    -- Médicos (3)
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '11111111111', '111111111110001', 'Dr. Carlos Alberto Silva', '1975-03-15', 'M', '11999990001', 'carlos.silva@nexus.local'),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '11111111112', '111111111110002', 'Dra. Maria Fernanda Costa', '1980-07-22', 'F', '11999990002', 'maria.costa@nexus.local'),
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '11111111113', '111111111110003', 'Dr. João Pedro Santos', '1978-11-08', 'M', '11999990003', 'joao.santos@nexus.local'),
    
    -- Enfermeiros (3)
    ('f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '22222222221', '222222222220001', 'Ana Paula Oliveira', '1985-05-10', 'F', '11999990004', 'ana.oliveira@nexus.local'),
    ('f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '22222222222', '222222222220002', 'Roberto Carlos Lima', '1982-09-25', 'M', '11999990005', 'roberto.lima@nexus.local'),
    ('f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '22222222223', '222222222220003', 'Patricia Souza Mendes', '1988-01-30', 'F', '11999990006', 'patricia.mendes@nexus.local'),
    
    -- Técnicos de Enfermagem (3)
    ('f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '33333333331', '333333333330001', 'Lucas Fernando Alves', '1990-04-12', 'M', '11999990007', 'lucas.alves@nexus.local'),
    ('f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '33333333332', '333333333330002', 'Juliana Beatriz Rocha', '1992-08-18', 'F', '11999990008', 'juliana.rocha@nexus.local'),
    ('f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '33333333333', '333333333330003', 'Marcos Vinícius Pereira', '1989-12-05', 'M', '11999990009', 'marcos.pereira@nexus.local'),
    
    -- Bioquímicos (2)
    ('f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '44444444441', '444444444440001', 'Fernanda Cristina Dias', '1983-06-20', 'F', '11999990010', 'fernanda.dias@nexus.local'),
    ('f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '44444444442', '444444444440002', 'André Luiz Martins', '1981-10-15', 'M', '11999990011', 'andre.martins@nexus.local'),
    
    -- Radiologistas (2)
    ('f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '55555555551', '555555555550001', 'Dr. Ricardo Augusto Ferreira', '1976-02-28', 'M', '11999990012', 'ricardo.ferreira@nexus.local'),
    ('f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '55555555552', '555555555550002', 'Dra. Camila Regina Nascimento', '1984-07-14', 'F', '11999990013', 'camila.nascimento@nexus.local'),
    
    -- Farmacêutico (1)
    ('f6eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '66666666661', '666666666660001', 'Paulo Henrique Cardoso', '1979-11-22', 'M', '11999990014', 'paulo.cardoso@nexus.local'),
    
    -- Regulador (1)
    ('f7eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '77777777771', '777777777770001', 'Cláudia Maria Ribeiro', '1977-04-08', 'F', '11999990015', 'claudia.ribeiro@nexus.local'),
    
    -- Faturista (1)
    ('f8eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '88888888881', '888888888880001', 'Eduardo José Campos', '1986-09-03', 'M', '11999990016', 'eduardo.campos@nexus.local'),
    
    -- Ouvidor (1)
    ('f9eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '99999999991', '999999999990001', 'Mariana Luiza Teixeira', '1987-12-17', 'F', '11999990017', 'mariana.teixeira@nexus.local'),
    
    -- Gestores (2)
    ('fa0ebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '10101010101', '101010101010001', 'Antônio Carlos Moreira', '1970-01-25', 'M', '11999990018', 'antonio.moreira@nexus.local'),
    ('fa0ebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '10101010102', '101010101010002', 'Beatriz Helena Cunha', '1972-06-11', 'F', '11999990019', 'beatriz.cunha@nexus.local');

-- Pacientes Fictícios (50)
INSERT INTO core_persons (id, tenant_id, cpf, cns, full_name, birth_date, gender, mother_name, phone_primary)
SELECT 
    uuid_generate_v4(),
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    LPAD((ROW_NUMBER() OVER())::text, 11, '0'),
    LPAD((ROW_NUMBER() OVER())::text, 15, '9'),
    'Paciente Demo ' || (ROW_NUMBER() OVER()),
    DATE '1950-01-01' + (random() * 25000)::int,
    CASE WHEN random() > 0.5 THEN 'M' ELSE 'F' END,
    'Mãe do Paciente ' || (ROW_NUMBER() OVER()),
    '11' || LPAD((random() * 99999999)::int::text, 8, '0')
FROM generate_series(1, 50);

-- ============================================================
-- 9. USUÁRIOS DO SISTEMA
-- Corrigido UUIDs inválidos (u1eebc99 -> 01eebc99)
-- ============================================================
INSERT INTO core_users (id, tenant_id, person_id, email, username, display_name, is_active, is_system_admin, force_password_change)
VALUES
    -- Admin do Sistema (global)
    ('01eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', NULL, NULL, 'admin@nexus.local', 'admin', 'Administrador do Sistema', true, true, true),
    
    -- Admin Municipal
    ('02eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'fa0ebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'antonio.moreira@nexus.local', 'antonio.moreira', 'Antônio Carlos Moreira', true, false, true),
    
    -- Gestor SMS
    ('03eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'fa0ebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'beatriz.cunha@nexus.local', 'beatriz.cunha', 'Beatriz Helena Cunha', true, false, true),
    
    -- Médicos
    ('04eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'carlos.silva@nexus.local', 'carlos.silva', 'Dr. Carlos Alberto Silva', true, false, false),
    ('04eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'maria.costa@nexus.local', 'maria.costa', 'Dra. Maria Fernanda Costa', true, false, false),
    ('04eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'joao.santos@nexus.local', 'joao.santos', 'Dr. João Pedro Santos', true, false, false),
    
    -- Enfermeiros
    ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'ana.oliveira@nexus.local', 'ana.oliveira', 'Ana Paula Oliveira', true, false, false),
    ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'roberto.lima@nexus.local', 'roberto.lima', 'Roberto Carlos Lima', true, false, false),
    
    -- Bioquímicos
    ('06eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'fernanda.dias@nexus.local', 'fernanda.dias', 'Fernanda Cristina Dias', true, false, false),
    
    -- Radiologistas
    ('07eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'ricardo.ferreira@nexus.local', 'ricardo.ferreira', 'Dr. Ricardo Augusto Ferreira', true, false, false),
    
    -- Farmacêutico
    ('08eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f6eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'paulo.cardoso@nexus.local', 'paulo.cardoso', 'Paulo Henrique Cardoso', true, false, false),
    
    -- Regulador
    ('09eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f7eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'claudia.ribeiro@nexus.local', 'claudia.ribeiro', 'Cláudia Maria Ribeiro', true, false, false),
    
    -- Faturista
    ('0a0ebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f8eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'eduardo.campos@nexus.local', 'eduardo.campos', 'Eduardo José Campos', true, false, false),
    
    -- Ouvidora
    ('0b0ebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f9eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'mariana.teixeira@nexus.local', 'mariana.teixeira', 'Mariana Luiza Teixeira', true, false, false);

-- ============================================================
-- 10. ATRIBUIÇÃO DE PERFIS AOS USUÁRIOS
-- Corrigido UUIDs inválidos nos user_id e role_id
-- ============================================================
INSERT INTO rbac_user_roles (user_id, role_id, unit_id, sector_id, is_primary, is_active)
VALUES
    -- Admin Sistema (global)
    ('01eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, true, true),
    
    -- Admin Municipal (global no tenant)
    ('02eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'd2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', NULL, NULL, true, true),
    
    -- Gestor SMS
    ('03eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', NULL, NULL, true, true),
    
    -- Médicos no Hospital
    ('04eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'd6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, true, true),
    ('04eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'd6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, true, true),
    ('04eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'd6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, true, true),
    
    -- Enfermeiros no Hospital
    ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'd7eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, true, true),
    ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'd7eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, true, true),
    
    -- Bioquímico no Laboratório
    ('06eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'd9eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', NULL, true, true),
    
    -- Radiologista no Centro de Imagens
    ('07eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'da0ebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', NULL, true, true),
    
    -- Farmacêutico na Farmácia
    ('08eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'dd0ebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'b4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', NULL, true, true),
    
    -- Regulador na Central de Regulação
    ('09eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'd4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'b8eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', NULL, true, true),
    
    -- Faturista no Hospital
    ('0a0ebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'e00ebc99-9c0b-4ef8-bb6d-6bb9bd380a26', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, true, true),
    
    -- Ouvidora na SMS
    ('0b0ebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'e10ebc99-9c0b-4ef8-bb6d-6bb9bd380a27', 'b9eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', NULL, true, true);

-- ============================================================
-- 11. TEMPLATES DE NOTIFICAÇÃO
-- ============================================================
INSERT INTO notify_templates (tenant_id, code, name, channel, subject, body_template, variables, is_active)
VALUES
    (NULL, 'WELCOME_USER', 'Boas-vindas ao NEXUS', 'EMAIL', 'Bem-vindo ao NEXUS', 
     'Olá {{user_name}},\n\nSeja bem-vindo ao NEXUS - Sistema Integrado de Gestão Municipal da Saúde.\n\nSeu acesso foi criado com sucesso. Por favor, altere sua senha no primeiro acesso.\n\nAtenciosamente,\nEquipe NEXUS',
     '["user_name"]', true),
    
    (NULL, 'PASSWORD_RESET', 'Redefinição de Senha', 'EMAIL', 'Redefinição de Senha - NEXUS',
     'Olá {{user_name}},\n\nFoi solicitada a redefinição da sua senha. Clique no link abaixo para criar uma nova senha:\n\n{{reset_link}}\n\nSe você não solicitou esta alteração, ignore este e-mail.\n\nAtenciosamente,\nEquipe NEXUS',
     '["user_name", "reset_link"]', true),
    
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'REG_STATUS_CHANGE', 'Atualização de Regulação', 'EMAIL', 'Atualização do seu pedido de regulação',
     'Olá {{patient_name}},\n\nSeu pedido de regulação #{{regulation_id}} teve uma atualização de status:\n\nNovo status: {{new_status}}\n\nPara mais informações, acesse o Portal do Cidadão.\n\nAtenciosamente,\nSMS {{tenant_name}}',
     '["patient_name", "regulation_id", "new_status", "tenant_name"]', true);

-- ============================================================
-- FIM DO SEED
-- ============================================================
