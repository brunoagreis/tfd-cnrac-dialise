// ============================================================
// NEXUS - HOSP Types
// ============================================================

export interface HospEncounter {
  id: string
  tenant_id: string
  patient_id: string
  unit_id: string
  sector_id: string | null
  encounter_type: EncounterType
  encounter_class: EncounterClass
  status: EncounterStatus
  priority_color: ManchesterColor | null
  priority_level: number | null
  arrival_at: string
  triage_start_at: string | null
  triage_end_at: string | null
  service_start_at: string | null
  service_end_at: string | null
  discharge_at: string | null
  origin: string | null
  origin_unit_id: string | null
  destination: string | null
  destination_unit_id: string | null
  bed_id: string | null
  attending_professional_id: string | null
  chief_complaint: string | null
  primary_diagnosis_cid10: string | null
  secondary_diagnoses_cid10: string[]
  discharge_type: DischargeType | null
  discharge_summary: string | null
  encounter_number: string | null
  created_at: string
  updated_at: string
  version: number
  // Joined
  patient?: import("../mpi/types").MPIPatient
  unit?: import("../types").CoreUnit
  sector?: import("../types").CoreSector
  bed?: HospBed
}

export type EncounterType = "URGENCIA" | "EMERGENCIA" | "INTERNACAO" | "AMBULATORIO" | "OBSERVACAO"
export type EncounterClass = "PRESENCIAL" | "VIRTUAL" | "DOMICILIAR"
export type EncounterStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED" | "NO_SHOW"
export type ManchesterColor = "RED" | "ORANGE" | "YELLOW" | "GREEN" | "BLUE"
export type DischargeType = "ALTA_MELHORADO" | "ALTA_CURADO" | "ALTA_A_PEDIDO" | "TRANSFERENCIA" | "OBITO" | "EVASAO"

export interface HospBed {
  id: string
  tenant_id: string
  unit_id: string
  sector_id: string
  bed_number: string
  bed_type: BedType
  status: BedStatus
  current_patient_id: string | null
  current_encounter_id: string | null
  has_oxygen: boolean
  has_suction: boolean
  has_monitor: boolean
  has_ventilator: boolean
  is_active: boolean
}

export type BedType = "ENFERMARIA" | "UTI" | "UTI_PED" | "ISOLAMENTO" | "OBSERVACAO" | "BERCO"
export type BedStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "BLOCKED"

export interface HospWaitingQueue {
  id: string
  tenant_id: string
  encounter_id: string
  unit_id: string
  sector_id: string | null
  queue_position: number
  priority_color: ManchesterColor
  priority_level: number
  entered_queue_at: string
  max_wait_minutes: number
  target_service_at: string
  status: QueueStatus
  called_at: string | null
  called_by: string | null
  ticket_number: string
  // Joined
  encounter?: HospEncounter
}

export type QueueStatus = "WAITING" | "CALLED" | "IN_SERVICE" | "COMPLETED" | "NO_SHOW"

export interface HospTriage {
  id: string
  tenant_id: string
  encounter_id: string
  performed_by: string
  performed_at: string
  flowchart_id: string | null
  flowchart_code: string | null
  discriminator_id: string | null
  discriminator_text: string | null
  priority_color: ManchesterColor
  priority_level: number
  max_wait_minutes: number
  chief_complaint: string
  blood_pressure_systolic: number | null
  blood_pressure_diastolic: number | null
  heart_rate: number | null
  respiratory_rate: number | null
  temperature: number | null
  oxygen_saturation: number | null
  pain_scale: number | null
  glasgow_score: number | null
  blood_glucose: number | null
  weight: number | null
  height: number | null
  clinical_notes: string | null
  reported_allergies: string[]
  is_reclassification: boolean
  previous_triage_id: string | null
  reclassification_reason: string | null
}

export interface HospClinicalNote {
  id: string
  tenant_id: string
  encounter_id: string
  patient_id: string
  note_type: NoteType
  author_id: string
  author_specialty: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  diagnoses: DiagnosisEntry[]
  procedures: ProcedureEntry[]
  status: NoteStatus
  signed_at: string | null
  digital_signature: string | null
  signature_certificate: string | null
  version: number
  amended_from_id: string | null
  amendment_reason: string | null
  created_at: string
  updated_at: string
}

export type NoteType = "SOAP" | "ADMISSAO" | "EVOLUCAO" | "ALTA" | "INTERCONSULTA" | "PARECER"
export type NoteStatus = "DRAFT" | "SIGNED" | "AMENDED" | "CANCELLED"

