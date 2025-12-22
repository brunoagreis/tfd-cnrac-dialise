// ============================================================
// NEXUS - Tipos TypeScript para o Sistema
// ============================================================

// Core Types
export interface Tenant {
  id: string
  name: string
  slug: string
  city: string
  state: string
  ibge_code?: string
  cnes_principal?: string
  logo_url?: string
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Unit {
  id: string
  tenant_id: string
  parent_unit_id?: string
  name: string
  cnes?: string
  unit_type: UnitType
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
  latitude?: number
  longitude?: number
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type UnitType = "HOSP" | "UBS" | "UPA" | "LAB" | "IMAG" | "PHARM" | "ALMOX" | "ADMIN" | "REG"

export interface Sector {
  id: string
  tenant_id: string
  unit_id: string
  name: string
  sector_code?: string
  sector_type?: string
  capacity?: number
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Person {
  id: string
  tenant_id: string
  cpf?: string
  cns?: string
  full_name: string
  social_name?: string
  birth_date?: string
  gender?: "M" | "F" | "O" | "U"
  mother_name?: string
  father_name?: string
  nationality?: string
  phone_primary?: string
  phone_secondary?: string
  email?: string
  address_street?: string
  address_number?: string
  address_complement?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  address_zip?: string
  photo_url?: string
  is_deceased: boolean
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  tenant_id?: string
  person_id?: string
  auth_user_id?: string
  email: string
  username?: string
  display_name: string
  avatar_url?: string
  is_active: boolean
  is_system_admin: boolean
  force_password_change: boolean
  two_factor_enabled: boolean
  last_login_at?: string
  last_login_ip?: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

// RBAC Types
export interface Role {
  id: string
  tenant_id?: string
  name: string
  display_name: string
  description?: string
  scope: "global" | "unit" | "sector"
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  module_code: string
  resource: string
  action: string
  description?: string
  is_sensitive: boolean
  created_at: string
}

export interface UserRole {
  id: string
  user_id: string
  role_id: string
  unit_id?: string
  sector_id?: string
  is_primary: boolean
  valid_from: string
  valid_until?: string
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined fields
  role?: Role
  unit?: Unit
  sector?: Sector
}

// Feature Flags
export interface FeatureFlag {
  id: string
  tenant_id: string
  module_code: ModuleCode
  is_enabled: boolean
  enabled_at?: string
  enabled_by?: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ModuleCode =
  | "CORE"
  | "MPI"
  | "HOSP"
  | "LAB"
  | "IMAG_HOSP"
  | "IMAG_MUN"
  | "REG"
  | "TFD"
  | "JUD"
  | "LOG"
  | "FARM"
  | "COMPRAS"
  | "CONTRATOS_SUS"
  | "CAP_INST"
  | "ENG_CLIN"
  | "FAT"
  | "AUD_PREVIA"
  | "OUVIDORIA"
  | "SEG_PAC"
  | "GOV"
  | "BI"
  | "NEXUS_CIDADAO"
  | "RH_SAUDE"
  | "PATRIMONIO_SAUDE"
  | "CONVENIOS_SAUDE"
  | "GED_SAUDE"

// Audit Types
export interface AuditEventLog {
  id: string
  tenant_id?: string
  user_id?: string
  session_id?: string
  ip_address?: string
  user_agent?: string
  module_code: string
  entity_type: string
  entity_id?: string
  action: string
  action_description?: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
}

export interface LogAccess {
  id: string
  tenant_id?: string
  user_id: string
  session_id?: string
  ip_address?: string
  user_agent?: string
  module_code: string
  entity_type: string
  entity_id: string
  access_type: "VIEW" | "PRINT" | "EXPORT" | "DOWNLOAD"
  reason: string
  metadata: Record<string, unknown>
  created_at: string
}

// Notification Types
export interface NotifyTemplate {
  id: string
  tenant_id?: string
  code: string
  name: string
  channel: "EMAIL" | "SMS" | "PUSH" | "WHATSAPP" | "INTERNAL"
  subject?: string
  body_template: string
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NotifyOutbox {
  id: string
  tenant_id?: string
  template_id?: string
  channel: string
  recipient_user_id?: string
  recipient_address: string
  subject?: string
  body: string
  variables: Record<string, unknown>
  priority: number
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED"
  attempts: number
  max_attempts: number
  last_attempt_at?: string
  last_error?: string
  scheduled_for: string
  sent_at?: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// Consent Types
export interface ConsentRecord {
  id: string
  tenant_id: string
  person_id: string
  consent_type: string
  consent_version: string
  is_granted: boolean
  granted_at?: string
  revoked_at?: string
  ip_address?: string
  user_agent?: string
  legal_basis?: string
  purpose?: string
  data_categories?: string[]
  retention_period?: string
  metadata: Record<string, unknown>
  created_at: string
}

// Integration Types
export interface IntegrationOutbox {
  id: string
  tenant_id?: string
  integration_code: string
  event_type: string
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  idempotency_key: string
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "DLQ"
  attempts: number
  max_attempts: number
  last_attempt_at?: string
  last_error?: string
  next_retry_at?: string
  sent_at?: string
  response?: Record<string, unknown>
  created_at: string
  updated_at: string
}
