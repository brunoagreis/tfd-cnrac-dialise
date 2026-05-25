"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { useStore } from "@/lib/store-context"
import type { User } from "@/lib/types"
import {
  buildInitialPreJudicialAudit,
  buildInitialPreJudicialCases,
  getPreJudicialCidCatalog,
  getPreJudicialProcedureCatalog,
} from "@/lib/pre-judicial-fake-data"
import type {
  PreJudicialAttachment,
  PreJudicialAuditEvent,
  PreJudicialCase,
  PreJudicialCid,
  PreJudicialMovement,
  PreJudicialProcedure,
  PreJudicialQueueReason,
} from "@/lib/pre-judicial-types"


type AttachmentInput =
  | string
  | {
      name: string
      storedName?: string
      relativePath?: string
      url?: string
      size?: number
      mimeType?: string
    }

interface PreJudicialState {
  cases: PreJudicialCase[]
  auditTrail: PreJudicialAuditEvent[]
}

interface RegisterInteractionInput {
  description: string
  attachmentNames?: AttachmentInput[]
  user: User
}

interface AddProcedureInput {
  sigtapCode: string
  description: string
  user: User
}

interface AddCidInput {
  code: string
  description: string
  user: User
}

interface SendToSchedulingInput {
  description: string
  responseDeadlineAt: string
  attachmentNames?: AttachmentInput[]
  user: User
}

interface FinalizePreJudicialCaseInput {
  status: "pendente" | "resolvido" | "bloqueio" | "sequestro" | "obito" | "devolvida"
  user: User
  pendingLocation?: "ses" | "core" | "municipio"
  reason?: string
}

interface CreatePreJudicialCaseInput {
  patient: { id: string; nome: string; cpf: string }
  user: User
  data: {
    receivedAt: string
    actionRecords: string
    pgeNetNumber: string
    deadlineDays: number
    deadlineAt: string
    municipalityId: string
    municipalityIbge: string
    municipalityName: string
    procedures: Array<{ sigtapCode: string; description: string; specialty: string; subSpecialty: string; situation: "determinado" | "cumprido" | "encerrado" }>
    cids: Array<{ code: string; description: string }>
  }
}

interface SchedulingResponseInput {
  result: "agendado" | "nao_agendado" | "reservado"
  description: string
  appointmentDate?: string
  attachmentNames?: AttachmentInput[]
  user: User
}

interface DailyQueueItem extends PreJudicialCase {
  queueReason: PreJudicialQueueReason
  queuePriorityScore: number
  queueDueLabel: string
}

interface PreJudicialContextType {
  cases: PreJudicialCase[]
  auditTrail: PreJudicialAuditEvent[]
  procedureCatalog: ReturnType<typeof getPreJudicialProcedureCatalog>
  cidCatalog: ReturnType<typeof getPreJudicialCidCatalog>
  getCaseById: (caseId: string) => PreJudicialCase | undefined
  getDailyQueueForUser: (user: User | null | undefined, count?: number) => DailyQueueItem[]
  getSchedulingQueue: () => DailyQueueItem[]
  registerInteraction: (caseId: string, input: RegisterInteractionInput) => void
  createCaseFromPatient: (input: CreatePreJudicialCaseInput) => string
  addProcedure: (caseId: string, input: AddProcedureInput) => void
  toggleProcedure: (caseId: string, procedureId: string, user: User) => void
  addCid: (caseId: string, input: AddCidInput) => void
  toggleCid: (caseId: string, cidId: string, user: User) => void
  sendToScheduling: (caseId: string, input: SendToSchedulingInput) => void
  registerSchedulingResponse: (caseId: string, input: SchedulingResponseInput) => void
  reopenCase: (caseId: string, reason: string, user: User) => void
  closeCase: (caseId: string, reason: string, user: User) => void
  finalizeDemand: (caseId: string, input: FinalizePreJudicialCaseInput) => void
  trackUiAction: (action: string, user: User | null | undefined, caseId?: string, details?: string) => void
}

const LOCAL_KEY = "pre_judicial_module_state_v2"
const STORAGE_MAX_CASES = 80
const STORAGE_MAX_MOVEMENTS = 20
const STORAGE_MAX_ATTACHMENTS = 6
const STORAGE_MAX_MANIFESTATIONS = 10
const STORAGE_MAX_AUDIT = 120
const STORAGE_MAX_TEXT = 1200

