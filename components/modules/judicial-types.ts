export const JUDICIAL_SYSTEMS = ["CORE", "SISREG", "OUTRO"] as const
export type JudicialSystem = (typeof JUDICIAL_SYSTEMS)[number]

export const JUDICIAL_CASE_STATUSES = [
  "ativo",
  "aguardando_agendamento",
  "agendado",
  "cumprido",
  "descumprido",
  "inercia_municipio",
  "encerrado",
] as const
export type JudicialCaseStatus = (typeof JUDICIAL_CASE_STATUSES)[number]

export const MOVEMENT_TYPES = [
  "monitoramento",
  "descumprimento",
  "sequestro",
  "bloqueio",
  "agendamento",
  "manifestacao_municipio",
  "solicitacao_inclusao",
  "reiteracao",
  "envio_agendamento_demanda",
  "reserva_agendamento",
  "nao_agendado",
  "cumprimento",
  "competencia_municipio",
  "procedimento_nao_sus",
  "falta_paciente",
  "obito",
  "encerramento_inercia",
  "reabertura",
  "retorno_fluxo_automatico",
  "monitoramento_automatico_core",
  "encerramento",
] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export const QUEUE_REASONS = [
  "monitoramento",
  "1_reiteracao_municipio",
  "2_reiteracao_municipio",
  "3_reiteracao_municipio",
  "inercia_municipio",
  "obrigacao_municipio",
  "nao_sus",
  "transferencia",
  "paciente_agendado_verificar",
  "confirmacao_core_automatica",
] as const
export type QueueReason = (typeof QUEUE_REASONS)[number]

export const MONITORING_MODES = ["automatic_core", "humano"] as const
export type MonitoringMode = (typeof MONITORING_MODES)[number]

export const SCHEDULING_STATUSES = ["fora_fila", "pendente", "reservado"] as const
export type SchedulingStatus = (typeof SCHEDULING_STATUSES)[number]

export const CORE_TABLES = ["core_ambulatorial", "core_leito", "core_urgencia"] as const
export type CoreTable = (typeof CORE_TABLES)[number]

export interface JudicialAttachment {
  id: string
  name: string
  category: "monitoramento" | "ficha" | "manifestacao" | "oficio" | "comprovante" | "outros"
  createdAt: string
  createdById: string
  createdByName: string
  source: "processo" | "movimentacao" | "manifestacao"
}

export interface JudicialProcedure {
  id: string
  sigtapCode: string
  description: string
  specialty?: string
  subSpecialty?: string
  situation?: "determinado" | "cumprido" | "encerrado"
  active: boolean
  createdAt: string
  createdByName: string
}

export interface JudicialCid {
  id: string
  code: string
  description: string
  active: boolean
  createdAt: string
  createdByName: string
}

export interface JudicialFicha {
  id: string
  system: JudicialSystem
  number?: string
  includedAt: string
  requestedInclusion: boolean
  hasJudicialMark: boolean
  attachmentName?: string
  notes: string
  active?: boolean
  updatedAt?: string
  updatedByName?: string
  inactiveReason?: string
  inactiveAt?: string
}

export interface JudicialMovement {
  id: string
  type: MovementType
  description: string
  createdAt: string
  createdById: string
  createdByName: string
  appointmentDate?: string
  stateAmount?: number
  municipalityAmount?: number
  responseRequestedAt?: string
  schedulingReason?: string
  attachments: JudicialAttachment[]
}

export interface MunicipalityManifestation {
  id: string
  createdAt: string
  createdByName: string
  description: string
  attachments: JudicialAttachment[]
}

export interface CoreHistoryEntry {
  id: string
  table: CoreTable
  fichaNumber: string
  patientName: string
  appointmentDate?: string
  procedureCode?: string
  procedureDescription?: string
  statusText: string
  importedAt: string
}

export interface JudicialCaseRegistration {
  isIntimation: "sim" | "nao"
  oficioNumber: string
  receivedAt: string
  reiterationAt?: string
  actionRecords: string
  pgeNetNumber: string
  deadlineDays: number
  deadlineAt: string
  municipalityId: string
  municipalityIbge: string
  municipalityName: string
}

