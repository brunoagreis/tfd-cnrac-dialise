export const PREJUDICIAL_CASE_STATUSES = [
  "ativo",
  "enviado_agendamento",
  "reservado",
  "nao_resolvido_setor",
  "resolvido",
  "encerrado",
] as const
export type PreJudicialCaseStatus = (typeof PREJUDICIAL_CASE_STATUSES)[number]

export const PREJUDICIAL_MOVEMENT_TYPES = [
  "cadastro",
  "interacao",
  "anexo",
  "notificacao_municipio",
  "envio_agendamento_demanda",
  "reserva_agendamento",
  "agendado",
  "nao_agendado",
  "manifestacao_automatica_prazo",
  "retorno_fila",
  "encerramento",
  "reabertura",
] as const
export type PreJudicialMovementType = (typeof PREJUDICIAL_MOVEMENT_TYPES)[number]

export const PREJUDICIAL_QUEUE_REASONS = [
  "novo_cadastro",
  "prazo_critico",
  "prazo_hoje",
  "prazo_vencido",
  "retorno_automatico",
  "reserva_vencendo",
] as const
export type PreJudicialQueueReason = (typeof PREJUDICIAL_QUEUE_REASONS)[number]

export const PREJUDICIAL_SCHEDULING_STATUSES = ["fora_fila", "pendente", "reservado"] as const
export type PreJudicialSchedulingStatus = (typeof PREJUDICIAL_SCHEDULING_STATUSES)[number]

export interface PreJudicialAttachment {
  id: string
  name: string
  category: "documento" | "ficha" | "comprovante" | "interacao" | "outros"
  createdAt: string
  createdById: string
  createdByName: string
  storedName?: string
  relativePath?: string
  url?: string
  mimeType?: string
  size?: number
}

export interface PreJudicialProcedure {
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

export interface PreJudicialCid {
  id: string
  code: string
  description: string
  active: boolean
  createdAt: string
  createdByName: string
}

export interface PreJudicialMovement {
  id: string
  type: PreJudicialMovementType
  description: string
  createdAt: string
  createdById: string
  createdByName: string
  dueAt?: string
  appointmentDate?: string
  attachments: PreJudicialAttachment[]
}


export interface PreJudicialFinalization {
  status: "pendente" | "resolvido" | "bloqueio" | "sequestro" | "obito" | "devolvida"
  createdAt: string
  createdById: string
  createdByName: string
  pendingLocation?: "ses" | "core" | "municipio"
  reason?: string
}

export interface PreJudicialRegistration {
  receivedAt: string
  actionRecords: string
  pgeNetNumber: string
  deadlineDays: number
  deadlineAt: string
  municipalityId: string
  municipalityIbge: string
  municipalityName: string
}

export interface PreJudicialCase {
  id: string
  patientId: string
  patientName: string
  cpf: string
  municipalityName: string
  originModule: "tfd" | "cnrac" | "hemodialise" | "pre_judicial"
  originProtocol: string
  protocolNumber: string
  active: boolean
  status: PreJudicialCaseStatus
  priority: number
  createdAt: string
  updatedAt: string
  deadlineAt: string
  deadlineWarningLevel: "ok" | "warning" | "critical" | "overdue"
  schedulingStatus: PreJudicialSchedulingStatus
  schedulingRequestedAt?: string
  schedulingReservedAt?: string
  schedulingResponseDeadlineAt?: string
  appointmentDate?: string
  procedures: PreJudicialProcedure[]
  cids: PreJudicialCid[]
  attachments: PreJudicialAttachment[]
  movements: PreJudicialMovement[]
  registration?: PreJudicialRegistration
  finalization?: PreJudicialFinalization
}

export interface PreJudicialAuditEvent {
  id: string
  createdAt: string
  userId: string
  userName: string
  action: string
  caseId?: string
  details?: string
}

export const PREJUDICIAL_QUEUE_REASON_LABELS: Record<PreJudicialQueueReason, string> = {
  novo_cadastro: "Novo cadastro",
  prazo_critico: "Prazo crítico",
  prazo_hoje: "Prazo vence hoje",
  prazo_vencido: "Prazo vencido",
  retorno_automatico: "Retorno automático por falta de resposta",
  reserva_vencendo: "Reserva vencendo",
}

export const PREJUDICIAL_STATUS_LABELS: Record<PreJudicialCaseStatus, string> = {
  ativo: "Ativo",
  enviado_agendamento: "Enviado ao Agendamento",
  reservado: "Reservado",
  nao_resolvido_setor: "Não resolvido pelo setor",
  resolvido: "Resolvido",
  encerrado: "Encerrado",
}

export const PREJUDICIAL_MOVEMENT_LABELS: Record<PreJudicialMovementType, string> = {
  cadastro: "Cadastro",
  interacao: "Interação",
  anexo: "Anexo",
  notificacao_municipio: "Notificação ao município",
  envio_agendamento_demanda: "Envio ao Agendamento da Demanda",
  reserva_agendamento: "Reserva de agenda",
  agendado: "Agendado",
  nao_agendado: "Não agendado",
  manifestacao_automatica_prazo: "Manifestação automática por prazo",
  retorno_fila: "Retorno à fila",
  encerramento: "Encerramento",
  reabertura: "Reabertura",
}