function truncateText(value: unknown, max = STORAGE_MAX_TEXT) {
  if (typeof value !== "string") return value
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

function limitArray<T>(value: T[] | undefined | null, max: number): T[] {
  if (!Array.isArray(value)) return []
  return value.slice(-max)
}

function compactAttachment(item: any) {
  if (!item || typeof item !== "object") return item
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    createdAt: item.createdAt,
    createdById: item.createdById,
    createdByName: item.createdByName,
    source: item.source,
    url: item.url,
    relativePath: item.relativePath,
  }
}

function compactMovement(item: any) {
  if (!item || typeof item !== "object") return item
  return {
    ...item,
    description: truncateText(item.description, 800),
    reason: truncateText(item.reason, 500),
    notes: truncateText(item.notes, 500),
    attachments: limitArray(item.attachments, STORAGE_MAX_ATTACHMENTS).map(compactAttachment),
  }
}

function compactManifestation(item: any) {
  if (!item || typeof item !== "object") return item
  return {
    ...item,
    description: truncateText(item.description, 1500),
    attachments: limitArray(item.attachments, STORAGE_MAX_ATTACHMENTS).map(compactAttachment),
  }
}

function compactCase(item: any) {
  if (!item || typeof item !== "object") return item

  return {
    ...item,
    notes: truncateText(item.notes, 1000),
    monitoringNotes: truncateText(item.monitoringNotes, 1000),
    attachments: limitArray(item.attachments, STORAGE_MAX_ATTACHMENTS).map(compactAttachment),
    movements: limitArray(item.movements, STORAGE_MAX_MOVEMENTS).map(compactMovement),
    municipalityManifestations: limitArray(
      item.municipalityManifestations,
      STORAGE_MAX_MANIFESTATIONS
    ).map(compactManifestation),
    coreHistory: limitArray(item.coreHistory, 20),
    processStatusHistory: limitArray(item.processStatusHistory, 20),
    fichas: limitArray(item.fichas, 20),
    procedures: limitArray(item.procedures, 20),
    cids: limitArray(item.cids, 20),
    history: limitArray(item.history, 30),
  }
}

function compactAuditItem(item: any) {
  if (!item || typeof item !== "object") return item
  return {
    id: item.id,
    caseId: item.caseId,
    userId: item.userId,
    userName: item.userName,
    action: item.action,
    createdAt: item.createdAt,
    details: truncateText(item.details, 300),
    page: item.page,
    module: item.module,
  }
}

function compactPreJudicialStateForStorage(state: any) {
  if (!state || typeof state !== "object") return state

  return {
    ...state,
    cases: limitArray(state.cases, STORAGE_MAX_CASES).map(compactCase),
    auditTrail: limitArray(state.auditTrail, STORAGE_MAX_AUDIT).map(compactAuditItem),
    logs: limitArray(state.logs, 80),
    notifications: limitArray(state.notifications, 80),
    queueHistory: limitArray(state.queueHistory, 80),
  }
}

function persistPreJudicialState(LOCAL_KEY: string, state: any) {
  if (typeof window === "undefined") return

  const compactState = compactPreJudicialStateForStorage(state)

  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(compactState))
    return
  } catch (error) {
    console.warn("Falha ao salvar estado completo do Pré Judicial. Tentando versão reduzida.", error)
  }

  try {
    const emergencyState = {
      ...compactState,
      auditTrail: [],
      logs: [],
      notifications: [],
      queueHistory: [],
      cases: limitArray(compactState?.cases, 40).map((item: any) => ({
        ...item,
        movements: limitArray(item?.movements, 8),
        municipalityManifestations: limitArray(item?.municipalityManifestations, 4),
        attachments: limitArray(item?.attachments, 3),
        coreHistory: limitArray(item?.coreHistory, 8),
      })),
    }

    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(emergencyState))
    return
  } catch (finalError) {
    console.warn("Falha ao salvar até a versão reduzida do Pré Judicial. Limpando cache local.", finalError)
    try {
      window.localStorage.removeItem(LOCAL_KEY)
    } catch {
      // ignora
    }
  }
}


const PreJudicialContext = createContext<PreJudicialContextType | null>(null)

function safeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function diffDays(target: string | undefined) {
  if (!target) return 999
  return Math.ceil((new Date(target).getTime() - Date.now()) / 86400000)
}

