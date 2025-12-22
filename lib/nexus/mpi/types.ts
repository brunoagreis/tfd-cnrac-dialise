// ============================================================
// NEXUS - MPI Types
// ============================================================

export interface MPIPatient {
  id: string
  tenant_id: string
  person_id: string
  medical_record_number: string | null
  external_ids: Record<string, string>
  marital_status: MaritalStatus | null
  education_level: EducationLevel | null
  occupation: string | null
  religion: string | null
  ethnicity: Ethnicity | null
  blood_type: BloodType | null
  rh_factor: string | null
  legal_guardian_id: string | null
  legal_guardian_relationship: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  preferred_language: string
  needs_interpreter: boolean
  accessibility_needs: string[]
  is_deceased: boolean
  death_date: string | null
  death_certificate_number: string | null
  death_cause_cid10: string | null
  is_active: boolean
  merged_into_id: string | null
  created_at: string
  updated_at: string
  version: number
  // Joined fields
  person?: PersonDetails
}

export interface PersonDetails {
  cpf: string
  cns: string
  full_name: string
  social_name: string | null
  birth_date: string
  gender: "M" | "F" | "O"
  mother_name: string | null
  father_name: string | null
  phone_primary: string | null
  phone_secondary: string | null
  email: string | null
  address_street: string | null
  address_number: string | null
  address_complement: string | null
  address_neighborhood: string | null
  address_city: string | null
  address_state: string | null
  address_zipcode: string | null
}

export type MaritalStatus = "SOLTEIRO" | "CASADO" | "DIVORCIADO" | "VIUVO" | "UNIAO_ESTAVEL"
export type EducationLevel = "ANALFABETO" | "FUNDAMENTAL" | "MEDIO" | "SUPERIOR" | "POS"
export type Ethnicity = "BRANCA" | "PRETA" | "PARDA" | "AMARELA" | "INDIGENA"
export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"

export interface MPIAllergy {
  id: string
  tenant_id: string
  patient_id: string
  allergy_type: AllergyType
  allergen: string
  allergen_code: string | null
  severity: AllergySeverity
  reaction_description: string | null
  onset_date: string | null
  diagnosed_by: string | null
  status: AllergyStatus
  created_at: string
  updated_at: string
}

export type AllergyType = "MEDICAMENTO" | "ALIMENTO" | "AMBIENTAL" | "CONTRASTE" | "LATEX" | "OUTRO"
export type AllergySeverity = "LEVE" | "MODERADA" | "GRAVE" | "ANAFILAXIA"
export type AllergyStatus = "ACTIVE" | "INACTIVE" | "RESOLVED" | "ENTERED_IN_ERROR"

export interface MPICondition {
  id: string
  tenant_id: string
  patient_id: string
  condition_type: ConditionType
  cid10_code: string | null
  ciap2_code: string | null
  description: string
  severity: ConditionSeverity | null
  clinical_status: ClinicalStatus
  verification_status: VerificationStatus
  onset_date: string | null
  abatement_date: string | null
  recorded_date: string
  recorded_by: string | null
  asserter_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ConditionType = "CRONICA" | "AGUDA" | "ANTECEDENTE" | "FAMILIAR"
export type ConditionSeverity = "LEVE" | "MODERADA" | "GRAVE"
export type ClinicalStatus = "ACTIVE" | "RECURRENCE" | "RELAPSE" | "INACTIVE" | "REMISSION" | "RESOLVED"
export type VerificationStatus = "UNCONFIRMED" | "PROVISIONAL" | "DIFFERENTIAL" | "CONFIRMED" | "REFUTED"

export interface MPIImmunization {
  id: string
  tenant_id: string
  patient_id: string
  vaccine_code: string | null
  vaccine_name: string
  manufacturer: string | null
  lot_number: string | null
  administration_date: string
  dose_number: number | null
  dose_sequence: string | null
  administration_site: string | null
  administration_route: string | null
  administered_at_unit_id: string | null
  administered_by: string | null
  status: ImmunizationStatus
  status_reason: string | null
  had_reaction: boolean
  reaction_description: string | null
  external_source: string | null
  external_id: string | null
  created_at: string
}

export type ImmunizationStatus = "COMPLETED" | "NOT_DONE" | "ENTERED_IN_ERROR"

export interface MPIConsent {
  id: string
  tenant_id: string
  patient_id: string
  consent_type: ConsentType
  consent_template_id: string | null
  status: ConsentStatus
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
  revoked_reason: string | null
  collection_method: CollectionMethod | null
  witness_name: string | null
  document_url: string | null
  digital_signature: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type ConsentType = "TRATAMENTO" | "COMPARTILHAMENTO" | "PESQUISA" | "MARKETING" | "TELEMEDICINA"
export type ConsentStatus = "ACTIVE" | "REVOKED" | "EXPIRED"
export type CollectionMethod = "PRESENCIAL" | "DIGITAL" | "TELEFONE"

export interface MPIDuplicateCandidate {
  id: string
  tenant_id: string
  patient_id_a: string
  patient_id_b: string
  similarity_score: number
  match_details: Record<string, number>
  status: DuplicateStatus
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  surviving_patient_id: string | null
  created_at: string
  // Joined
  patient_a?: MPIPatient
  patient_b?: MPIPatient
}

export type DuplicateStatus = "PENDING" | "CONFIRMED_DUPLICATE" | "NOT_DUPLICATE" | "MERGED"

export interface PatientSearchParams {
  query?: string
  cpf?: string
  cns?: string
  name?: string
  birth_date?: string
  mother_name?: string
  medical_record_number?: string
  include_inactive?: boolean
  include_deceased?: boolean
  page?: number
  limit?: number
}

export interface PatientSearchResult {
  patients: MPIPatient[]
  total: number
  page: number
  limit: number
  possible_duplicates?: MPIDuplicateCandidate[]
}

export interface MergeRequest {
  surviving_patient_id: string
  merged_patient_id: string
  merge_reason: string
  incorporate_data?: {
    allergies?: boolean
    conditions?: boolean
    immunizations?: boolean
    consents?: boolean
  }
}

export interface PatientSummary {
  patient: MPIPatient
  allergies: MPIAllergy[]
  active_conditions: MPICondition[]
  recent_immunizations: MPIImmunization[]
  active_consents: MPIConsent[]
}
