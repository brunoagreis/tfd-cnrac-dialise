import { createAdminClient } from "@/lib/supabase/server"
import type { FeatureFlag, ModuleCode } from "./types"

// Verificar se módulo está habilitado para tenant
export async function isModuleEnabled(tenantId: string, moduleCode: ModuleCode): Promise<boolean> {
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from("feature_flags")
    .select("is_enabled")
    .eq("tenant_id", tenantId)
    .eq("module_code", moduleCode)
    .single()

  if (error || !data) {
    return false
  }

  return data.is_enabled
}

// Buscar todos os módulos de um tenant
export async function getModulesForTenant(tenantId: string): Promise<FeatureFlag[]> {
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("module_code")

  if (error) {
    console.error("[NEXUS] Failed to fetch feature flags:", error)
    return []
  }

  return data as FeatureFlag[]
}

// Habilitar/desabilitar módulo
export async function toggleModule(
  tenantId: string,
  moduleCode: ModuleCode,
  enabled: boolean,
  enabledBy?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createAdminClient()

  const { error } = await supabase.from("feature_flags").upsert(
    {
      tenant_id: tenantId,
      module_code: moduleCode,
      is_enabled: enabled,
      enabled_at: enabled ? new Date().toISOString() : null,
      enabled_by: enabled ? enabledBy : null,
    },
    {
      onConflict: "tenant_id,module_code",
    },
  )

  if (error) {
    console.error("[NEXUS] Failed to toggle module:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Lista de todos os módulos disponíveis
export const ALL_MODULES: { code: ModuleCode; name: string; description: string }[] = [
  { code: "CORE", name: "Core", description: "Tenants, Usuários, RBAC, Logs" },
  { code: "MPI", name: "MPI", description: "Paciente Único e Deduplicação" },
  { code: "HOSP", name: "Hospitalar", description: "Recepção, Manchester, ADT, SOAP, Prescrição" },
  { code: "LAB", name: "Laboratório", description: "LIS - Sistema de Informação Laboratorial" },
  { code: "IMAG_HOSP", name: "Imagens Hospitalares", description: "RIS/PACS Operacional" },
  { code: "IMAG_MUN", name: "Imagens Municipais", description: "Governança e Repositório Municipal" },
  { code: "REG", name: "Regulação", description: "Regulação de Vagas/Exames/Urgências" },
  { code: "TFD", name: "TFD", description: "Tratamento Fora de Domicílio" },
  { code: "JUD", name: "Judicialização", description: "Processos, Prazos e Notificações" },
  { code: "LOG", name: "Logística", description: "Almoxarifado, Insumos, Vacinas, FEFO" },
  { code: "FARM", name: "Farmácia", description: "Farmácia Hospitalar, Municipal e Satélites" },
  { code: "COMPRAS", name: "Compras", description: "Compras SUS e Solicitações" },
  { code: "CONTRATOS_SUS", name: "Contratos SUS", description: "Contratualização e Metas" },
  { code: "CAP_INST", name: "Capacidade Instalada", description: "Gestão de Capacidade" },
  { code: "ENG_CLIN", name: "Engenharia Clínica", description: "Manutenção de Equipamentos" },
  { code: "FAT", name: "Faturamento", description: "AIH/SIA e Exportações" },
  { code: "AUD_PREVIA", name: "Auditoria Prévia", description: "Auditoria de Faturamento" },
  { code: "OUVIDORIA", name: "Ouvidoria", description: "Ouvidoria SUS" },
  { code: "SEG_PAC", name: "Segurança do Paciente", description: "Eventos Adversos" },
  { code: "GOV", name: "Governança", description: "Compliance, Riscos, Portarias" },
  { code: "BI", name: "BI", description: "Sala de Situação e Painéis" },
  { code: "NEXUS_CIDADAO", name: "Portal Cidadão", description: "Portal do Cidadão" },
  { code: "RH_SAUDE", name: "RH Saúde", description: "Recursos Humanos da Saúde" },
  { code: "PATRIMONIO_SAUDE", name: "Patrimônio", description: "Gestão Patrimonial" },
  { code: "CONVENIOS_SAUDE", name: "Convênios", description: "Convênios, Repasses e Emendas" },
  { code: "GED_SAUDE", name: "GED", description: "Gestão Eletrônica de Documentos" },
]