function dueLabel(target: string | undefined) {
  if (!target) return "Sem prazo"
  const d = diffDays(target)
  if (d < 0) return `${Math.abs(d)} dia(s) em atraso`
  if (d === 0) return "Vence hoje"
  return `${d} dia(s)`
}

function alertLevel(deadlineAt: string): PreJudicialCase["deadlineWarningLevel"] {
  const d = diffDays(deadlineAt)
  if (d < 0) return "overdue"
  if (d <= 2) return "critical"
  if (d <= 5) return "warning"
  return "ok"
}

function normalizeExpiredCases(state: PreJudicialState): PreJudicialState {
  let changed = false
  const nextCases = state.cases.map((item) => {
    const overdue = item.schedulingStatus !== "fora_fila" && item.schedulingResponseDeadlineAt && diffDays(item.schedulingResponseDeadlineAt) < 0
    const alreadyLogged = item.movements.some((mov) => mov.type === "manifestacao_automatica_prazo")
    const nextLevel = alertLevel(item.deadlineAt)
    if (!overdue && item.deadlineWarningLevel === nextLevel) return item
    const updated = { ...item, deadlineWarningLevel: nextLevel }
    if (overdue && !alreadyLogged) {
      changed = true
      updated.status = "nao_resolvido_setor"
      updated.schedulingStatus = "fora_fila"
      updated.updatedAt = new Date().toISOString()
      updated.movements = [
        ...item.movements,
        {
          id: safeId("pre_mov"),
          type: "manifestacao_automatica_prazo",
          description: "Manifestação automática: demanda não resolvida por falta de interação do setor responsável dentro do prazo.",
          createdAt: new Date().toISOString(),
          createdById: "system",
          createdByName: "Sistema",
          attachments: [],
          dueAt: item.schedulingResponseDeadlineAt,
        },
        {
          id: safeId("pre_mov"),
          type: "retorno_fila",
          description: "Caso devolvido automaticamente para a fila do Pré Judicial.",
          createdAt: new Date().toISOString(),
          createdById: "system",
          createdByName: "Sistema",
          attachments: [],
        },
      ]
    }
    if (item.deadlineWarningLevel !== nextLevel) {
      changed = true
    }
    return updated
  })
  if (!changed) return state
  const autoAudit = nextCases.flatMap((item) => item.movements.filter((mov) => ["manifestacao_automatica_prazo", "retorno_fila"].includes(mov.type)).slice(-2).map((mov) => ({
    id: safeId("pre_audit"),
    createdAt: mov.createdAt,
    userId: mov.createdById,
    userName: mov.createdByName,
    caseId: item.id,
    action: mov.type,
    details: mov.description,
  })))
  return { cases: nextCases, auditTrail: [...state.auditTrail, ...autoAudit] }
}

export function PreJudicialProvider({ children }: { children: ReactNode }) {
  const store = useStore()
  const [state, setState] = useState<PreJudicialState>(() => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(LOCAL_KEY)
      if (raw) {
        try {
          return JSON.parse(raw) as PreJudicialState
        } catch {}
      }
    }
    const initialCases = buildInitialPreJudicialCases(store.pacientes, store.demandas, store.unidades, store.users)
    return {
      cases: initialCases,
      auditTrail: buildInitialPreJudicialAudit(initialCases, store.users),
    }
  })

  useEffect(() => {
    setState((prev) => normalizeExpiredCases(prev))
  }, [])

useEffect(() => {
  if (typeof window === "undefined") return
  persistPreJudicialState(LOCAL_KEY, state)
}, [state])

  const procedureCatalog = useMemo(() => getPreJudicialProcedureCatalog(), [])
  const cidCatalog = useMemo(() => getPreJudicialCidCatalog(), [])

  function trackUiAction(action: string, user: User | null | undefined, caseId?: string, details?: string) {
    if (!user) return
    setState((prev) => ({
      ...prev,
      auditTrail: [...prev.auditTrail, {
        id: safeId("pre_audit"),
        createdAt: new Date().toISOString(),
        userId: user.id,
        userName: user.nome,
        action,
        caseId,
        details,
      }],
    }))
  }