export interface DiagnosisEntry {
  cid10: string
  description: string
  type: "PRIMARY" | "SECONDARY"
}

export interface ProcedureEntry {
  sigtap_code: string
  description: string
  quantity: number
}

export interface HospVitalSigns {
  id: string
  tenant_id: string
  encounter_id: string
  patient_id: string
  recorded_by: string
  recorded_at: string
  blood_pressure_systolic: number | null
  blood_pressure_diastolic: number | null
  heart_rate: number | null
  respiratory_rate: number | null
  temperature: number | null
  oxygen_saturation: number | null
  pain_scale: number | null
  glasgow_score: number | null
  glasgow_details: GlasgowDetails | null
  blood_glucose: number | null
  blood_glucose_timing: string | null
  fluid_intake_ml: number | null
  fluid_output_ml: number | null
  notes: string | null
}

export interface GlasgowDetails {
  eye: number
  verbal: number
  motor: number
}

export interface HospPrescription {
  id: string
  tenant_id: string
  encounter_id: string
  patient_id: string
  prescription_type: PrescriptionType
  prescriber_id: string
  prescriber_council_type: string | null
  prescriber_council_number: string | null
  prescriber_council_state: string | null
  valid_from: string
  valid_until: string | null
  status: PrescriptionStatus
  prescription_number: string | null
  general_notes: string | null
  diet_type: string | null
  diet_restrictions: string | null
  nursing_care: string[]
  signed_at: string | null
  digital_signature: string | null
  created_at: string
  updated_at: string
  version: number
  // Joined
  items?: HospPrescriptionItem[]
}

export type PrescriptionType = "HOSPITALAR" | "ALTA" | "AMBULATORIAL"
export type PrescriptionStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED" | "COMPLETED"

export interface HospPrescriptionItem {
  id: string
  tenant_id: string
  prescription_id: string
  medication_id: string | null
  medication_code: string | null
  medication_name: string
  active_principle: string | null
  dose: string
  dose_unit: string | null
  frequency: string
  frequency_hours: number | null
  administration_route: string
  duration_value: number | null
  duration_unit: string | null
  dilution: string | null
  infusion_time: string | null
  specific_times: string[]
  instructions: string | null
  is_if_needed: boolean
  if_needed_condition: string | null
  max_daily_doses: number | null
  status: PrescriptionItemStatus
  suspended_at: string | null
  suspended_by: string | null
  suspension_reason: string | null
  display_order: number
}

export type PrescriptionItemStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED" | "COMPLETED"

export interface HospMedicationAdministration {
  id: string
  tenant_id: string
  prescription_item_id: string
  encounter_id: string
  patient_id: string
  scheduled_at: string
  status: AdministrationStatus
  administered_at: string | null
  administered_by: string | null
  dose_administered: string | null
  not_administered_reason: string | null
  not_administered_notes: string | null
  notes: string | null
  medication_lot: string | null
  medication_expiry: string | null
}

export type AdministrationStatus = "SCHEDULED" | "ADMINISTERED" | "DELAYED" | "NOT_ADMINISTERED" | "CANCELLED"

export interface HospExamRequest {
  id: string
  tenant_id: string
  encounter_id: string
  patient_id: string
  requester_id: string
  requested_at: string
  exam_type: ExamType
  priority: ExamPriority
  status: ExamRequestStatus
  clinical_indication: string | null
  request_number: string | null
  // Joined
  items?: HospExamRequestItem[]
}

export type ExamType = "LABORATORIO" | "IMAGEM" | "OUTRO"
export type ExamPriority = "EMERGENCY" | "URGENT" | "ROUTINE"
export type ExamRequestStatus = "REQUESTED" | "COLLECTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

export interface HospExamRequestItem {
  id: string
  tenant_id: string
  request_id: string
  procedure_id: string | null
  procedure_code: string | null
  procedure_name: string
  quantity: number
  laterality: string | null
  preparation_instructions: string | null
  status: ExamRequestStatus
  result_summary: string | null
  result_at: string | null
}

// Dashboard types
export interface EmergencyDashboard {
  waiting_count: number
  in_service_count: number
  queue_by_priority: Record<ManchesterColor, number>
  average_wait_time_minutes: number
  beds_available: number
  beds_total: number
}

export interface BedCensus {
  unit_id: string
  unit_name: string
  sectors: SectorCensus[]
  total_beds: number
  available_beds: number
  occupancy_rate: number
}

export interface SectorCensus {
  sector_id: string
  sector_name: string
  bed_type: BedType
  total: number
  available: number
  occupied: number
  maintenance: number
}
