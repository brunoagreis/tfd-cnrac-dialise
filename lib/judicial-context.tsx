"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { useStore } from "@/lib/store-context"
import type { User } from "@/lib/types"
import {
  buildInitialAgendaOffers,
  buildInitialAudit,
  buildInitialCases,
  buildInitialContacts,
  buildInitialCoreRows,
  buildInitialTemplates,
  getCidCatalog,
  getProcedureCatalog,
} from "@/lib/judicial-fake-data"
import type {
  AgendaOffer,
  CoreRow,
  CoreTable,
  EmailTemplate,
  JudicialAttachment,
  JudicialCase,
  JudicialFicha,
  JudicialMovement,
  MunicipalityContact,
  PriorityFocus,
  PriorityFocusItem,
  QueueReason,
  UiAuditEvent,
  JudicialProcessStatusEntry,
  JudicialFinalization,
} from "@/lib/judicial-types"

interface JudicialState {
  cases: JudicialCase[]
  municipalityContacts: MunicipalityContact[]
  emailTemplates: EmailTemplate[]
  coreRows: CoreRow[]
  agendaOffers: AgendaOffer[]
  auditTrail: UiAuditEvent[]
  priorityFocus: PriorityFocus
}

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

interface RegisterMovementInput {
  type: JudicialMovement["type"]
  description: string
  user: User
  appointmentDate?: string
  stateAmount?: number
  municipalityAmount?: number
  responseRequestedAt?: string
  attachments?: AttachmentInput[]
}

interface AddFichaInput {
  system: JudicialFicha["system"]
  number?: string
  requestedInclusion: boolean
  hasJudicialMark: boolean
  attachmentName?: string
  attachmentUrl?: string
  attachmentRelativePath?: string
  notes: string
  user: User
}

interface AddProcedureInput {
  sigtapCode: string
  description: string
  specialty?: string
  subSpecialty?: string
  user: User
}

interface AddCidInput {
  code: string
  description: string
  user: User
}

interface ManifestationInput {
  description: string
  attachmentNames?: AttachmentInput[]
  user: User
}

interface FinalizeCaseInput {
  status: "pendente" | "resolvido" | "bloqueio" | "sequestro" | "obito" | "devolvida"
  user: User
  pendingLocation?: "ses" | "core" | "municipio"
  reason?: string
}

interface UpdateProcedureStatusInput {
  procedureId: string
  status: "atendido" | "regulado" | "nao_realizado_rede_sus" | "ausente"
  reason: string
  user: User
}

interface UpdateFichaStatusInput {
  fichaId: string
  status: "atendido" | "falta" | "obito" | "inativa"
  reason: string
  user: User
}

interface RegisterProcessStatusInput {
  status: "em_andamento" | "descumprimento" | "decisao_judicial_prazo"
  user: User
  reason?: string
  deadlineType?: "dias" | "horas"
  deadlineValue?: number
}

interface CreateJudicialCaseInput {
  patient: { id: string; nome: string; cpf: string }
  user: User
  data: {
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
    procedures: Array<{
      sigtapCode: string
      description: string
      specialty: string
      subSpecialty: string
      situation: "determinado" | "cumprido" | "encerrado"
    }>
    cids: Array<{ code: string; description: string }>
  }
}

interface SchedulingResultInput {
  result: "agendado" | "nao_agendado" | "reservado"
  description: string
  appointmentDate?: string
  reason?: string
  attachmentNames?: string[]
  user: User
}

interface DailyQueueItem extends JudicialCase {
  queueReason: QueueReason
  queuePriorityScore: number
  queueDueLabel: string
  queueDueAt?: string
  pendingMunicipalityAction: boolean
  priorityHighlights: PriorityFocusItem[]
}

interface JudicialContextType {
  cases: JudicialCase[]
  municipalityContacts: MunicipalityContact[]
  emailTemplates: EmailTemplate[]
  coreRows: CoreRow[]
  agendaOffers: AgendaOffer[]
  auditTrail: UiAuditEvent[]
  priorityFocus: PriorityFocus
  procedureCatalog: ReturnType<typeof getProcedureCatalog>
  cidCatalog: ReturnType<typeof getCidCatalog>
  getCaseById: (caseId: string) => JudicialCase | undefined
  getDailyQueueForUser: (user: User | null | undefined, count?: number) => DailyQueueItem[]
  getSchedulingQueue: () => DailyQueueItem[]
  getMunicipalityCases: (user: User | null | undefined) => DailyQueueItem[]
  registerMovement: (caseId: string, input: RegisterMovementInput) => void
  addFicha: (caseId: string, input: AddFichaInput) => void
  updateFicha: (caseId: string, fichaId: string, input: AddFichaInput) => void
  toggleFicha: (caseId: string, fichaId: string, user: User, reason?: string) => void
  addProcedure: (caseId: string, input: AddProcedureInput) => void
  toggleProcedure: (caseId: string, procedureId: string, user: User) => void
  addCid: (caseId: string, input: AddCidInput) => void
  toggleCid: (caseId: string, cidId: string, user: User) => void
  addMunicipalityManifestation: (caseId: string, input: ManifestationInput) => void
  finalizeDemand: (caseId: string, input: FinalizeCaseInput) => void
  updateProcedureStatus: (caseId: string, input: UpdateProcedureStatusInput) => void
  updateFichaStatus: (caseId: string, input: UpdateFichaStatusInput) => void
  addProcessNumber: (caseId: string, processNumber: string, user: User) => void
  registerProcessStatus: (caseId: string, input: RegisterProcessStatusInput) => void
  createCaseFromPatient: (input: CreateJudicialCaseInput) => string
  sendToScheduling: (caseId: string, description: string, user: User) => void
  registerSchedulingResult: (caseId: string, input: SchedulingResultInput) => void
  reopenCase: (caseId: string, reason: string, user: User) => void
  closeCase: (caseId: string, reason: string, user: User) => void
  closeForInertia: (caseId: string, reason: string, user: User) => void
  returnToAutomaticMonitoring: (caseId: string, reason: string, user: User) => void
  upsertMunicipalityContact: (input: MunicipalityContact) => void
  upsertEmailTemplate: (input: EmailTemplate) => void
  setPriorityFocus: (focus: PriorityFocus) => void
  importCoreTable: (
    table: CoreTable,
    rows: Omit<CoreRow, "id" | "table" | "importedAt">[],
  ) => void
  importAgendaOffers: (rows: Omit<AgendaOffer, "id" | "importedAt">[]) => void
  runAutomaticCoreScan: (user?: User | null) => void
  trackUiAction: (
    action: string,
    user: User | null | undefined,
    caseId?: string,
    details?: string,
  ) => void
  getSeizureSummary: () => {
    totalState: number
    byMunicipality: Array<{ municipality: string; total: number }>
  }
}

