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
  "encaminhar_demanda_municipio",
  "solicitacao_inclusao",
  "reiteracao",
  "envio_agendamento_demanda",
  "reserva_agendamento",
  "nao_agendado",
  "cumprimento",
  "falta_paciente",
  "obito",
  "encerramento_inercia",
  "encerramento_processo",
  "reabertura",
  "retorno_fluxo_automatico",
  "monitoramento_automatico_core",
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

export const CORE_TABLES = [
  "core_ambulatorial_finalizados",
  "core_ambulatorial_em_atendimento",
  "core_leitos",
] as const
export type CoreTable = (typeof CORE_TABLES)[number]

export interface JudicialAttachment {
  id: string
  name: string
  category: "monitoramento" | "ficha" | "manifestacao" | "oficio" | "comprovante" | "outros"
  createdAt: string
  createdById: string
  createdByName: string
  source: "processo" | "movimentacao" | "manifestacao"
  storedName?: string
  relativePath?: string
  url?: string
  mimeType?: string
  size?: number
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
  status?: "atendido" | "regulado" | "nao_realizado_rede_sus" | "ausente"
  statusReason?: string
  statusUpdatedAt?: string
  statusUpdatedByName?: string
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
  attachmentUrl?: string
  attachmentRelativePath?: string
  notes: string
  active?: boolean
  updatedAt?: string
  updatedByName?: string
  inactiveReason?: string
  status?: "atendido" | "falta" | "obito" | "inativa" | "finalizada"
  statusReason?: string
  statusUpdatedAt?: string
  statusUpdatedByName?: string
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

export interface JudicialProcessStatusEntry {
  id: string
  status: "em_andamento" | "descumprimento" | "decisao_judicial_prazo"
  createdAt: string
  createdById: string
  createdByName: string
  reason?: string
  deadlineType?: "dias" | "horas"
  deadlineValue?: number
}

export interface JudicialFinalization {
  status: "pendente" | "resolvido" | "bloqueio" | "sequestro" | "obito" | "devolvida"
  createdAt: string
  createdById: string
  createdByName: string
  pendingLocation?: "ses" | "core" | "municipio"
  reason?: string
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
  processNumbers?: string[]
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
}

export interface MunicipalityContact {
  id: string
  municipalityName: string
  emails: string[]
  phones: string[]
  contacts: string[]
  updatedAt?: string
}

export interface EmailTemplate {
  id: string
  type: string
  title: string
  subject: string
  body: string
  fontFamily?: string
  fontSize?: string
  updatedAt?: string
}

export interface PriorityFocusItem {
  id: string
  mode: "procedure" | "cid"
  code: string
  label: string
  expiresAt?: string
}

export interface PriorityFocus {
  mode: "none" | "procedure" | "cid"
  items: PriorityFocusItem[]
}

export interface CoreRow {
  id: string
  table: CoreTable
  fichaNumber: string
  patientName: string
  cpf?: string
  cns?: string
  procedureCode?: string
  procedureDescription?: string
  appointmentDate?: string
  statusText: string
  importedAt: string
}

export interface AgendaOffer {
  id: string
  caseId: string
  appointmentDate?: string
  status: "pendente" | "reservado" | "agendado" | "nao_agendado"
  description?: string
}

export interface UiAuditEvent {
  id: string
  action: string
  userId?: string
  userName?: string
  createdAt: string
  details?: string
}

export const CASE_STATUS_LABELS: Record<JudicialCaseStatus, string> = {
  ativo: "Ativo",
  aguardando_agendamento: "Aguardando agendamento",
  agendado: "Agendado",
  cumprido: "Cumprido",
  descumprido: "Descumprido",
  inercia_municipio: "Inércia do município",
  encerrado: "Encerrado",
}

export const JUDICIAL_CASE_STATUS_LABELS = CASE_STATUS_LABELS

export const SYSTEM_LABELS: Record<JudicialSystem, string> = {
  CORE: "CORE",
  SISREG: "SISREG",
  OUTRO: "Outro",
}

export const CORE_TABLE_LABELS: Record<CoreTable, string> = {
  core_ambulatorial_finalizados: "CORE ambulatorial finalizados",
  core_ambulatorial_em_atendimento: "CORE ambulatorial em atendimento",
  core_leitos: "CORE leitos",
}

export const JUDICIAL_FICHA_STATUS_LABELS: Record<NonNullable<JudicialFicha["status"]>, string> = {
  atendido: "Atendido",
  falta: "Falta",
  obito: "Óbito",
  inativa: "Inativa",
  finalizada: "Finalizada",
}

export const JUDICIAL_PROCEDURE_STATUS_LABELS: Record<NonNullable<JudicialProcedure["status"]>, string> = {
  atendido: "Atendido",
  regulado: "Regulado",
  nao_realizado_rede_sus: "Não realizado na rede SUS",
  ausente: "Ausente",
}

export const QUEUE_REASON_LABELS: Record<QueueReason, string> = {
  monitoramento: "Monitoramento",
  "1_reiteracao_municipio": "1ª reiteração ao município",
  "2_reiteracao_municipio": "2ª reiteração ao município",
  "3_reiteracao_municipio": "3ª reiteração ao município",
  inercia_municipio: "Inércia do município",
  obrigacao_municipio: "Obrigação do município",
  nao_sus: "Não SUS",
  transferencia: "Transferência",
  paciente_agendado_verificar: "Paciente agendado: verificar",
  confirmacao_core_automatica: "Confirmação CORE automática",
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  monitoramento: "Monitoramento",
  descumprimento: "Descumprimento",
  sequestro: "Sequestro",
  bloqueio: "Bloqueio",
  agendamento: "Agendamento",
  manifestacao_municipio: "Manifestação do município",
  encaminhar_demanda_municipio: "Encaminhamento de Demanda ao Munic\u00edpio",
  solicitacao_inclusao: "Solicitação de inclusão",
  reiteracao: "Reiteração",
  envio_agendamento_demanda: "Envio para agendamento da demanda",
  reserva_agendamento: "Reserva de agendamento",
  nao_agendado: "Não agendado",
  cumprimento: "Cumprimento",
  falta_paciente: "Falta do paciente",
  obito: "Óbito",
  encerramento_inercia: "Encerramento por inércia",
  encerramento_processo: "Encerramento do processo",
  reabertura: "Reabertura",
  retorno_fluxo_automatico: "Retorno ao fluxo automático",
  monitoramento_automatico_core: "Monitoramento automático CORE",
}