export interface JudicialCase {
  id: string
  patientId: string
  patientName: string
  cpf: string
  municipalityName: string
  originModule: "tfd" | "cnrac" | "hemodialise" | "judicial"
  originProtocol: string
  processNumber: string
  active: boolean
  status: JudicialCaseStatus
  priority: number
  lastMonitoredAt?: string
  lastMovementAt: string
  monitoringMode: MonitoringMode
  monitoringModeReason: string
  schedulingStatus: SchedulingStatus
  schedulingRequestedAt?: string
  schedulingReservedAt?: string
  appointmentDate?: string
  appointmentConfirmedAt?: string
  procedures: JudicialProcedure[]
  cids: JudicialCid[]
  fichas: JudicialFicha[]
  attachments: JudicialAttachment[]
  movements: JudicialMovement[]
  municipalityManifestations: MunicipalityManifestation[]
  coreHistory: CoreHistoryEntry[]
  registration?: JudicialCaseRegistration
}

export interface MunicipalityContact {
  id: string
  municipalityName: string
  emails: string[]
  phones: string[]
  contacts: string[]
  updatedAt: string
}

export interface EmailTemplate {
  id: string
  type:
    | "demanda_judicial_cadastrada"
    | "solicitar_inclusao_ficha"
    | "reiteracao_municipio"
    | "agendamento_informado"
    | "inercia_municipio"
    | "demanda_prejudicial_cadastrada"
    | "prazo_prejudicial_vencendo"
    | "prazo_prejudicial_vencido"
  title: string
  subject: string
  body: string
  updatedAt: string
}

export interface CoreRow {
  id: string
  table: CoreTable
  fichaNumber: string
  patientName: string
  cpf?: string
  appointmentDate?: string
  procedureCode?: string
  procedureDescription?: string
  statusText: string
  importedAt: string
}

export interface AgendaOffer {
  id: string
  specialty: string
  subSpecialty?: string
  procedureCode?: string
  procedureDescription?: string
  cidCode?: string
  date: string
  seats: number
  importedAt: string
}

export interface UiAuditEvent {
  id: string
  createdAt: string
  userId: string
  userName: string
  action: string
  caseId?: string
  details?: string
}

export interface PriorityFocus {
  mode: "none" | "procedure" | "cid"
  value?: string
  label?: string
}

export const QUEUE_REASON_LABELS: Record<QueueReason, string> = {
  monitoramento: "Monitoramento",
  "1_reiteracao_municipio": "1ª Reiteração ao Município",
  "2_reiteracao_municipio": "2ª Reiteração ao Município",
  "3_reiteracao_municipio": "3ª Reiteração ao Município",
  inercia_municipio: "Inércia do Município",
  obrigacao_municipio: "Obrigação do Município",
  nao_sus: "Não SUS",
  transferencia: "Transferência",
  paciente_agendado_verificar: "Paciente Agendado - Verificar",
  confirmacao_core_automatica: "Monitoramento CORE Automático",
}

export const JUDICIAL_CASE_STATUS_LABELS: Record<JudicialCaseStatus, string> = {
  ativo: "Ativo",
  aguardando_agendamento: "Aguardando Agendamento",
  agendado: "Agendado",
  cumprido: "Cumprido",
  descumprido: "Descumprido",
  inercia_municipio: "Inércia do Município",
  encerrado: "Encerrado",
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  monitoramento: "Monitoramento",
  descumprimento: "Descumprimento",
  sequestro: "Sequestro",
  bloqueio: "Bloqueio",
  agendamento: "Agendamento",
  manifestacao_municipio: "Manifestação do Município",
  solicitacao_inclusao: "Solicitação de Inclusão",
  reiteracao: "Reiteração",
  envio_agendamento_demanda: "Envio para Agendamento da Demanda",
  reserva_agendamento: "Reserva de Agendamento",
  nao_agendado: "Não Agendado",
  cumprimento: "Cumprimento",
  competencia_municipio: "Competência do Município",
  procedimento_nao_sus: "Procedimento Não SUS",
  falta_paciente: "Falta do Paciente",
  obito: "Óbito",
  encerramento_inercia: "Encerramento por Inércia do Município",
  encerramento: "Encerramento do Processo",
  reabertura: "Reabertura",
  retorno_fluxo_automatico: "Retorno ao Fluxo Automático",
  monitoramento_automatico_core: "Monitoramento Automático CORE",
}

export const SYSTEM_LABELS: Record<JudicialSystem, string> = {
  CORE: "CORE",
  SISREG: "SISREG",
  OUTRO: "Outro",
}

export const CORE_TABLE_LABELS: Record<CoreTable, string> = {
  core_ambulatorial: "CORE Ambulatorial",
  core_leito: "CORE Leito",
  core_urgencia: "CORE Urgência",
}

export const SCHEDULING_STATUS_LABELS: Record<SchedulingStatus, string> = {
  fora_fila: "Fora da fila",
  pendente: "Pendente",
  reservado: "Reservado",
}