const LOCAL_KEY = "judicial_module_state_v2"
const JudicialContext = createContext<JudicialContextType | undefined>(undefined)

function safeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function addDays(baseDate: string | Date, days: number) {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + days)
  return d
}

function daysBetween(from: string | Date, to: string | Date) {
  const a = new Date(from)
  const b = new Date(to)
  const ms = b.getTime() - a.getTime()
  return Math.floor(ms / 86400000)
}

function makeAudit(user: User, action: string, caseId?: string, details?: string): UiAuditEvent {
  return {
    id: safeId("audit"),
    createdAt: new Date().toISOString(),
    userId: user.id,
    userName: user.nome,
    action,
    caseId,
    details,
  }
}

function makeAttachmentNames(
  items: AttachmentInput[] | undefined,
  user: User,
  source: JudicialAttachment["source"],
): JudicialAttachment[] {
  return (items ?? []).filter(Boolean).map((item) => {
    const meta = typeof item === "string" ? { name: item } : item
    return {
      id: safeId("att"),
      name: meta.name,
      category: "outros",
      createdAt: new Date().toISOString(),
      createdById: user.id,
      createdByName: user.nome,
      source,
      storedName: meta.storedName,
      relativePath: meta.relativePath,
      url: meta.url ?? (meta.relativePath ? `/api/files/${meta.relativePath}` : undefined),
      mimeType: meta.mimeType,
      size: meta.size,
    }
  })
}

function getRequestReferenceDate(caseItem: JudicialCase) {
  const solicitation = [...caseItem.movements]
    .reverse()
    .find((m) => ["solicitacao_inclusao", "reiteracao"].includes(m.type))
  return solicitation?.responseRequestedAt ?? solicitation?.createdAt
}

function normalizeProcedureCode(value: string) {
  return String(value ?? "").replace(/\D/g, "")
}

function normalizeCidCode(value: string) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

function isPriorityItemActive(item: PriorityFocusItem, now = new Date()) {
  if (!item.expiresAt) return true
  const expiresAt =
    item.expiresAt.length <= 10
      ? new Date(`${item.expiresAt}T23:59:59.999`)
      : new Date(item.expiresAt)
  return expiresAt >= now
}

function buildLegacyPriorityItems(priorityFocus: PriorityFocus): PriorityFocusItem[] {
  if (priorityFocus.mode === "none" || !priorityFocus.value) return []
  return [
    {
      id: `legacy_${priorityFocus.mode}_${priorityFocus.value}`,
      mode: priorityFocus.mode,
      value: priorityFocus.value,
      label: priorityFocus.label ?? priorityFocus.value,
      createdAt: new Date(0).toISOString(),
    },
  ]
}

function migratePriorityFocus(priorityFocus?: PriorityFocus | null): PriorityFocus {
  if (!priorityFocus) {
    return { mode: "none", items: [] }
  }

  const items = Array.isArray(priorityFocus.items)
    ? priorityFocus.items
        .filter(
          (item): item is PriorityFocusItem =>
            !!item &&
            (item.mode === "procedure" || item.mode === "cid") &&
            !!item.value,
        )
        .map((item) => ({
          id: item.id || safeId("prio"),
          mode: item.mode,
          value: item.value,
          label: item.label || item.value,
          expiresAt: item.expiresAt,
          createdAt: item.createdAt || new Date().toISOString(),
        }))
    : buildLegacyPriorityItems(priorityFocus)

  return {
    mode:
      priorityFocus.mode === "procedure" || priorityFocus.mode === "cid"
        ? priorityFocus.mode
        : items[0]?.mode ?? "none",
    value: priorityFocus.value,
    label: priorityFocus.label,
    items,
  }
}

function getActivePriorityItems(priorityFocus: PriorityFocus, now = new Date()) {
  const focus = migratePriorityFocus(priorityFocus)
  return focus.items?.filter((item) => isPriorityItemActive(item, now)) ?? []
}