function createCaseFromPatient(input: CreatePreJudicialCaseInput) {
  const protocolNumber = `PRE-${new Date().getFullYear()}-${String(state.cases.filter((item) => item.originModule === "pre_judicial").length + 1).padStart(5, "0")}`
  const createdAt = new Date().toISOString()
  const createdId = safeId("pre_case")

  setState((prev) => ({
    ...prev,
    cases: [
      {
        id: createdId,
        patientId: input.patient.id,
        patientName: input.patient.nome,
        cpf: input.patient.cpf,
        municipalityName: input.data.municipalityName,
        originModule: "pre_judicial",
        originProtocol: protocolNumber,
        protocolNumber,
        active: true,
        status: "ativo",
        priority: 100,
        createdAt,
        updatedAt: createdAt,
        deadlineAt: input.data.deadlineAt,
        deadlineWarningLevel: alertLevel(input.data.deadlineAt),
        schedulingStatus: "fora_fila",
        procedures: input.data.procedures.map((item) => ({
          id: safeId("pre_proc"),
          sigtapCode: item.sigtapCode,
          description: item.description,
          specialty: item.specialty,
          subSpecialty: item.subSpecialty,
          situation: item.situation,
          active: true,
          createdAt,
          createdByName: input.user.nome,
        })),
        cids: input.data.cids.map((item) => ({
          id: safeId("pre_cid"),
          code: item.code,
          description: item.description,
          active: true,
          createdAt,
          createdByName: input.user.nome,
        })),
        attachments: [],
        movements: [{
          id: safeId("pre_mov"),
          type: "cadastro",
          description: `Cadastro inicial do pré judicial. PGE.net: ${input.data.pgeNetNumber}. Prazo final: ${new Date(`${input.data.deadlineAt}T00:00:00`).toLocaleDateString("pt-BR")}.`,
          createdAt,
          createdById: input.user.id,
          createdByName: input.user.nome,
          attachments: [],
          dueAt: input.data.deadlineAt,
        }],
        registration: {
          receivedAt: input.data.receivedAt,
          actionRecords: input.data.actionRecords,
          pgeNetNumber: input.data.pgeNetNumber,
          deadlineDays: input.data.deadlineDays,
          deadlineAt: input.data.deadlineAt,
          municipalityId: input.data.municipalityId,
          municipalityIbge: input.data.municipalityIbge,
          municipalityName: input.data.municipalityName,
        },
      },
      ...prev.cases,
    ],
    auditTrail: [
      ...prev.auditTrail,
      {
        id: safeId("pre_audit"),
        createdAt,
        userId: input.user.id,
        userName: input.user.nome,
        caseId: createdId,
        action: "create_case_from_patient",
        details: protocolNumber,
      },
    ],
  }))

  return createdId
}

  function updateCase(caseId: string, updater: (item: PreJudicialCase) => PreJudicialCase, audit?: (item: PreJudicialCase) => PreJudicialAuditEvent[]) {
    setState((prev) => {
      let target: PreJudicialCase | undefined
      const cases = prev.cases.map((item) => {
        if (item.id !== caseId) return item
        target = updater(item)
        return target
      })
      const extraAudit = target && audit ? audit(target) : []
      return { ...prev, cases, auditTrail: [...prev.auditTrail, ...extraAudit] }
    })
  }

  function appendMovement(item: PreJudicialCase, user: User, type: PreJudicialMovement["type"], description: string, attachmentNames: AttachmentInput[] = [], extras: Partial<PreJudicialMovement> = {}) {
    const attachments: PreJudicialAttachment[] = attachmentNames.filter(Boolean).map((raw) => {
      const meta = typeof raw === "string" ? { name: raw } : raw
      return {
        id: safeId("pre_att"),
        name: meta.name,
        category: "interacao",
        createdAt: new Date().toISOString(),
        createdById: user.id,
        createdByName: user.nome,
        storedName: meta.storedName,
        relativePath: meta.relativePath,
        url: meta.url ?? (meta.relativePath ? `/api/files/${meta.relativePath}` : undefined),
        mimeType: meta.mimeType,
        size: meta.size,
      }
    })
    return {
      ...item,
      updatedAt: new Date().toISOString(),
      deadlineWarningLevel: alertLevel(item.deadlineAt),
      movements: [...item.movements, {
        id: safeId("pre_mov"),
        type,
        description,
        createdAt: new Date().toISOString(),
        createdById: user.id,
        createdByName: user.nome,
        attachments,
        ...extras,
      }],
    }
  }

  function getCaseById(caseId: string) {
    return state.cases.find((item) => item.id === caseId)
  }

  function buildQueueItem(item: PreJudicialCase): DailyQueueItem {
    const deadlineDays = diffDays(item.deadlineAt)
    let queueReason: PreJudicialQueueReason = "novo_cadastro"
    let queuePriorityScore = item.priority

    if (item.schedulingStatus === "reservado" && item.schedulingResponseDeadlineAt && diffDays(item.schedulingResponseDeadlineAt) <= 2) {
      queueReason = "reserva_vencendo"
      queuePriorityScore += 85
    } else if (deadlineDays < 0) {
      queueReason = item.movements.some((mov) => mov.type === "manifestacao_automatica_prazo") ? "retorno_automatico" : "prazo_vencido"
      queuePriorityScore += 100
    } else if (deadlineDays === 0) {
      queueReason = "prazo_hoje"
      queuePriorityScore += 80
    } else if (deadlineDays <= 2) {
      queueReason = "prazo_critico"
      queuePriorityScore += 60
    }

    return {
      ...item,
      queueReason,
      queuePriorityScore,
      queueDueLabel: dueLabel(item.deadlineAt),
    }
  }

  function getDailyQueueForUser(_user: User | null | undefined, count = 30) {
    return state.cases
      .filter((item) => item.active && item.status !== "encerrado" && item.schedulingStatus !== "pendente")
      .map(buildQueueItem)
      .sort((a, b) => b.queuePriorityScore - a.queuePriorityScore)
      .slice(0, count)
  }

  function getSchedulingQueue() {
    return state.cases
      .filter((item) => item.active && item.schedulingStatus !== "fora_fila")
      .map(buildQueueItem)
      .sort((a, b) => b.queuePriorityScore - a.queuePriorityScore)
  }

  function registerInteraction(caseId: string, input: RegisterInteractionInput) {
    updateCase(caseId, (item) => appendMovement(item, input.user, "interacao", input.description, input.attachmentNames), (item) => [{
      id: safeId("pre_audit"),
      createdAt: new Date().toISOString(),
      userId: input.user.id,
      userName: input.user.nome,
      caseId: item.id,
      action: "interacao",
      details: input.description,
    }])
  }

  function addProcedure(caseId: string, input: AddProcedureInput) {
    updateCase(caseId, (item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
      procedures: [...item.procedures, {
        id: safeId("pre_proc"),
        sigtapCode: input.sigtapCode,
        description: input.description,
        active: true,
        createdAt: new Date().toISOString(),
        createdByName: input.user.nome,
      }],
    }), (item) => [{ id: safeId("pre_audit"), createdAt: new Date().toISOString(), userId: input.user.id, userName: input.user.nome, caseId: item.id, action: "add_procedure", details: `${input.sigtapCode} - ${input.description}` }])
  }

  function toggleProcedure(caseId: string, procedureId: string, user: User) {
    updateCase(caseId, (item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
      procedures: item.procedures.map((proc) => proc.id === procedureId ? { ...proc, active: !proc.active } : proc),
    }), (item) => [{ id: safeId("pre_audit"), createdAt: new Date().toISOString(), userId: user.id, userName: user.nome, caseId: item.id, action: "toggle_procedure" }])
  }

  function addCid(caseId: string, input: AddCidInput) {
    updateCase(caseId, (item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
      cids: [...item.cids, {
        id: safeId("pre_cid"),
        code: input.code,
        description: input.description,
        active: true,
        createdAt: new Date().toISOString(),
        createdByName: input.user.nome,
      }],
    }), (item) => [{ id: safeId("pre_audit"), createdAt: new Date().toISOString(), userId: input.user.id, userName: input.user.nome, caseId: item.id, action: "add_cid", details: `${input.code} - ${input.description}` }])
  }

  function toggleCid(caseId: string, cidId: string, user: User) {
    updateCase(caseId, (item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
      cids: item.cids.map((cid) => cid.id === cidId ? { ...cid, active: !cid.active } : cid),
    }), (item) => [{ id: safeId("pre_audit"), createdAt: new Date().toISOString(), userId: user.id, userName: user.nome, caseId: item.id, action: "toggle_cid" }])
  }

  function sendToScheduling(caseId: string, input: SendToSchedulingInput) {
    updateCase(caseId, (item) => appendMovement({
      ...item,
      status: "enviado_agendamento",
      schedulingStatus: "pendente",
      schedulingRequestedAt: new Date().toISOString(),
      schedulingResponseDeadlineAt: input.responseDeadlineAt,
      deadlineAt: input.responseDeadlineAt,
    }, input.user, "envio_agendamento_demanda", input.description, input.attachmentNames ?? [], { dueAt: input.responseDeadlineAt }), (item) => [{
      id: safeId("pre_audit"),
      createdAt: new Date().toISOString(),
      userId: input.user.id,
      userName: input.user.nome,
      caseId: item.id,
      action: "send_to_scheduling",
      details: `Prazo: ${new Date(input.responseDeadlineAt).toLocaleString("pt-BR")}`,
    }])
  }

  function registerSchedulingResponse(caseId: string, input: SchedulingResponseInput) {
    updateCase(caseId, (item) => {
      const base = appendMovement(item, input.user, input.result === "agendado" ? "agendado" : input.result === "reservado" ? "reserva_agendamento" : "nao_agendado", input.description, input.attachmentNames, { appointmentDate: input.appointmentDate })
      if (input.result === "agendado") {
        return { ...base, status: "resolvido", schedulingStatus: "fora_fila", appointmentDate: input.appointmentDate }
      }
      if (input.result === "reservado") {
        return { ...base, status: "reservado", schedulingStatus: "reservado", schedulingReservedAt: new Date().toISOString() }
      }
      return { ...base, status: "ativo", schedulingStatus: "fora_fila" }
    }, (item) => [{ id: safeId("pre_audit"), createdAt: new Date().toISOString(), userId: input.user.id, userName: input.user.nome, caseId: item.id, action: "scheduling_response", details: input.description }])
  }

  function reopenCase(caseId: string, reason: string, user: User) {
    updateCase(caseId, (item) => appendMovement({ ...item, active: true, status: "ativo" }, user, "reabertura", reason), (item) => [{ id: safeId("pre_audit"), createdAt: new Date().toISOString(), userId: user.id, userName: user.nome, caseId: item.id, action: "reopen", details: reason }])
  }

  function closeCase(caseId: string, reason: string, user: User) {
    updateCase(caseId, (item) => appendMovement({ ...item, active: false, status: "encerrado" }, user, "encerramento", reason), (item) => [{ id: safeId("pre_audit"), createdAt: new Date().toISOString(), userId: user.id, userName: user.nome, caseId: item.id, action: "close", details: reason }])
  }


  function finalizeDemand(caseId: string, input: FinalizePreJudicialCaseInput) {
    updateCase(caseId, (item) => appendMovement({
      ...item,
      active: false,
      status: input.status === "resolvido" ? "resolvido" : "encerrado",
      finalization: {
        status: input.status,
        createdAt: new Date().toISOString(),
        createdById: input.user.id,
        createdByName: input.user.nome,
        pendingLocation: input.pendingLocation,
        reason: input.reason,
      },
    }, input.user, "encerramento", [`Finalização: ${input.status}`, input.pendingLocation ? `Pendência: ${input.pendingLocation}` : "", input.reason || ""].filter(Boolean).join(" • ")), (item) => [{
      id: safeId("pre_audit"),
      createdAt: new Date().toISOString(),
      userId: input.user.id,
      userName: input.user.nome,
      caseId: item.id,
      action: "finalizacao_demanda",
      details: `${input.status}${input.pendingLocation ? ` • ${input.pendingLocation}` : ""}${input.reason ? ` • ${input.reason}` : ""}`,
    }])
  }

  const value = useMemo<PreJudicialContextType>(() => ({
    cases: state.cases,
    auditTrail: state.auditTrail,
    procedureCatalog,
    cidCatalog,
    getCaseById,
    getDailyQueueForUser,
    getSchedulingQueue,
    registerInteraction,
    createCaseFromPatient,
    addProcedure,
    toggleProcedure,
    addCid,
    toggleCid,
    sendToScheduling,
    registerSchedulingResponse,
    reopenCase,
    closeCase,
    finalizeDemand,
    trackUiAction,
  }), [state, procedureCatalog, cidCatalog])

  return <PreJudicialContext.Provider value={value}>{children}</PreJudicialContext.Provider>
}

export function usePreJudicial() {
  const ctx = useContext(PreJudicialContext)
  if (!ctx) throw new Error("usePreJudicial must be used within PreJudicialProvider")
  return ctx
}