function caseMatchesPriorityItem(caseItem: JudicialCase, item: PriorityFocusItem) {
  if (item.mode === "procedure") {
    const target = normalizeProcedureCode(item.value)
    if (!target) return false

    return caseItem.procedures.some((procedure) => {
      if (procedure.active === false) return false
      const procedureCode = normalizeProcedureCode(procedure.sigtapCode)
      return !!procedureCode && (procedureCode.includes(target) || target.includes(procedureCode))
    })
  }

  const target = normalizeCidCode(item.value)
  if (!target) return false

  return caseItem.cids.some((cid) => {
    if (cid.active === false) return false
    const cidCode = normalizeCidCode(cid.code)
    return !!cidCode && (cidCode.includes(target) || target.includes(cidCode))
  })
}

function enrichCase(caseItem: JudicialCase, priorityFocus: PriorityFocus) {
  const now = new Date()

  const pendingMunicipalityAction = (() => {
    const requestDate = getRequestReferenceDate(caseItem)
    if (!requestDate) return false
    const lastManifest = [...caseItem.municipalityManifestations].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0]
    return !lastManifest || new Date(lastManifest.createdAt) < new Date(requestDate)
  })()

  let queueReason: QueueReason = "monitoramento"
  let queuePriorityScore = caseItem.priority
  let queueDueAt: string | undefined

  if (caseItem.schedulingStatus !== "fora_fila") {
    const reference = caseItem.schedulingReservedAt ?? caseItem.schedulingRequestedAt
    if (reference) {
      const age = daysBetween(reference, now)
      if (caseItem.schedulingStatus === "reservado" && age >= 10) {
        queueReason = "obrigacao_municipio"
        queuePriorityScore += 45
      } else if (caseItem.schedulingStatus === "pendente" && age >= 10) {
        queueReason = "monitoramento"
        queuePriorityScore += 40
      }
    }
  }

  if (caseItem.appointmentDate) {
    const afterAppointment = addDays(caseItem.appointmentDate, 2)
    if (now >= afterAppointment && caseItem.status !== "cumprido") {
      queueReason = "paciente_agendado_verificar"
      queuePriorityScore += 60
      queueDueAt = afterAppointment.toISOString()
    }
  }

  if (pendingMunicipalityAction) {
    const requestDate = getRequestReferenceDate(caseItem)
    if (requestDate) {
      const age = daysBetween(requestDate, now)

      if (age >= 15) {
        queueReason = "inercia_municipio"
        queuePriorityScore += 120
      } else if (age >= 10) {
        queueReason = "2_reiteracao_municipio"
        queuePriorityScore += 95
        queueDueAt = addDays(requestDate, 10).toISOString()
      } else if (age >= 5) {
        queueReason = "1_reiteracao_municipio"
        queuePriorityScore += 85
        queueDueAt = addDays(requestDate, 5).toISOString()
      }
    }
  }

  if (caseItem.movements.some((m) => m.type === "descumprimento")) {
    queuePriorityScore += 70
  }

  if (
    caseItem.monitoringMode === "automatic_core" &&
    caseItem.coreHistory.some((r) => !!r.appointmentDate)
  ) {
    queueReason = "confirmacao_core_automatica"
    queuePriorityScore += 80
  }

  const lastMon = caseItem.lastMonitoredAt ? new Date(caseItem.lastMonitoredAt) : undefined
  if (!caseItem.lastMonitoredAt || (lastMon && daysBetween(lastMon, now) >= 30)) {
    queuePriorityScore += 30
    queueDueAt = queueDueAt ?? addDays(caseItem.lastMonitoredAt ?? caseItem.lastMovementAt, 30).toISOString()
  }

  const priorityHighlights = getActivePriorityItems(priorityFocus, now).filter((item) =>
    caseMatchesPriorityItem(caseItem, item),
  )

  if (priorityHighlights.length > 0) {
    queuePriorityScore += priorityHighlights.length * 150
  }

  const queueDueLabel = queueDueAt
    ? new Date(queueDueAt).toLocaleString("pt-BR")
    : caseItem.appointmentDate
      ? new Date(caseItem.appointmentDate).toLocaleDateString("pt-BR")
      : "Sem prazo crítico"

  return {
    ...caseItem,
    queueReason,
    queuePriorityScore,
    queueDueLabel,
    queueDueAt,
    pendingMunicipalityAction,
    priorityHighlights,
  }
}

export function JudicialProvider({ children }: { children: ReactNode }) {
  const store = useStore()
  const [state, setState] = useState<JudicialState | null>(null)

  useEffect(() => {
    if (state) return
    if (typeof window === "undefined") return

    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as JudicialState
        setState({
          ...parsed,
          priorityFocus: migratePriorityFocus(parsed.priorityFocus),
        })
        return
      }
    } catch {
      // ignore
    }

    const initialCases = buildInitialCases(
      store.pacientes,
      store.demandas,
      store.unidades,
      store.users,
    )

    const initialState: JudicialState = {
      cases: initialCases,
      municipalityContacts: buildInitialContacts(store.pacientes, store.unidades),
      emailTemplates: buildInitialTemplates(),
      coreRows: buildInitialCoreRows(initialCases),
      agendaOffers: buildInitialAgendaOffers(),
      auditTrail: buildInitialAudit(store.users),
      priorityFocus: { mode: "none", items: [] },
    }

    setState(initialState)
  }, [state, store.demandas, store.pacientes, store.unidades, store.users])

  useEffect(() => {
    if (!state || typeof window === "undefined") return
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  }, [state])

  const update = (updater: (prev: JudicialState) => JudicialState) => {
    setState((prev) => (prev ? updater(prev) : prev))
  }

  const getCaseById = (caseId: string) => state?.cases.find((c) => c.id === caseId)

  const createCaseFromPatient = (input: CreateJudicialCaseInput) => {
    let createdId = ""

    update((prev) => {
      const year = new Date().getFullYear()
      const count = prev.cases.filter((item) => item.originModule === "judicial").length + 1
      const protocol = `JUD-${year}-${String(count).padStart(5, "0")}`
      const now = new Date().toISOString()
      createdId = safeId("jud_case")

      const createdCase: JudicialCase = {
        id: createdId,
        patientId: input.patient.id,
        patientName: input.patient.nome,
        cpf: input.patient.cpf,
        municipalityName: input.data.municipalityName,
        originModule: "judicial" as const,
        originProtocol: protocol,
        processNumber:
          input.data.actionRecords
            .split(/[,;\n]+/)
            .map((item) => item.trim())
            .filter(Boolean)[0] ?? input.data.actionRecords,
        processNumbers: input.data.actionRecords
          .split(/[,;\n]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        active: true,
        status: "ativo" as const,
        priority: 100,
        lastMonitoredAt: now,
        lastMovementAt: now,
        monitoringMode: "humano" as const,
        monitoringModeReason: "Cadastro inicial realizado na página de pacientes.",
        schedulingStatus: "fora_fila" as const,
        procedures: input.data.procedures.map((item) => ({
          id: safeId("jud_proc"),
          sigtapCode: item.sigtapCode,
          description: item.description,
          specialty: item.specialty,
          subSpecialty: item.subSpecialty,
          situation: item.situation,
          active: true,
          createdAt: now,
          createdByName: input.user.nome,
        })),
        cids: input.data.cids.map((item) => ({
          id: safeId("jud_cid"),
          code: item.code,
          description: item.description,
          active: true,
          createdAt: now,
          createdByName: input.user.nome,
        })),
        fichas: [],
        attachments: [],
        movements: [
          {
            id: safeId("jud_mov"),
            type: "monitoramento" as const,
            description: `Cadastro inicial da ação judicial. Ofício/Intimação: ${input.data.oficioNumber}. PGE.net: ${input.data.pgeNetNumber}. Prazo final: ${new Date(`${input.data.deadlineAt}T00:00:00`).toLocaleDateString("pt-BR")}.`,
            createdAt: now,
            createdById: input.user.id,
            createdByName: input.user.nome,
            attachments: [],
          },
        ],
        municipalityManifestations: [],
        coreHistory: [],
        processStatusHistory: [
          {
            id: safeId("proc_status"),
            status: "em_andamento" as const,
            createdAt: now,
            createdById: input.user.id,
            createdByName: input.user.nome,
            reason: "Cadastro inicial do processo judicial.",
          },
        ],
        registration: {
          isIntimation: input.data.isIntimation,
          oficioNumber: input.data.oficioNumber,
          receivedAt: input.data.receivedAt,
          reiterationAt: input.data.reiterationAt,
          actionRecords: input.data.actionRecords,
          pgeNetNumber: input.data.pgeNetNumber,
          deadlineDays: input.data.deadlineDays,
          deadlineAt: input.data.deadlineAt,
          municipalityId: input.data.municipalityId,
          municipalityIbge: input.data.municipalityIbge,
          municipalityName: input.data.municipalityName,
        },
      }

      return {
        ...prev,
        cases: [createdCase, ...prev.cases],
        auditTrail: [
          ...prev.auditTrail,
          makeAudit(input.user, "create_case_from_patient", createdId, protocol),
        ],
      }
    })

    return createdId
  }

  const procedureCatalog = getProcedureCatalog()
  const cidCatalog = getCidCatalog()

  const getDailyQueueForUser = (
    user: User | null | undefined,
    count = 30,
  ): DailyQueueItem[] => {
    if (!state || !user || user.role === "UNIDADE_HOSPITALAR") return []

    const dueCases = state.cases
      .filter((c) => c.active !== false && c.status !== "encerrado" && c.status !== "cumprido")
      .filter(
        (c) =>
          !(
            c.schedulingStatus !== "fora_fila" &&
            ((c.schedulingRequestedAt &&
              daysBetween(c.schedulingRequestedAt, new Date()) < 10) ||
              (c.schedulingReservedAt &&
                daysBetween(c.schedulingReservedAt, new Date()) < 10))
          ),
      )
      .map((c) => enrichCase(c, state.priorityFocus))
      .sort((a, b) => {
        if (b.queuePriorityScore !== a.queuePriorityScore) {
          return b.queuePriorityScore - a.queuePriorityScore
        }
        return (a.lastMonitoredAt ?? a.lastMovementAt).localeCompare(
          b.lastMonitoredAt ?? b.lastMovementAt,
        )
      })

    const monitorUsers = store.users.filter((u) =>
      ["ADMIN", "MEDICO_SES", "REGULADOR", "OPERADOR"].includes(u.role),
    )
    const index = Math.max(0, monitorUsers.findIndex((u) => u.id === user.id))
    const assigned = dueCases.filter((_, i) => i % Math.max(1, monitorUsers.length) === index)

    return assigned.slice(0, count)
  }

  const getSchedulingQueue = () => {
    if (!state) return []

    return state.cases
      .filter((c) => c.active !== false && c.status !== "encerrado" && c.status !== "cumprido")
      .filter((c) => c.schedulingStatus !== "fora_fila")
      .map((c) => enrichCase(c, state.priorityFocus))
      .sort((a, b) => (b.schedulingRequestedAt ?? "").localeCompare(a.schedulingRequestedAt ?? ""))
  }

  const getMunicipalityCases = (user: User | null | undefined) => {
    if (!state || !user || user.role !== "UNIDADE_HOSPITALAR") return []

    return state.cases
      .filter((c) => c.active !== false)
      .map((c) => enrichCase(c, state.priorityFocus))
      .filter((c) => {
        const contact = state.municipalityContacts.find(
          (m) => m.municipalityName === c.municipalityName,
        )
        return c.municipalityName === user.unidadeNome || contact?.emails.includes(user.email)
      })
  }

  const registerMovement = (caseId: string, input: RegisterMovementInput) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) => {
        if (caseItem.id !== caseId) return caseItem

        const attachments = makeAttachmentNames(input.attachments, input.user, "movimentacao")

        const movement: JudicialMovement = {
          id: safeId("mov"),
          type: input.type,
          description: input.description,
          createdAt: new Date().toISOString(),
          createdById: input.user.id,
          createdByName: input.user.nome,
          appointmentDate: input.appointmentDate,
          stateAmount: input.stateAmount,
          municipalityAmount: input.municipalityAmount,
          responseRequestedAt: input.responseRequestedAt,
          attachments,
        }

        const next: JudicialCase = {
          ...caseItem,
          lastMovementAt: movement.createdAt,
          lastMonitoredAt: [
            "monitoramento",
            "descumprimento",
            "agendamento",
            "cumprimento",
            "bloqueio",
            "sequestro",
            "falta_paciente",
            "obito",
          ].includes(input.type)
            ? movement.createdAt
            : caseItem.lastMonitoredAt,
          movements: [...caseItem.movements, movement],
          attachments: [...caseItem.attachments, ...attachments],
        }

        if (input.type === "agendamento" && input.appointmentDate) {
          next.status = "agendado"
          next.appointmentDate = input.appointmentDate
          next.appointmentConfirmedAt = movement.createdAt
          next.schedulingStatus = "fora_fila"
        } else if (input.type === "envio_agendamento_demanda") {
          next.status = "aguardando_agendamento"
          next.schedulingStatus = "pendente"
          next.schedulingRequestedAt = movement.createdAt
        } else if (input.type === "reserva_agendamento") {
          next.schedulingStatus = "reservado"
          next.schedulingReservedAt = movement.createdAt
        } else if (input.type === "nao_agendado") {
          next.schedulingStatus = "fora_fila"
          next.status = "ativo"
        } else if (input.type === "cumprimento") {
          next.status = "cumprido"
          next.schedulingStatus = "fora_fila"
        } else if (input.type === "descumprimento") {
          next.status = "descumprido"
        } else if (input.type === "encerramento_inercia") {
          next.status = "inercia_municipio"
          next.active = false
        } else if (input.type === "bloqueio" || input.type === "sequestro") {
          next.status = "descumprido"
        }

        return next
      }),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(input.user, `movimentacao:${input.type}`, caseId, input.description),
      ],
    }))
  }

  const addFicha = (caseId: string, input: AddFichaInput) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) => {
        if (caseItem.id !== caseId) return caseItem

        const ficha: JudicialFicha = {
          id: safeId("ficha"),
          system: input.system,
          number: input.number,
          includedAt: new Date().toISOString(),
          requestedInclusion: input.requestedInclusion,
          hasJudicialMark: input.hasJudicialMark,
          attachmentName: input.attachmentName,
          attachmentUrl: input.attachmentUrl,
          attachmentRelativePath: input.attachmentRelativePath,
          notes: input.notes,
        }

        const att = input.attachmentName
          ? [
              {
                id: safeId("att"),
                name: input.attachmentName,
                category: "ficha" as const,
                createdAt: new Date().toISOString(),
                createdById: input.user.id,
                createdByName: input.user.nome,
                source: "processo" as const,
                relativePath: input.attachmentRelativePath,
                url:
                  input.attachmentUrl ??
                  (input.attachmentRelativePath
                    ? `/api/files/${input.attachmentRelativePath}`
                    : undefined),
              },
            ]
          : []

        return {
          ...caseItem,
          fichas: [...caseItem.fichas, ficha],
          attachments: [...caseItem.attachments, ...att],
          monitoringMode: input.system === "CORE" ? caseItem.monitoringMode : "humano",
        }
      }),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(
          input.user,
          "cadastro_ficha",
          caseId,
          `${input.system} ${input.number ?? ""}`.trim(),
        ),
      ],
    }))
  }

  const updateFicha = (caseId: string, fichaId: string, input: AddFichaInput) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) => {
        if (caseItem.id !== caseId) return caseItem

        return {
          ...caseItem,
          fichas: caseItem.fichas.map((ficha) =>
            ficha.id !== fichaId
              ? ficha
              : {
                  ...ficha,
                  system: input.system,
                  number: input.number,
                  requestedInclusion: input.requestedInclusion,
                  hasJudicialMark: input.hasJudicialMark,
                  attachmentName: input.attachmentName,
                  attachmentUrl: input.attachmentUrl,
                  attachmentRelativePath: input.attachmentRelativePath,
                  notes: input.notes,
                  updatedAt: new Date().toISOString(),
                  updatedByName: input.user.nome,
                },
          ),
        }
      }),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(input.user, "atualizacao_ficha", caseId, fichaId),
      ],
    }))
  }

  const toggleFicha = (caseId: string, fichaId: string, user: User, reason?: string) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) => {
        if (caseItem.id !== caseId) return caseItem

        return {
          ...caseItem,
          fichas: caseItem.fichas.map((ficha) =>
            ficha.id !== fichaId
              ? ficha
              : {
                  ...ficha,
                  active: ficha.active === false ? true : false,
                  inactiveReason: ficha.active === false ? undefined : reason,
                  updatedAt: new Date().toISOString(),
                  updatedByName: user.nome,
                },
          ),
        }
      }),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(user, "toggle_ficha", caseId, `${fichaId}${reason ? ` • ${reason}` : ""}`),
      ],
    }))
  }

  const addProcedure = (caseId: string, input: AddProcedureInput) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              procedures: [
                ...caseItem.procedures,
                {
                  id: safeId("proc"),
                  sigtapCode: input.sigtapCode,
                  description: input.description,
                  specialty: input.specialty,
                  subSpecialty: input.subSpecialty,
                  active: true,
                  createdAt: new Date().toISOString(),
                  createdByName: input.user.nome,
                },
              ],
            },
      ),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(
          input.user,
          "add_procedure",
          caseId,
          `${input.sigtapCode} - ${input.description}`,
        ),
      ],
    }))
  }

  const toggleProcedure = (caseId: string, procedureId: string, user: User) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              procedures: caseItem.procedures.map((p) =>
                p.id === procedureId ? { ...p, active: !p.active } : p,
              ),
            },
      ),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(user, "toggle_procedure", caseId, procedureId),
      ],
    }))
  }

  const addCid = (caseId: string, input: AddCidInput) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              cids: [
                ...caseItem.cids,
                {
                  id: safeId("cid"),
                  code: input.code,
                  description: input.description,
                  active: true,
                  createdAt: new Date().toISOString(),
                  createdByName: input.user.nome,
                },
              ],
            },
      ),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(input.user, "add_cid", caseId, `${input.code} - ${input.description}`),
      ],
    }))
  }

  const toggleCid = (caseId: string, cidId: string, user: User) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              cids: caseItem.cids.map((c) =>
                c.id === cidId ? { ...c, active: !c.active } : c,
              ),
            },
      ),
      auditTrail: [...prev.auditTrail, makeAudit(user, "toggle_cid", caseId, cidId)],
    }))
  }

  const finalizeDemand = (caseId: string, input: FinalizeCaseInput) => {
    const closesCase = ["resolvido", "bloqueio", "sequestro", "obito"].includes(input.status)

    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) => {
        if (caseItem.id !== caseId) return caseItem

        const finalization: JudicialFinalization = {
          status: input.status,
          createdAt: new Date().toISOString(),
          createdById: input.user.id,
          createdByName: input.user.nome,
          pendingLocation: input.pendingLocation,
          reason: input.reason,
        }

        const descriptionParts = [
          `${closesCase ? "Finalização" : "Atualização"} da demanda: ${input.status}`,
          input.pendingLocation ? `Local da pendência: ${input.pendingLocation}` : "",
          input.reason || "",
        ].filter(Boolean)

        const movementType =
          input.status === "bloqueio"
            ? "bloqueio"
            : input.status === "sequestro"
              ? "sequestro"
              : input.status === "obito"
                ? "obito"
                : input.status === "resolvido"
                  ? "cumprimento"
                  : "monitoramento"

        return {
          ...caseItem,
          active: !closesCase,
          status:
            input.status === "resolvido"
              ? "cumprido"
              : closesCase
                ? "encerrado"
                : "ativo",
          finalization,
          lastMovementAt: finalization.createdAt,
          movements: [
            ...caseItem.movements,
            {
              id: safeId("mov"),
              type: movementType,
              description: descriptionParts.join(" • "),
              createdAt: finalization.createdAt,
              createdById: input.user.id,
              createdByName: input.user.nome,
              attachments: [],
            },
          ],
        }
      }),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(
          input.user,
          closesCase ? "finalizacao_demanda" : "atualizacao_demanda",
          caseId,
          `${input.status}${input.pendingLocation ? ` • ${input.pendingLocation}` : ""}${input.reason ? ` • ${input.reason}` : ""}`,
        ),
      ],
    }))
  }

  const updateProcedureStatus = (caseId: string, input: UpdateProcedureStatusInput) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              procedures: caseItem.procedures.map((item) =>
                item.id !== input.procedureId
                  ? item
                  : {
                      ...item,
                      status: input.status,
                      statusReason: input.reason,
                      statusUpdatedAt: new Date().toISOString(),
                      statusUpdatedByName: input.user.nome,
                    },
              ),
            },
      ),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(
          input.user,
          "status_procedimento",
          caseId,
          `${input.procedureId} • ${input.status} • ${input.reason}`,
        ),
      ],
    }))
  }

  const updateFichaStatus = (caseId: string, input: UpdateFichaStatusInput) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              fichas: caseItem.fichas.map((item) =>
                item.id !== input.fichaId
                  ? item
                  : {
                      ...item,
                      status: input.status,
                      statusReason: input.reason,
                      statusUpdatedAt: new Date().toISOString(),
                      statusUpdatedByName: input.user.nome,
                      active: input.status === "inativa" ? false : item.active,
                    },
              ),
            },
      ),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(
          input.user,
          "status_ficha",
          caseId,
          `${input.fichaId} • ${input.status} • ${input.reason}`,
        ),
      ],
    }))
  }

  const addProcessNumber = (caseId: string, processNumber: string, user: User) => {
    const normalized = processNumber.trim()
    if (!normalized) return

    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              processNumbers: Array.from(
                new Set([
                  ...(caseItem.processNumbers ?? [caseItem.processNumber]).filter(Boolean),
                  normalized,
                ]),
              ),
              processNumber: caseItem.processNumber || normalized,
            },
      ),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(user, "novo_processo_vinculado", caseId, normalized),
      ],
    }))
  }

  const registerProcessStatus = (caseId: string, input: RegisterProcessStatusInput) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) => {
        if (caseItem.id !== caseId) return caseItem

        const entry: JudicialProcessStatusEntry = {
          id: safeId("proc_status"),
          status: input.status,
          createdAt: new Date().toISOString(),
          createdById: input.user.id,
          createdByName: input.user.nome,
          reason: input.reason,
          deadlineType: input.deadlineType,
          deadlineValue: input.deadlineValue,
        }

        return {
          ...caseItem,
          processStatusHistory: [...(caseItem.processStatusHistory ?? []), entry],
          lastMovementAt: entry.createdAt,
        }
      }),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(
          input.user,
          "status_processo_judicial",
          caseId,
          `${input.status}${input.deadlineType && input.deadlineValue ? ` • ${input.deadlineValue} ${input.deadlineType}` : ""}${input.reason ? ` • ${input.reason}` : ""}`,
        ),
      ],
    }))
  }

  const addMunicipalityManifestation = (caseId: string, input: ManifestationInput) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              municipalityManifestations: [
                ...caseItem.municipalityManifestations,
                {
                  id: safeId("man"),
                  createdAt: new Date().toISOString(),
                  createdByName: input.user.nome,
                  description: input.description,
                  attachments: makeAttachmentNames(
                    input.attachmentNames,
                    input.user,
                    "manifestacao",
                  ),
                },
              ],
              lastMovementAt: new Date().toISOString(),
            },
      ),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(input.user, "manifestacao_municipio", caseId, input.description),
      ],
    }))
  }

  const sendToScheduling = (caseId: string, description: string, user: User) => {
    registerMovement(caseId, {
      type: "envio_agendamento_demanda",
      description,
      user,
    })
  }

  const registerSchedulingResult = (caseId: string, input: SchedulingResultInput) => {
    const movementType =
      input.result === "agendado"
        ? "agendamento"
        : input.result === "reservado"
          ? "reserva_agendamento"
          : "nao_agendado"

    registerMovement(caseId, {
      type: movementType,
      description: input.description,
      user: input.user,
      appointmentDate: input.appointmentDate,
      attachments: input.attachmentNames,
    })
  }

  const closeCase = (caseId: string, reason: string, user: User) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              active: false,
              status: "encerrado",
              lastMovementAt: new Date().toISOString(),
              movements: [
                ...caseItem.movements,
                {
                  id: safeId("mov"),
                  type: "encerramento_processo",
                  description: reason,
                  createdAt: new Date().toISOString(),
                  createdById: user.id,
                  createdByName: user.nome,
                  attachments: [],
                },
              ],
            },
      ),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(user, "encerramento_processo", caseId, reason),
      ],
    }))
  }

  const reopenCase = (caseId: string, reason: string, user: User) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              active: true,
              status: "ativo",
              lastMovementAt: new Date().toISOString(),
              movements: [
                ...caseItem.movements,
                {
                  id: safeId("mov"),
                  type: "reabertura",
                  description: reason,
                  createdAt: new Date().toISOString(),
                  createdById: user.id,
                  createdByName: user.nome,
                  attachments: [],
                },
              ],
            },
      ),
      auditTrail: [...prev.auditTrail, makeAudit(user, "reabertura", caseId, reason)],
    }))
  }

  const closeForInertia = (caseId: string, reason: string, user: User) => {
    registerMovement(caseId, {
      type: "encerramento_inercia",
      description: reason,
      user,
    })
  }

  const returnToAutomaticMonitoring = (caseId: string, reason: string, user: User) => {
    update((prev) => ({
      ...prev,
      cases: prev.cases.map((caseItem) =>
        caseItem.id !== caseId
          ? caseItem
          : {
              ...caseItem,
              monitoringMode: "automatic_core",
              monitoringModeReason: reason,
              movements: [
                ...caseItem.movements,
                {
                  id: safeId("mov"),
                  type: "retorno_fluxo_automatico",
                  description: reason,
                  createdAt: new Date().toISOString(),
                  createdById: user.id,
                  createdByName: user.nome,
                  attachments: [],
                },
              ],
            },
      ),
      auditTrail: [
        ...prev.auditTrail,
        makeAudit(user, "retorno_fluxo_automatico", caseId, reason),
      ],
    }))
  }

  const upsertMunicipalityContact = (input: MunicipalityContact) => {
    update((prev) => ({
      ...prev,
      municipalityContacts: prev.municipalityContacts.some((m) => m.id === input.id)
        ? prev.municipalityContacts.map((m) => (m.id === input.id ? input : m))
        : [...prev.municipalityContacts, input],
    }))
  }

  const upsertEmailTemplate = (input: EmailTemplate) => {
    update((prev) => ({
      ...prev,
      emailTemplates: prev.emailTemplates.some((m) => m.id === input.id)
        ? prev.emailTemplates.map((m) => (m.id === input.id ? input : m))
        : [...prev.emailTemplates, input],
    }))
  }

  const setPriorityFocus = (focus: PriorityFocus) => {
    update((prev) => ({
      ...prev,
      priorityFocus: migratePriorityFocus(focus),
    }))
  }

  const importCoreTable = (
    table: CoreTable,
    rows: Omit<CoreRow, "id" | "table" | "importedAt">[],
  ) => {
    update((prev) => {
      const importedAt = new Date().toISOString()
      const remaining = prev.coreRows.filter((r) => r.table !== table)

      return {
        ...prev,
        coreRows: [
          ...remaining,
          ...rows.map((row) => ({ ...row, id: safeId("core"), table, importedAt })),
        ],
      }
    })
  }

  const importAgendaOffers = (rows: Omit<AgendaOffer, "id" | "importedAt">[]) => {
    update((prev) => ({
      ...prev,
      agendaOffers: rows.map((row) => ({
        ...row,
        id: safeId("ag"),
        importedAt: new Date().toISOString(),
      })),
    }))
  }

  const runAutomaticCoreScan = (user?: User | null) => {
    update((prev) => {
      const nextCases = prev.cases.map((caseItem) => {
        const coreFicha = caseItem.fichas.find((f) => f.system === "CORE" && f.number)
        if (!coreFicha?.number || caseItem.status === "encerrado" || caseItem.status === "cumprido") {
          return caseItem
        }

        const relatedRows = prev.coreRows.filter((row) => row.fichaNumber === coreFicha.number)
        if (!relatedRows.length) return caseItem

        const hasAppointment = relatedRows.some((r) => !!r.appointmentDate)
        if (!hasAppointment) {
          return {
            ...caseItem,
            coreHistory: relatedRows.map((r) => ({
              id: safeId("ch"),
              table: r.table,
              fichaNumber: r.fichaNumber,
              patientName: r.patientName,
              appointmentDate: r.appointmentDate,
              procedureCode: r.procedureCode,
              procedureDescription: r.procedureDescription,
              statusText: r.statusText,
              importedAt: r.importedAt,
            })),
          }
        }

        const movement: JudicialMovement = {
          id: safeId("mov"),
          type: "monitoramento_automatico_core",
          description:
            "Rotina automática CORE localizou agendamento e encaminhou para confirmação humana.",
          createdAt: new Date().toISOString(),
          createdById: user?.id ?? "system",
          createdByName: user?.nome ?? "Sistema",
          attachments: [],
        }

        return {
          ...caseItem,
          monitoringMode: "humano" as const,
          monitoringModeReason: "CORE encontrou possível agendamento; exige confirmação humana.",
          movements: [...caseItem.movements, movement],
          coreHistory: relatedRows.map((r) => ({
            id: safeId("ch"),
            table: r.table,
            fichaNumber: r.fichaNumber,
            patientName: r.patientName,
            appointmentDate: r.appointmentDate,
            procedureCode: r.procedureCode,
            procedureDescription: r.procedureDescription,
            statusText: r.statusText,
            importedAt: r.importedAt,
          })),
        }
      })

      return {
        ...prev,
        cases: nextCases,
        auditTrail: user
          ? [...prev.auditTrail, makeAudit(user, "scan_core_automatico")]
          : prev.auditTrail,
      }
    })
  }

  const trackUiAction = (
    action: string,
    user: User | null | undefined,
    caseId?: string,
    details?: string,
  ) => {
    if (!user) return
    update((prev) => ({
      ...prev,
      auditTrail: [...prev.auditTrail, makeAudit(user, action, caseId, details)],
    }))
  }

  const getSeizureSummary = () => {
    if (!state) return { totalState: 0, byMunicipality: [] }

    const totals = state.cases.reduce<Record<string, number>>((acc, c) => {
      const total = c.movements.reduce(
        (sum, mov) => sum + (mov.municipalityAmount ?? 0) + (mov.stateAmount ?? 0),
        0,
      )
      acc[c.municipalityName] = (acc[c.municipalityName] ?? 0) + total
      return acc
    }, {})

    const totalState = state.cases.reduce(
      (sum, c) =>
        sum + c.movements.reduce((inner, m) => inner + (m.stateAmount ?? 0), 0),
      0,
    )

    return {
      totalState,
      byMunicipality: Object.entries(totals)
        .map(([municipality, total]) => ({ municipality, total }))
        .sort((a, b) => b.total - a.total),
    }
  }

  const value = useMemo<JudicialContextType>(
    () => ({
      cases: state?.cases ?? [],
      municipalityContacts: state?.municipalityContacts ?? [],
      emailTemplates: state?.emailTemplates ?? [],
      coreRows: state?.coreRows ?? [],
      agendaOffers: state?.agendaOffers ?? [],
      auditTrail: state?.auditTrail ?? [],
      priorityFocus: migratePriorityFocus(state?.priorityFocus),
      procedureCatalog,
      cidCatalog,
      getCaseById,
      getDailyQueueForUser,
      getSchedulingQueue,
      getMunicipalityCases,
      registerMovement,
      addFicha,
      updateFicha,
      toggleFicha,
      addProcedure,
      toggleProcedure,
      addCid,
      toggleCid,
      addMunicipalityManifestation,
      finalizeDemand,
      updateProcedureStatus,
      updateFichaStatus,
      addProcessNumber,
      registerProcessStatus,
      createCaseFromPatient,
      sendToScheduling,
      registerSchedulingResult,
      reopenCase,
      closeCase,
      closeForInertia,
      returnToAutomaticMonitoring,
      upsertMunicipalityContact,
      upsertEmailTemplate,
      setPriorityFocus,
      importCoreTable,
      importAgendaOffers,
      runAutomaticCoreScan,
      trackUiAction,
      getSeizureSummary,
    }),
    [state],
  )

  return <JudicialContext.Provider value={value}>{children}</JudicialContext.Provider>
}

export function useJudicial() {
  const ctx = useContext(JudicialContext)
  if (!ctx) throw new Error("useJudicial must be used inside JudicialProvider")
  return ctx
}