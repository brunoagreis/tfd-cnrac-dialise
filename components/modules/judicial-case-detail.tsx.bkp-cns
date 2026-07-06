"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Italic,
  List,
  ListOrdered,
  Mail,
  Printer,
  Scale,
  Send,
  ShieldAlert,
  Upload,
  Bold,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Edit3,
  Info,
  Plus,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import {
  JUDICIAL_CASE_STATUS_LABELS,
  JUDICIAL_FICHA_STATUS_LABELS,
  JUDICIAL_PROCEDURE_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  QUEUE_REASON_LABELS,
  SYSTEM_LABELS,
  type JudicialAttachment,
  type JudicialCase,
  type JudicialFicha,
  type MovementType,
} from "@/lib/judicial-types"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { JudicialFichasPanel } from "@/components/modules/judicial-fichas-panel"

type UploadedFileMeta = {
  name: string
  storedName: string
  relativePath: string
  url: string
  size: number
  mimeType: string
}

type SigtapOption = {
  id: string
  sigtapCode: string
  description: string
  active: boolean
}

type SpecialtyOption = {
  id: string
  nome: string
}

type SubSpecialtyOption = {
  id: string
  especialidadeId: string
  nome: string
}

type CidOption = {
  code: string
  description: string
}

type HistoryItem = {
  id: string
  createdAt: string
  category:
    | "movimentacao"
    | "ficha"
    | "manifestacao"
    | "procedimento"
    | "cid"
    | "auditoria"
    | "core"
  title: string
  subtitle?: string
  description?: string
  badges?: string[]
  attachments?: JudicialAttachment[]
  html?: boolean
}

const MOVEMENT_OPTIONS: MovementType[] = [
  "monitoramento",
  "envio_agendamento_demanda",
  "agendamento",
  "solicitacao_inclusao",
  "reiteracao",
  "descumprimento",
  "cumprimento",
  "cumprido",
  "resolvido",
  "arquivado",
  "falta_paciente",
  "obito",
  "bloqueio",
  "sequestro",
  "encerramento_processo",
]
const CLOSE_REASONS = [
  "Cumprimento da decisão",
  "Perda do objeto",
  "Óbito do paciente",
  "Inércia do município",
  "Determinação judicial revogada",
  "Duplicidade de cadastro",
  "Outros",
]

function mergeCommaNames(currentValue: string, newNames: string[]) {
  const current = currentValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  const merged = [...current]

  for (const name of newNames) {
    if (!merged.includes(name)) merged.push(name)
  }

  return merged.join(", ")
}

function splitCommaNames(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function htmlHasContent(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim().length > 0
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function replaceTemplatePlaceholders(value: string, replacements: Record<string, string>) {
  let result = value || ""
  Object.entries(replacements).forEach(([placeholder, replacement]) => {
    result = result.replaceAll(placeholder, replacement)
  })
  return result
}

function templateBodyToHtml(value: string) {
  if (/<[^>]+>/.test(value)) return value
  const lines = value.split(/\r?\n/)
  if (lines.length === 0) return "<p></p>"
  return lines
    .map((line) => {
      const trimmed = line.trim()
      return trimmed ? `<p>${escapeHtml(trimmed)}</p>` : "<p></p>"
    })
    .join("")
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size)) return "-"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function fileListToArray(files: FileList | null) {
  return files ? Array.from(files) : []
}

function uniqueAttachments(items: JudicialAttachment[]) {
  const map = new Map<string, JudicialAttachment>()
  for (const item of items) {
    const key = `${item.id}:${item.name}:${item.createdAt}`
    if (!map.has(key)) map.set(key, item)
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const PROCESS_STATUS_LABELS = {
  em_andamento: "Em andamento",
  descumprimento: "Descumprimento",
  decisao_judicial_prazo: "Decisão judicial com prazo",
} as const

const FINALIZATION_STATUS_LABELS = {
  pendente: "Pendente",
  resolvido: "Resolvido",
  cumprido: "Cumprido",
  bloqueio: "Bloqueio",
  sequestro: "Sequestro",
  obito: "Óbito",
  arquivado: "Arquivado",
  devolvida: "Devolvida",
} as const

const PROCEDURE_STATUS_OPTIONS = [
  "atendido",
  "regulado",
  "nao_realizado_rede_sus",
  "ausente",
] as const

type ProcedureStatusValue = (typeof PROCEDURE_STATUS_OPTIONS)[number]

function AttachmentActions({ attachment }: { attachment: JudicialAttachment }) {
  if (!attachment.url) {
    return <span className="text-xs text-muted-foreground">Arquivo sem link</span>
  }

  const downloadUrl = attachment.relativePath
    ? `/api/files/${attachment.relativePath}?download=1`
    : `${attachment.url}${attachment.url.includes("?") ? "&" : "?"}download=1`

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
      >
        <Eye className="h-3.5 w-3.5" /> Visualizar
      </a>
      <a
        href={downloadUrl}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
      >
        <Download className="h-3.5 w-3.5" /> Baixar
      </a>
    </div>
  )
}

function InfoField({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-sm ${
          strong ? "font-semibold text-foreground" : "text-muted-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export function JudicialCaseDetail({ caseId }: { caseId: string }) {
  const [caseItem, setCaseItem] = useState<JudicialCase | null>(null)
  const [loadingCase, setLoadingCase] = useState(true)
  const [caseError, setCaseError] = useState("")

  useEffect(() => {
    let active = true

    async function loadCase() {
      try {
        setLoadingCase(true)
        setCaseError("")

        const response = await fetch(
          `/api/judicial/casos/${encodeURIComponent(caseId)}`,
          {
            cache: "no-store",
          },
        )

        const data = await response.json()

        if (!response.ok || !data?.ok || !data?.item) {
          throw new Error(data?.error || "Processo judicial não encontrado.")
        }

        if (!active) return

        setCaseItem(data.item as JudicialCase)
      } catch (error) {
        if (!active) return

        console.error("[JudicialCaseDetail] erro ao carregar caso:", error)
        setCaseItem(null)
        setCaseError(
          error instanceof Error
            ? error.message
            : "Erro ao carregar processo judicial.",
        )
      } finally {
        if (active) {
          setLoadingCase(false)
        }
      }
    }

    if (caseId) {
      loadCase()
    }

    return () => {
      active = false
    }
  }, [caseId])

  if (loadingCase) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Carregando processo judicial...
      </div>
    )
  }

  if (!caseItem) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        {caseError || "Processo judicial não encontrado."}
      </div>
    )
  }

  return <JudicialCaseDetailContent caseId={caseId} caseItem={caseItem} />
}

function JudicialCaseDetailContent({
  caseId,
  caseItem,
}: {
  caseId: string
  caseItem: JudicialCase
}) {
  const { user } = useAuth()
  const judicial = useJudicial()

  const editorRef = useRef<HTMLDivElement | null>(null)
  const lastTrackedTabRef = useRef<string>("")

  const [movementType, setMovementType] = useState<MovementType>("monitoramento")
  const [description, setDescription] = useState("")
  const [stateAmount, setStateAmount] = useState("")
  const [municipalityAmount, setMunicipalityAmount] = useState("")
  const [appointmentDate, setAppointmentDate] = useState("")
  const [responseRequestedAt, setResponseRequestedAt] = useState("")
  const [closeReason, setCloseReason] = useState("")
  const [attachmentNames, setAttachmentNames] = useState("")

  const [selectedMovementFiles, setSelectedMovementFiles] = useState<FileList | null>(null)
  const [uploadedMovementFiles, setUploadedMovementFiles] = useState<UploadedFileMeta[]>([])
  const [uploadingMovement, setUploadingMovement] = useState(false)

  const [procedureSearch, setProcedureSearch] = useState("")
  const [procedureOptions, setProcedureOptions] = useState<SigtapOption[]>([])
  const [loadingProcedures, setLoadingProcedures] = useState(false)
  const [specialtyOptions, setSpecialtyOptions] = useState<SpecialtyOption[]>([])
  const [subSpecialtyOptions, setSubSpecialtyOptions] = useState<SubSpecialtyOption[]>([])
  const [loadingSpecialties, setLoadingSpecialties] = useState(false)
  const [loadingSubSpecialties, setLoadingSubSpecialties] = useState(false)
  const [cidSearch, setCidSearch] = useState("")
  const [cidOptions, setCidOptions] = useState<CidOption[]>([])
  const [loadingCids, setLoadingCids] = useState(false)
  const [selectedProcedure, setSelectedProcedure] = useState("")
  const [selectedProcedureSpecialty, setSelectedProcedureSpecialty] = useState("")
  const [selectedProcedureSubSpecialty, setSelectedProcedureSubSpecialty] = useState("")
  const [procedureStatusOpen, setProcedureStatusOpen] = useState(false)
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null)
  const [procedureStatusValue, setProcedureStatusValue] =
    useState<ProcedureStatusValue>("atendido")
  const [procedureStatusReason, setProcedureStatusReason] = useState("")
  const [selectedCid, setSelectedCid] = useState("")

  const [editingFichaId, setEditingFichaId] = useState<string | null>(null)
  const [fichaSystem, setFichaSystem] = useState<"CORE" | "SISREG" | "OUTRO">(
    "CORE",
  )
  const [fichaNumber, setFichaNumber] = useState("")
  const [fichaAttachment, setFichaAttachment] = useState("")
  const [fichaNotes, setFichaNotes] = useState("")
  const [fichaProcedureCode, setFichaProcedureCode] = useState("")
  const [requestedInclusion, setRequestedInclusion] = useState(false)
  const [hasJudicialMark, setHasJudicialMark] = useState(true)
  const [selectedFichaFiles, setSelectedFichaFiles] = useState<FileList | null>(null)
  const [uploadedFichaFiles, setUploadedFichaFiles] = useState<UploadedFileMeta[]>([])
  const [uploadingFicha, setUploadingFicha] = useState(false)

  const [manifestSubject, setManifestSubject] = useState("")
  const [manifestRecipients, setManifestRecipients] = useState("")
  const [selectedManifestTemplateId, setSelectedManifestTemplateId] = useState("")
  const [manifestHtml, setManifestHtml] = useState(
    "<p>Prezados,</p><p></p><p>Atenciosamente.</p>",
  )
  const [manifestAttachments, setManifestAttachments] = useState("")
  const [selectedManifestFiles, setSelectedManifestFiles] = useState<FileList | null>(null)
  const [uploadedManifestFiles, setUploadedManifestFiles] = useState<UploadedFileMeta[]>([])
  const [uploadingManifest, setUploadingManifest] = useState(false)

  const [attachmentsPage, setAttachmentsPage] = useState(1)
  const [latestMovementsPage, setLatestMovementsPage] = useState(1)
  const attachmentsPageSize = 6
  const [activeTab, setActiveTab] = useState("monitoramento")
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [processStatusOpen, setProcessStatusOpen] = useState(false)
  const [pgeNetOpen, setPgeNetOpen] = useState(false)
  const [fichaModalOpen, setFichaModalOpen] = useState(false)
  const [procedureCidModalOpen, setProcedureCidModalOpen] = useState(false)
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [municipalityContactsOpen, setMunicipalityContactsOpen] = useState(false)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null)
  const [finalizeStatus, setFinalizeStatus] =
    useState<keyof typeof FINALIZATION_STATUS_LABELS>("resolvido")
  const [finalizePendingLocation, setFinalizePendingLocation] = useState<
    "ses" | "core" | "municipio"
  >("ses")
  const [finalizeReason, setFinalizeReason] = useState("")
  const [processStatus, setProcessStatus] =
    useState<keyof typeof PROCESS_STATUS_LABELS>("em_andamento")
  const [processStatusReason, setProcessStatusReason] = useState("")
  const [processPrazoInicio, setProcessPrazoInicio] = useState("")
  const [processPrazoDescricao, setProcessPrazoDescricao] = useState("")
  const [newProcessNumber, setNewProcessNumber] = useState("")
  const [newPgeNetNumber, setNewPgeNetNumber] = useState("")
  const [finalizeValorEstado, setFinalizeValorEstado] = useState("")
  const [finalizeValorMunicipio, setFinalizeValorMunicipio] = useState("")

  useEffect(() => {
    setActiveTab("monitoramento")
    lastTrackedTabRef.current = ""

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(`judicial-tab:${caseId}`)
    }
  }, [caseId])


  function handleTabChange(nextTab: string) {
    setActiveTab(nextTab)

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`judicial-tab:${caseId}`, nextTab)
    }

    if (!user || !caseItem?.id) return

    const trackKey = `${caseItem.id}:${nextTab}:${user.id}`
    if (lastTrackedTabRef.current === trackKey) return

    lastTrackedTabRef.current = trackKey
    judicial.trackUiAction("abrir_aba_judicial", user, caseItem.id, nextTab)
  }

  const contacts = judicial.municipalityContacts.find(
    (item) => item.municipalityName === caseItem.municipalityName,
  )

  const activeFicha =
    [...caseItem.fichas].reverse().find((item) => item.active !== false) ??
    caseItem.fichas[caseItem.fichas.length - 1]
  const isJudicialMarked = activeFicha?.hasJudicialMark ?? true

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    async function loadSigtap() {
      try {
        setLoadingProcedures(true)
        const response = await fetch(
          `/api/judicial/sigtap?q=${encodeURIComponent(procedureSearch)}&limit=50`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        )

        const data = await response.json()

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Erro ao pesquisar SIGTAP.")
        }

        if (!active) return

        setProcedureOptions((data.items || []) as SigtapOption[])
      } catch (error) {
        if (!active || controller.signal.aborted) return
        console.error("[JudicialCaseDetail] erro ao pesquisar SIGTAP:", error)
        setProcedureOptions([])
      } finally {
        if (active) setLoadingProcedures(false)
      }
    }

    const timer = window.setTimeout(loadSigtap, 250)

    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [procedureSearch])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    async function loadSpecialties() {
      try {
        setLoadingSpecialties(true)

        const response = await fetch("/api/judicial/especialidades", {
          cache: "no-store",
          signal: controller.signal,
        })

        const data = await response.json()

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Erro ao carregar especialidades.")
        }

        if (!active) return

        setSpecialtyOptions((data.items || []) as SpecialtyOption[])
      } catch (error) {
        if (!active || controller.signal.aborted) return
        console.error("[JudicialCaseDetail] erro ao carregar especialidades:", error)
        setSpecialtyOptions([])
      } finally {
        if (active) setLoadingSpecialties(false)
      }
    }

    loadSpecialties()

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    if (!selectedProcedureSpecialty) {
      setSubSpecialtyOptions([])
      setSelectedProcedureSubSpecialty("")
      return () => {
        active = false
        controller.abort()
      }
    }

    async function loadSubSpecialties() {
      try {
        setLoadingSubSpecialties(true)

        const response = await fetch(
          `/api/judicial/subespecialidades?especialidadeId=${encodeURIComponent(
            selectedProcedureSpecialty,
          )}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        )

        const data = await response.json()

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Erro ao carregar subespecialidades.")
        }

        if (!active) return

        setSubSpecialtyOptions((data.items || []) as SubSpecialtyOption[])
      } catch (error) {
        if (!active || controller.signal.aborted) return
        console.error(
          "[JudicialCaseDetail] erro ao carregar subespecialidades:",
          error,
        )
        setSubSpecialtyOptions([])
      } finally {
        if (active) setLoadingSubSpecialties(false)
      }
    }

    loadSubSpecialties()

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedProcedureSpecialty])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    async function loadCids() {
      try {
        setLoadingCids(true)
        const response = await fetch(
          `/api/judicial/cid10?q=${encodeURIComponent(cidSearch.trim())}&limit=300`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        )

        const data = await response.json().catch(() => ({}))

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Erro ao carregar CID-10.")
        }

        if (!active) return

        const items = Array.isArray(data?.items) ? data.items : []
        setCidOptions(
          items
            .map((item: any) => ({
              code: String(item?.code ?? item?.codigo ?? "").trim(),
              description: String(item?.description ?? item?.descricao ?? "").trim(),
            }))
            .filter((item: CidOption) => item.code && item.description),
        )
      } catch (error) {
        if (!active || controller.signal.aborted) return
        console.error("[JudicialCaseDetail] erro ao carregar CID-10:", error)
        setCidOptions([])
      } finally {
        if (active) setLoadingCids(false)
      }
    }

    const timer = window.setTimeout(loadCids, 250)

    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [cidSearch])

  const allAttachments = useMemo(() => {
    const items: JudicialAttachment[] = [
      ...caseItem.attachments,
      ...caseItem.movements.flatMap((item) => item.attachments),
      ...caseItem.municipalityManifestations.flatMap((item) => item.attachments),
    ]
    return uniqueAttachments(items)
  }, [caseItem.attachments, caseItem.movements, caseItem.municipalityManifestations])

  const paginatedAttachments = useMemo(() => {
    const start = (attachmentsPage - 1) * attachmentsPageSize
    return allAttachments.slice(start, start + attachmentsPageSize)
  }, [allAttachments, attachmentsPage])

  const totalAttachmentPages = Math.max(
    1,
    Math.ceil(allAttachments.length / attachmentsPageSize),
  )

  const latestProcessStatus = caseItem.processStatusHistory?.length
    ? caseItem.processStatusHistory[caseItem.processStatusHistory.length - 1]
    : undefined

  const currentFinalizationLabel = caseItem.finalization
    ? FINALIZATION_STATUS_LABELS[caseItem.finalization.status]
    : "Pendente"

  const currentProcessStatusLabel = latestProcessStatus
    ? PROCESS_STATUS_LABELS[latestProcessStatus.status]
    : "Em andamento"

  const processNumbers = caseItem.processNumbers?.length
    ? caseItem.processNumbers
    : caseItem.processNumber
      ? [caseItem.processNumber]
      : []

  const pgeNetNumbers = caseItem.registration?.pgeNetNumber
    ? caseItem.registration.pgeNetNumber
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
    : []

  const activeProcedures = caseItem.procedures.filter(
    (item) => item.active !== false,
  )

  const pendingSelectedFiles = [
    ...fileListToArray(selectedMovementFiles).map((file) => ({
      scope: "Movimentação",
      file,
    })),
    ...fileListToArray(selectedFichaFiles).map((file) => ({
      scope: "Ficha",
      file,
    })),
    ...fileListToArray(selectedManifestFiles).map((file) => ({
      scope: "Notificação",
      file,
    })),
  ]

  const historyItems = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = []

    for (const item of caseItem.movements) {
      items.push({
        id: `mov-${item.id}`,
        createdAt: item.createdAt,
        category: "movimentacao",
        title: MOVEMENT_TYPE_LABELS[item.type],
        subtitle: item.createdByName,
        description: item.description,
        badges: [
          item.appointmentDate
            ? `Agendamento: ${new Date(item.appointmentDate).toLocaleString("pt-BR")}`
            : "",
          item.responseRequestedAt
            ? `Solicitado em ${new Date(item.responseRequestedAt).toLocaleDateString("pt-BR")}`
            : "",
          item.stateAmount !== undefined
            ? `Estado R$ ${item.stateAmount.toFixed(2)}`
            : "",
          item.municipalityAmount !== undefined
            ? `Município R$ ${item.municipalityAmount.toFixed(2)}`
            : "",
        ].filter(Boolean),
        attachments: item.attachments,
      })
    }

    for (const item of caseItem.fichas) {
      items.push({
        id: `ficha-${item.id}`,
        createdAt: item.updatedAt ?? item.includedAt,
        category: "ficha",
        title: `${SYSTEM_LABELS[item.system]} ${item.number || "sem número"}`,
        subtitle: item.updatedByName ?? "Ficha registrada",
        description: item.notes,
        badges: [
          item.active === false ? "Ficha inativa" : "Ficha ativa",
          item.status ? `Status: ${JUDICIAL_FICHA_STATUS_LABELS[item.status]}` : "",
          item.requestedInclusion
            ? "Inclusão solicitada"
            : "Sem inclusão solicitada",
          item.hasJudicialMark ? "Marca judicial: sim" : "Marca judicial: não",
        ],
        attachments: item.attachmentName
          ? [
              {
                id: `ficha-att-${item.id}`,
                name: item.attachmentName,
                category: "ficha",
                createdAt: item.updatedAt ?? item.includedAt,
                createdById: "sistema",
                createdByName: item.updatedByName ?? "Sistema",
                source: "processo",
                url: item.attachmentUrl,
                relativePath: item.attachmentRelativePath,
              },
            ]
          : [],
      })
    }

    for (const item of caseItem.procedures) {
      items.push({
        id: `proc-${item.id}`,
        createdAt: item.createdAt,
        category: "procedimento",
        title: `Procedimento ${item.sigtapCode}${item.description ? ` ${item.description}` : ""}`,
        subtitle: item.createdByName,
        description: item.description,
        badges: [
          item.active === false ? "Inativo" : "Ativo",
          item.status ? `Status: ${JUDICIAL_PROCEDURE_STATUS_LABELS[item.status]}` : "",
        ].filter(Boolean),
      })
    }

    for (const item of caseItem.cids) {
      items.push({
        id: `cid-${item.id}`,
        createdAt: item.createdAt,
        category: "cid",
        title: `CID ${item.code}`,
        subtitle: item.createdByName,
        description: item.description,
        badges: [item.active === false ? "Inativo" : "Ativo"],
      })
    }

    for (const item of caseItem.municipalityManifestations) {
      items.push({
        id: `man-${item.id}`,
        createdAt: item.createdAt,
        category: "manifestacao",
        title: "Manifestação / notificação do município",
        subtitle: item.createdByName,
        description: item.description,
        attachments: item.attachments,
        html: /<[^>]+>/.test(item.description),
      })
    }

    for (const item of caseItem.coreHistory) {
      items.push({
        id: `core-${item.id}`,
        createdAt: item.importedAt,
        category: "core",
        title: `${item.fichaNumber} • ${item.statusText}`,
        subtitle: item.table.replaceAll("_", " "),
        description: `${item.procedureCode || "Sem procedimento"}${
          item.procedureDescription ? ` - ${item.procedureDescription}` : ""
        }`,
        badges: [
          item.appointmentDate
            ? `Agendamento ${new Date(item.appointmentDate).toLocaleString("pt-BR")}`
            : "Sem agendamento",
        ],
      })
    }

    for (const item of caseItem.processStatusHistory ?? []) {
      items.push({
        id: `proc-status-${item.id}`,
        createdAt: item.createdAt,
        category: "movimentacao",
        title: `Status do processo: ${PROCESS_STATUS_LABELS[item.status]}`,
        subtitle: item.createdByName,
        description: item.reason,
        badges: [
          item.deadlineType && item.deadlineValue
            ? `Prazo ${item.deadlineValue} ${item.deadlineType}`
            : "",
        ].filter(Boolean),
      })
    }

    const auditItems = judicial.auditTrail
      .filter((item) => item.caseId === caseItem.id)
      .filter((item) =>
        ["toggle_procedure", "toggle_cid", "toggle_ficha", "atualizacao_ficha"].includes(
          item.action,
        ),
      )
      .map<HistoryItem>((item) => ({
        id: `audit-${item.id}`,
        createdAt: item.createdAt,
        category: "auditoria",
        title: item.action.replaceAll("_", " "),
        subtitle: item.userName,
        description: item.details,
      }))

    items.push(...auditItems)

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [caseItem, judicial.auditTrail])

  const latestMovementItems = useMemo(
    () =>
      historyItems.filter((item) =>
        ["movimentacao", "manifestacao", "ficha"].includes(item.category),
      ),
    [historyItems],
  )

  const latestMovementsPageSize = 5
  const totalLatestMovementsPages = Math.max(
    1,
    Math.ceil(latestMovementItems.length / latestMovementsPageSize),
  )
  const paginatedLatestMovements = latestMovementItems.slice(
    (latestMovementsPage - 1) * latestMovementsPageSize,
    latestMovementsPage * latestMovementsPageSize,
  )

  useEffect(() => {
    if (contacts && !manifestRecipients) {
      setManifestRecipients(contacts.emails.join(", "))
    }
  }, [contacts, manifestRecipients])

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== manifestHtml) {
      editorRef.current.innerHTML = manifestHtml
    }
  }, [manifestHtml])

  async function uploadFiles(params: {
    files: FileList | null
    category: "movimentacao" | "ficha" | "manifestacao"
    setUploading: (value: boolean) => void
    onSuccess: (files: UploadedFileMeta[]) => void
  }) {
    const { files, category, setUploading, onSuccess } = params

    if (!files || files.length === 0) {
      toast.error("Selecione ao menos um arquivo.")
      return [] as UploadedFileMeta[]
    }

    try {
      setUploading(true)
      const form = new FormData()
      form.append("cpf", caseItem.cpf)
      form.append("protocol", caseItem.originProtocol)
      form.append("module", "judicial")
      form.append("category", category)
      Array.from(files).forEach((file) => form.append("files", file))

      const response = await fetch("/api/uploads", { method: "POST", body: form })
      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Falha no upload.")
      }

      const uploadedFiles = data.files as UploadedFileMeta[]
      onSuccess(uploadedFiles)
      toast.success("Arquivo(s) enviado(s).")
      return uploadedFiles
    } catch (error) {
      console.error(error)
      toast.error("Erro ao enviar arquivo(s).")
      return [] as UploadedFileMeta[]
    } finally {
      setUploading(false)
    }
  }

  async function handleUploadMovement() {
    await uploadFiles({
      files: selectedMovementFiles,
      category: "movimentacao",
      setUploading: setUploadingMovement,
      onSuccess: (files) => {
        setUploadedMovementFiles((prev) => [...prev, ...files])
        setAttachmentNames((prev) =>
          mergeCommaNames(
            prev,
            files.map((file) => file.name),
          ),
        )
        setSelectedMovementFiles(null)
      },
    })
  }

  async function handleUploadFicha() {
    await uploadFiles({
      files: selectedFichaFiles,
      category: "ficha",
      setUploading: setUploadingFicha,
      onSuccess: (files) => {
        setUploadedFichaFiles((prev) => [...prev, ...files])
        setFichaAttachment((prev) =>
          mergeCommaNames(
            prev,
            files.map((file) => file.name),
          ),
        )
        setSelectedFichaFiles(null)
      },
    })
  }

  async function handleUploadManifest() {
    await uploadFiles({
      files: selectedManifestFiles,
      category: "manifestacao",
      setUploading: setUploadingManifest,
      onSuccess: (files) => {
        setUploadedManifestFiles((prev) => [...prev, ...files])
        setManifestAttachments((prev) =>
          mergeCommaNames(
            prev,
            files.map((file) => file.name),
          ),
        )
        setSelectedManifestFiles(null)
      },
    })
  }

  function resetMovementForm() {
    setMovementType("monitoramento")
    setDescription("")
    setStateAmount("")
    setMunicipalityAmount("")
    setAppointmentDate("")
    setResponseRequestedAt("")
    setCloseReason("")
    setAttachmentNames("")
    setSelectedMovementFiles(null)
    setUploadedMovementFiles([])
  }

  function resetFichaForm() {
    setEditingFichaId(null)
    setFichaSystem("CORE")
    setFichaNumber("")
    setFichaAttachment("")
    setFichaNotes("")
    setFichaProcedureCode("")
    setRequestedInclusion(false)
    setHasJudicialMark(true)
    setSelectedFichaFiles(null)
    setUploadedFichaFiles([])
  }

  async function handleSaveMovement() {
    if (!user) return

    if (!description.trim()) {
      toast.error("Descreva a movimentação.")
      return
    }

    if (movementType === "agendamento" && !appointmentDate) {
      toast.error("Informe a data do agendamento.")
      return
    }

    if (["sequestro", "bloqueio"].includes(movementType)) {
      if (!stateAmount.trim()) {
        toast.error("Informe o valor do Estado.")
        return
      }

      if (!municipalityAmount.trim()) {
        toast.error("Informe o valor do Município.")
        return
      }
    }

    if (movementType === "encerramento_processo" && !closeReason) {
      toast.error("Selecione o motivo do encerramento.")
      return
    }

    let movementFilesToAttach = [...uploadedMovementFiles]

    if (selectedMovementFiles && selectedMovementFiles.length > 0) {
      const uploadedBeforeSave = await uploadFiles({
        files: selectedMovementFiles,
        category: "movimentacao",
        setUploading: setUploadingMovement,
        onSuccess: (files) => {
          setUploadedMovementFiles((prev) => [...prev, ...files])
          setAttachmentNames((prev) =>
            mergeCommaNames(
              prev,
              files.map((file) => file.name),
            ),
          )
          setSelectedMovementFiles(null)
        },
      })

      if (uploadedBeforeSave.length === 0) {
        toast.error("Não foi possível enviar o(s) arquivo(s) da movimentação.")
        return
      }

      movementFilesToAttach = [...movementFilesToAttach, ...uploadedBeforeSave]
    }

    const attachmentPayload =
      movementFilesToAttach.length > 0
        ? movementFilesToAttach
        : splitCommaNames(attachmentNames)

    const movementDescription =
      movementType === "encerramento_processo"
        ? `${closeReason}: ${description.trim()}`
        : description.trim()

    try {
      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/movimentacoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: movementType,
            description: movementDescription,
            appointmentDate: appointmentDate || undefined,
            responseRequestedAt: responseRequestedAt || undefined,
            stateAmount: stateAmount || undefined,
            municipalityAmount: municipalityAmount || undefined,
            attachments: attachmentPayload,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao registrar movimentação judicial.")
      }

      toast.success(
        movementType === "envio_agendamento_demanda"
          ? "Movimentação salva e encaminhada ao Agendamento da Demanda."
          : movementType === "encerramento_processo"
            ? "Movimentação salva e processo marcado para encerramento."
            : "Movimentação registrada no banco.",
      )

      resetMovementForm()
      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao salvar movimentação:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao registrar movimentação judicial.",
      )
    }
  }

  async function handleAddProcedure() {
    if (!user) return

    const item = procedureOptions.find((option) => option.id === selectedProcedure)
    const selectedSpecialty = specialtyOptions.find(
      (option) => option.id === selectedProcedureSpecialty,
    )
    const selectedSubSpecialty = subSpecialtyOptions.find(
      (option) => option.id === selectedProcedureSubSpecialty,
    )

    if (!item) {
      toast.error("Selecione um procedimento da tabela SIGTAP.")
      return
    }

    if (!selectedSpecialty) {
      toast.error("Selecione a especialidade do procedimento.")
      return
    }

    try {
      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/procedimentos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sigtapId: item.id,
            sigtapCode: item.sigtapCode,
            specialty: selectedSpecialty.nome,
            subSpecialty: selectedSubSpecialty?.nome || undefined,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao adicionar procedimento judicial.")
      }

      toast.success("Procedimento SIGTAP adicionado e salvo no banco.")
      setSelectedProcedure("")
      setProcedureSearch("")
      setSelectedProcedureSpecialty("")
      setSelectedProcedureSubSpecialty("")

      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao adicionar procedimento:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao adicionar procedimento judicial.",
      )
    }
  }

  async function handleRemoveProcedure(procedureId: string) {
    if (!user) return

    const item = caseItem.procedures.find((procedure) => procedure.id === procedureId)

    if (!item) {
      toast.error("Procedimento não encontrado.")
      return
    }

    const reason = window.prompt(
      `Informe o motivo para apagar/inativar o procedimento ${item.sigtapCode}:`,
      "",
    )

    if (reason === null) return

    const confirmed = window.confirm(
      `Confirma apagar/inativar o procedimento ${item.sigtapCode} - ${item.description}?`,
    )

    if (!confirmed) return

    try {
      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/procedimentos/${encodeURIComponent(procedureId)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: reason.trim() || undefined,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao apagar procedimento judicial.")
      }

      toast.success("Procedimento apagado/inativado e registrado em auditoria.")
      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao apagar procedimento:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao apagar procedimento judicial.",
      )
    }
  }

  async function handleAddCid() {
    if (!user) return

    const item = cidOptions.find((option) => option.code === selectedCid)

    if (!item) {
      toast.error("Selecione um CID.")
      return
    }

    try {
      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/cids`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: item.code,
            description: item.description,
            user,
          }),
        },
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "Erro ao adicionar CID judicial.")
      }

      toast.success("CID adicionado e salvo no banco.")
      setSelectedCid("")
      setCidSearch("")

      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao adicionar CID:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao adicionar CID judicial.",
      )
    }
  }

  async function handleInactivateCid(code: string) {
    if (!user) return

    const reason = window.prompt(`Informe o motivo para inativar o CID ${code}:`, "")

    if (reason === null) return

    const confirmed = window.confirm(`Confirma inativar o CID ${code}?`)
    if (!confirmed) return

    try {
      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/cids/${encodeURIComponent(code)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: reason.trim() || undefined,
            user,
          }),
        },
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "Erro ao inativar CID judicial.")
      }

      toast.success("CID inativado.")
      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao inativar CID:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao inativar CID judicial.",
      )
    }
  }
  function handleEditFicha(item: JudicialFicha) {
    setEditingFichaId(item.id)
    setFichaSystem(item.system)
    setFichaNumber(item.number || "")
    setFichaAttachment(item.attachmentName || "")
    const procedurePrefix = "Procedimento vinculado: "
    if (item.notes.startsWith(procedurePrefix)) {
      const [firstLine, ...rest] = item.notes.split("\n")
      setFichaProcedureCode(firstLine.replace(procedurePrefix, "").trim())
      setFichaNotes(rest.join("\n").trim())
    } else {
      setFichaProcedureCode("")
      setFichaNotes(item.notes)
    }
    setRequestedInclusion(item.requestedInclusion)
    setHasJudicialMark(item.hasJudicialMark)
    setSelectedFichaFiles(null)
    setUploadedFichaFiles([])
  }

  function handleSaveFicha() {
    if (!user) return
    if (!fichaNotes.trim()) {
      toast.error("Descreva a ficha.")
      return
    }

    const payload = {
      system: fichaSystem,
      number: fichaNumber || undefined,
      requestedInclusion,
      hasJudicialMark,
      attachmentName: fichaAttachment || undefined,
      attachmentUrl: uploadedFichaFiles[0]?.url,
      attachmentRelativePath: uploadedFichaFiles[0]?.relativePath,
      notes: [
        fichaProcedureCode ? `Procedimento vinculado: ${fichaProcedureCode}` : "",
        fichaNotes.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
      user,
    }

    if (editingFichaId) {
      judicial.updateFicha(caseItem.id, editingFichaId, payload)
      toast.success("Ficha atualizada.")
    } else {
      judicial.addFicha(caseItem.id, payload)
      toast.success("Ficha registrada.")
    }

    resetFichaForm()
  }

  function runEditorCommand(command: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    setManifestHtml(editorRef.current?.innerHTML || "")
  }

  function handleApplyManifestTemplate() {
    const template = judicial.emailTemplates.find(
      (item) => item.id === selectedManifestTemplateId,
    )

    if (!template) {
      toast.error("Selecione um modelo de resposta.")
      return
    }

    const replacements = {
      "$ficha_core": activeFicha?.number || "Não informado",
      "$cpf": caseItem.cpf || "Não informado",
      "$nome_paciente": caseItem.patientName || "Não informado",
      "$numero_processo":
        processNumbers.join(" / ") || caseItem.processNumber || "Não informado",
      "$protocolo_judicial": caseItem.originProtocol || "Não informado",
      "$protocolo_prejudicial": caseItem.originProtocol || "Não informado",
      "$data_agendamento": caseItem.appointmentDate
        ? new Date(caseItem.appointmentDate).toLocaleString("pt-BR")
        : "Não informado",
      "$user_sistema": user?.nome || "Não informado",
    }

    const nextSubject = replaceTemplatePlaceholders(template.subject, replacements)
    const nextHtml = templateBodyToHtml(
      replaceTemplatePlaceholders(template.body, replacements),
    )

    setManifestSubject(nextSubject)
    setManifestHtml(nextHtml)
    if (editorRef.current) {
      editorRef.current.innerHTML = nextHtml
    }
    toast.success("Modelo aplicado na notificação ao município.")
  }

  function handleSendMunicipalityNotification() {
    if (!user) return
    const html = editorRef.current?.innerHTML || manifestHtml
    if (!manifestSubject.trim()) {
      toast.error("Informe o assunto da notificação.")
      return
    }
    if (!htmlHasContent(html)) {
      toast.error("Escreva o conteúdo da notificação.")
      return
    }

    const composedHtml = `
      <p><strong>Destinatários:</strong> ${manifestRecipients || "Não informado"}</p>
      <p><strong>Assunto:</strong> ${manifestSubject}</p>
      <hr />
      ${html}
    `

    judicial.registerMovement(caseItem.id, {
      type: "manifestacao_municipio",
      description: `Notificação enviada ao município. Assunto: ${manifestSubject}`,
      user,
      attachments:
        uploadedManifestFiles.length > 0
          ? uploadedManifestFiles
          : splitCommaNames(manifestAttachments),
    })

    judicial.addMunicipalityManifestation(caseItem.id, {
      description: composedHtml,
      attachmentNames:
        uploadedManifestFiles.length > 0
          ? uploadedManifestFiles
          : splitCommaNames(manifestAttachments),
      user,
    })

    toast.success("Notificação registrada para o município.")
    setManifestSubject("")
    setManifestHtml("<p>Prezados,</p><p></p><p>Atenciosamente.</p>")
    setManifestAttachments("")
    setSelectedManifestFiles(null)
    setUploadedManifestFiles([])
    if (editorRef.current) {
      editorRef.current.innerHTML =
        "<p>Prezados,</p><p></p><p>Atenciosamente.</p>"
    }
  }

  async function handleFinalizeDemand() {
    if (!user) return

    if (finalizeStatus === "pendente") {
      if (!finalizePendingLocation) {
        toast.error("Informe onde está pendente.")
        return
      }

      if (!finalizeReason.trim()) {
        toast.error("Justifique a pendência.")
        return
      }
    }

    if ((finalizeStatus === "resolvido" || finalizeStatus === "cumprido") && !finalizeReason.trim()) {
      toast.error(finalizeStatus === "cumprido" ? "Justifique o cumprimento." : "Justifique a resolução.")
      return
    }

    if ((finalizeStatus === "obito" || finalizeStatus === "arquivado") && !finalizeReason.trim()) {
      toast.error(finalizeStatus === "obito" ? "Justifique o óbito." : "Justifique o arquivamento.")
      return
    }

    if (["bloqueio", "sequestro"].includes(finalizeStatus)) {
      if (!finalizeValorEstado.trim()) {
        toast.error(
          finalizeStatus === "bloqueio"
            ? "Informe o valor do bloqueio para o Estado."
            : "Informe o valor do sequestro para o Estado.",
        )
        return
      }

      if (!finalizeValorMunicipio.trim()) {
        toast.error(
          finalizeStatus === "bloqueio"
            ? "Informe o valor do bloqueio para o Município."
            : "Informe o valor do sequestro para o Município.",
        )
        return
      }
    }

    try {
      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/finalizacao`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: finalizeStatus,
            pendingLocation:
              finalizeStatus === "pendente" ? finalizePendingLocation : undefined,
            reason: finalizeReason.trim() || undefined,
            valorEstado:
              ["bloqueio", "sequestro"].includes(finalizeStatus)
                ? finalizeValorEstado
                : undefined,
            valorMunicipio:
              ["bloqueio", "sequestro"].includes(finalizeStatus)
                ? finalizeValorMunicipio
                : undefined,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao finalizar demanda judicial.")
      }

      toast.success("Finalização salva no banco.")
      setFinalizeOpen(false)
      setFinalizeReason("")
      setFinalizeValorEstado("")
      setFinalizeValorMunicipio("")

      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao finalizar demanda:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao finalizar demanda judicial.",
      )
    }
  }

  async function handleRegisterProcessStatus() {
    if (!user) return

    if (
      (processStatus === "em_andamento" || processStatus === "descumprimento") &&
      !processStatusReason.trim()
    ) {
      toast.error("Justifique o status do processo judicial.")
      return
    }

    if (processStatus === "decisao_judicial_prazo") {
      if (!processPrazoInicio) {
        toast.error("Informe a data de início do prazo judicial.")
        return
      }

      if (!processPrazoDescricao.trim()) {
        toast.error("Informe o prazo. Exemplo: 5 dias, 10 dias, 1 mês.")
        return
      }
    }

    try {
      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/status-processo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: processStatus,
            reason: processStatusReason.trim() || undefined,
            prazoInicio: processPrazoInicio || undefined,
            prazoDescricao: processPrazoDescricao.trim() || undefined,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao registrar status do processo judicial.")
      }

      toast.success("Status do processo judicial salvo no banco.")
      setProcessStatusReason("")
      setProcessPrazoInicio("")
      setProcessPrazoDescricao("")
      setProcessStatusOpen(false)

      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao registrar status:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao registrar status do processo judicial.",
      )
    }
  }

  async function handleAddPgeNetNumber() {
    if (!user) return

    if (!newPgeNetNumber.trim()) {
      toast.error("Informe o número do PGE.net.")
      return
    }

    try {
      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/processos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tipo: "PGE_NET",
            numero: newPgeNetNumber.trim(),
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao registrar PGE.net.")
      }

      toast.success("PGE.net registrado no banco.")
      setNewPgeNetNumber("")
      setPgeNetOpen(false)

      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao registrar PGE.net:", error)
      toast.error(
        error instanceof Error ? error.message : "Erro ao registrar PGE.net.",
      )
    }
  }

  async function handleAddProcessNumber() {
    if (!user) return

    if (!newProcessNumber.trim()) {
      toast.error("Informe o número do processo vinculado.")
      return
    }

    try {
      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/processos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tipo: "PROCESSO",
            numero: newProcessNumber.trim(),
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao registrar processo vinculado.")
      }

      toast.success("Processo vinculado registrado no banco.")
      setNewProcessNumber("")
      setPgeNetOpen(false)

      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao registrar processo vinculado:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao registrar processo vinculado.",
      )
    }
  }

  function handleProcedureStatus(itemId: string) {
    const item = caseItem.procedures.find((procedure) => procedure.id === itemId)
    if (!item) return
    setSelectedProcedureId(itemId)
    setProcedureStatusValue((item.status as ProcedureStatusValue) || "atendido")
    setProcedureStatusReason(item.statusReason || "")
    setProcedureStatusOpen(true)
  }

  function handleSaveProcedureStatus() {
    if (!user || !selectedProcedureId) return
    if (!procedureStatusReason.trim()) {
      toast.error("Justifique a alteração do status do procedimento.")
      return
    }

    judicial.updateProcedureStatus(caseItem.id, {
      procedureId: selectedProcedureId,
      status: procedureStatusValue,
      reason: procedureStatusReason.trim(),
      user,
    })

    setProcedureStatusOpen(false)
    setSelectedProcedureId(null)
    setProcedureStatusReason("")
    toast.success("Status do procedimento atualizado.")
  }

  function renderProcedureCidContent() {
    return (
      <div className="space-y-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Procedimentos</CardTitle>
            <CardDescription>
              Pesquise procedimentos diretamente na tabela SIGTAP do banco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={procedureSearch}
              onChange={(e) => setProcedureSearch(e.target.value)}
              placeholder="Pesquisar na tabela SIGTAP por código ou descrição"
            />

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label className="mb-1 block text-xs">Procedimento</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedProcedure}
                  onChange={(e) => setSelectedProcedure(e.target.value)}
                >
                  <option value="">
                    {loadingProcedures ? "Carregando..." : "Selecione um procedimento"}
                  </option>
                  {procedureOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sigtapCode} - {item.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="mb-1 block text-xs">Especialidade</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedProcedureSpecialty}
                  onChange={(e) => {
                    setSelectedProcedureSpecialty(e.target.value)
                    setSelectedProcedureSubSpecialty("")
                  }}
                >
                  <option value="">
                    {loadingSpecialties ? "Carregando..." : "Selecione uma especialidade"}
                  </option>
                  {specialtyOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="mb-1 block text-xs">Subespecialidade</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedProcedureSubSpecialty}
                  disabled={!selectedProcedureSpecialty || loadingSubSpecialties}
                  onChange={(e) => setSelectedProcedureSubSpecialty(e.target.value)}
                >
                  <option value="">
                    {!selectedProcedureSpecialty
                      ? "Selecione a especialidade primeiro"
                      : loadingSubSpecialties
                        ? "Carregando..."
                        : "Selecione uma subespecialidade"}
                  </option>
                  {subSpecialtyOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="button" onClick={handleAddProcedure}>
              Adicionar procedimento
            </Button>

            <div className="space-y-2">
              {caseItem.procedures.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum procedimento registrado.
                </p>
              ) : (
                caseItem.procedures.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {item.sigtapCode} - {item.description}
                        </p>
                        <Badge variant={item.active === false ? "outline" : "secondary"}>
                          {item.active === false ? "Inativo" : "Ativo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.createdByName}
                        {item.specialty ? ` • ${item.specialty}` : ""}
                        {item.subSpecialty ? ` • ${item.subSpecialty}` : ""}
                        {(item as any).updatedAt
                          ? ` • ${new Date((item as any).updatedAt).toLocaleString("pt-BR")}`
                          : item.statusUpdatedAt
                            ? ` • ${new Date(item.statusUpdatedAt).toLocaleString("pt-BR")}`
                            : ""}
                      </p>
                      {(item as any).inactiveReason && (
                        <p className="text-xs text-muted-foreground">
                          Motivo da inativação: {(item as any).inactiveReason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.active !== false && (
                        <Button
                          type="button"
                          variant="outline"
                          className="bg-transparent"
                          onClick={() => handleRemoveProcedure(item.id)}
                        >
                          Apagar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">CID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={cidSearch}
              onChange={(e) => setCidSearch(e.target.value)}
              placeholder="Pesquisar CID por código ou descrição"
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedCid}
              onChange={(e) => setSelectedCid(e.target.value)}
            >
              <option value="">{loadingCids ? "Carregando CID..." : "Selecione um CID"}</option>
              {cidOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} - {item.description}
                </option>
              ))}
            </select>
            <Button onClick={handleAddCid} disabled={loadingCids || !selectedCid}>Adicionar CID</Button>
            <div className="space-y-2">
              {caseItem.cids.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {item.code} - {item.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.active === false ? "Inativo" : "Ativo"} • {item.createdByName}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-transparent"
                    onClick={() => handleInactivateCid(item.code)}
                  >
                    {item.active === false ? "Ativar" : "Inativar"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const printDate = new Date().toLocaleString("pt-BR")
  const printedBy = user?.nome || user?.name || "Usuário não identificado"

  return (
    <div className="flex min-h-[760px] flex-col gap-3 print:min-h-0">
      <div className="hidden print:block">
        <section className="space-y-5 px-2 py-2 text-black">
          <header className="border-b-2 border-black pb-4">
            <div className="space-y-1">
              <p className="text-2xl font-bold tracking-tight">SIS Regulação</p>
              <p className="text-sm">Resumo do paciente e do processo judicial</p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
              <p>
                <span className="font-semibold">Responsável pela impressão:</span>{" "}
                {printedBy}
              </p>
              <p>
                <span className="font-semibold">Data e hora:</span> {printDate}
              </p>
            </div>
          </header>

          <section className="space-y-2">
            <p className="text-lg font-bold">
              Protocolo: {caseItem.originProtocol}
            </p>

            <p className="text-sm leading-6">
              <span className="font-semibold">{caseItem.patientName}</span> | CPF{" "}
              {caseItem.cpf} | CNS: {caseItem.patientId || "Não informado"} | Município:{" "}
              {caseItem.municipalityName}
            </p>

            <p className="text-sm leading-6">
              PGE.net: {caseItem.registration?.pgeNetNumber || "Não informado"} | Processos
              vinculados: {processNumbers.join(" | ") || "Não informado"}
            </p>

            <p className="text-sm leading-6">
              Fichas ativas:{" "}
              {caseItem.fichas
                .filter((item) => item.active !== false)
                .map((item) => `${item.system} - ${item.number || "Sem número"}`)
                .join(" | ") || "Nenhuma ficha ativa"}{" "}
              | Marca judicial: {isJudicialMarked ? "Sim" : "Não"}
            </p>

            <p className="text-sm leading-6">
              Último monitoramento:{" "}
              {caseItem.lastMonitoredAt
                ? new Date(caseItem.lastMonitoredAt).toLocaleString("pt-BR")
                : "Não informado"}
            </p>
          </section>

          <section className="border-t border-black pt-4">
            <h2 className="text-lg font-bold">Histórico de Movimentação</h2>
          </section>

          <section className="space-y-4">
            {historyItems.map((item) => {
              const badgesText =
                item.badges && item.badges.length > 0 ? item.badges.join(" • ") : ""

              return (
                <article
                  key={`print-${item.id}`}
                  className="break-inside-avoid rounded-md border border-gray-300 px-4 py-3"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-700">
                    {item.category}
                    {badgesText ? ` | ${badgesText}` : ""}
                  </p>

                  <p className="mt-1 text-sm font-bold">
                    {item.title} | {new Date(item.createdAt).toLocaleString("pt-BR")}
                    {item.subtitle ? ` • ${item.subtitle}` : ""}
                  </p>

                  {item.description && !item.html && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6">
                      {item.description}
                    </p>
                  )}

                  {item.description && item.html && (
                    <div
                      className="mt-2 text-sm leading-6"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  )}

                  {item.attachments && item.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {item.attachments.map((att) => (
                        <p key={att.id} className="text-xs text-gray-700">
                          Anexo: {att.name}
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        </section>
      </div>

      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="outline"
          className="bg-transparent"
          onClick={() => {
            if (user) {
              judicial.trackUiAction("voltar_processo_judicial", user, caseItem.id)
            }
            window.history.back()
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => {
              if (user) {
                judicial.trackUiAction("imprimir_processo_judicial", user, caseItem.id)
              }
              window.print()
            }}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>

          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => setHistoryModalOpen(true)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Ver histórico
          </Button>

          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => setAuditModalOpen(true)}
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            Auditoria
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm print:hidden">
        <CardContent className="p-3">
          <div className="flex flex-col gap-2">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={caseItem.active ? "secondary" : "outline"}>
                  {caseItem.active ? "Ativo" : "Encerrado"}
                </Badge>
                <Badge variant="outline">{caseItem.originModule.toUpperCase()}</Badge>
                <Badge variant="outline">
                  {JUDICIAL_CASE_STATUS_LABELS[caseItem.status]}
                </Badge>
                <Badge
                  variant={
                    caseItem.monitoringMode === "automatic_core"
                      ? "default"
                      : "secondary"
                  }
                >
                  {caseItem.monitoringMode === "automatic_core"
                    ? "CORE automático"
                    : "Fluxo humano"}
                </Badge>
                {latestProcessStatus && (
                  <Badge variant="secondary">
                    {PROCESS_STATUS_LABELS[latestProcessStatus.status]}
                  </Badge>
                )}
                {caseItem.finalization && (
                  <Badge variant="outline">
                    {FINALIZATION_STATUS_LABELS[caseItem.finalization.status]}
                  </Badge>
                )}
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight leading-tight">
                  {caseItem.patientName}
                </h1>

                <div className="mt-1 space-y-0.5 text-sm leading-tight text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>
                      <span className="font-semibold text-foreground">
                        Protocolo:
                      </span>{" "}
                      {caseItem.originProtocol}
                    </span>
                    <Badge variant="secondary">{currentFinalizationLabel}</Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Finalizar demanda"
                      onClick={() => setFinalizeOpen(true)}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>
                      CPF {caseItem.cpf} | CNS: {caseItem.patientId || "Não informado"} |
                      Município: {caseItem.municipalityName}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Ver contatos do município"
                      onClick={() => setMunicipalityContactsOpen(true)}
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Notificação/manifestação do município"
                      onClick={() => setNotificationModalOpen(true)}
                    >
                      <Mail className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>
                      <span className="font-semibold text-foreground">PGE.net:</span>{" "}
                      {pgeNetNumbers.join(" | ") || "Não informado"}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Adicionar PGE.net"
                      onClick={() => setPgeNetOpen(true)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>
                      <span className="font-semibold text-foreground">
                        Processos vinculados:
                      </span>{" "}
                      {processNumbers.join(" | ") || "Não informado"}
                    </span>
                    <Badge variant="outline">{currentProcessStatusLabel}</Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Alterar status do processo judicial"
                      onClick={() => setProcessStatusOpen(true)}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>

                  <p>
                    Último monitoramento:{" "}
                    {caseItem.lastMonitoredAt
                      ? new Date(caseItem.lastMonitoredAt).toLocaleString("pt-BR")
                      : "Não informado"}
                  </p>
                </div>
		


              </div>

              <div className="space-y-1 text-sm leading-tight text-muted-foreground">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>
                    <span className="font-semibold text-foreground">Fichas ativas:</span>{" "}
                    {caseItem.fichas
                      .filter((item) => item.active !== false)
                      .map((item) => `${item.system} - ${item.number || "Sem número"}`)
                      .join(" | ") || "Nenhuma ficha ativa"}
                    {" | "}
                    <span className="font-semibold text-foreground">Marca judicial:</span>{" "}
                    <span
                      className={
                        isJudicialMarked
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-red-700"
                      }
                    >
                      {isJudicialMarked ? "Sim" : "Não"}
                    </span>
                    {caseItem.finalization?.reason ? (
                      <>
                        {" | "}
                        <span className="font-semibold text-foreground">
                          Justificativa final:
                        </span>{" "}
                        {caseItem.finalization.reason}
                      </>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    title="Adicionar ficha CORE/SISREG"
                    onClick={() => setFichaModalOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-start gap-1.5">
                  <span className="font-semibold text-foreground">Procedimentos SIGTAP:</span>
                  <div className="space-y-0.5">
                    {activeProcedures.length === 0 ? (
                      <span>Nenhum procedimento registrado.</span>
                    ) : (
                      activeProcedures.map((item) => (
                        <p key={item.id}>
                          {item.sigtapCode} - {item.description}
                          {item.specialty || item.subSpecialty
                            ? ` | ${item.specialty || "Especialidade"} - ${
                                item.subSpecialty || "Subespecialidade"
                              }`
                            : ""}
                        </p>
                      ))
                    )}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    title="Adicionar procedimento SIGTAP"
                    onClick={() => setProcedureCidModalOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-start gap-1.5">
                  <span className="font-semibold text-foreground">CID10:</span>
                  <div className="space-y-0.5">
                    {caseItem.cids.length === 0 ? (
                      <span>Nenhum CID registrado.</span>
                    ) : (
                      caseItem.cids.map((item) => (
                        <p key={item.id}>
                          {item.code} - {item.description}
                        </p>
                      ))
                    )}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    title="Adicionar CID10"
                    onClick={() => setProcedureCidModalOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-3 print:hidden">
        <TabsList className="hidden">
          <TabsTrigger value="monitoramento">Monitoramento</TabsTrigger>
          <TabsTrigger value="cadastros">Procedimento/CID</TabsTrigger>
          <TabsTrigger value="anexos">Anexos</TabsTrigger>
          <TabsTrigger value="fichas">Fichas (CORE/SISREG)</TabsTrigger>
          <TabsTrigger value="municipio">
            Notificação/Manifestação do município
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria e motivos da exibição</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoramento" className="mt-0 min-h-[640px] space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nova movimentação</CardTitle>
              <CardDescription>
                O envio ao Agendamento da Demanda e demais movimentações ficam
                centralizados aqui.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">Movimentação</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as MovementType)}
                  >
                    {MOVEMENT_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {MOVEMENT_TYPE_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </div>

                {movementType === "agendamento" && (
                  <div>
                    <Label className="mb-1 block text-xs">
                      Data do agendamento
                    </Label>
                    <Input
                      type="datetime-local"
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                    />
                  </div>
                )}

                {["solicitacao_inclusao", "reiteracao"].includes(movementType) && (
                  <div>
                    <Label className="mb-1 block text-xs">
                      Data da solicitação
                    </Label>
                    <Input
                      type="date"
                      value={responseRequestedAt}
                      onChange={(e) => setResponseRequestedAt(e.target.value)}
                    />
                  </div>
                )}

                {["sequestro", "bloqueio"].includes(movementType) && (
                  <>
                    <div>
                      <Label className="mb-1 block text-xs">Valor do Estado</Label>
                      <Input
                        value={stateAmount}
                        onChange={(e) => setStateAmount(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>

                    <div>
                      <Label className="mb-1 block text-xs">
                        Valor do Município
                      </Label>
                      <Input
                        value={municipalityAmount}
                        onChange={(e) => setMunicipalityAmount(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                  </>
                )}

                {movementType === "encerramento_processo" && (
                  <div>
                    <Label className="mb-1 block text-xs">
                      Motivo do encerramento
                    </Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {CLOSE_REASONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="lg:col-span-2">
                  <Label className="mb-1 block text-xs">
                    Descrição obrigatória
                  </Label>
                  <Textarea
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
                <div>
                  <Label className="mb-1 block text-xs">
                    Documentos da movimentação
                  </Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => setSelectedMovementFiles(e.target.files)}
                  />
                </div>

                {fileListToArray(selectedMovementFiles).length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-sm font-medium">Arquivos selecionados</p>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {fileListToArray(selectedMovementFiles).map((file) => (
                        <p key={`${file.name}-${file.size}`}>
                          {file.name} • {formatFileSize(file.size)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}


                <Input
                  value={attachmentNames}
                  onChange={(e) => setAttachmentNames(e.target.value)}
                  placeholder="Arquivos enviados"
                />

                {uploadedMovementFiles.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    {uploadedMovementFiles.map((file) => (
                      <a
                        key={file.relativePath}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-primary underline"
                      >
                        {file.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveMovement}>
                  <Send className="mr-2 h-4 w-4" />
                  {movementType === "envio_agendamento_demanda"
                    ? "Salvar e enviar ao agendamento"
                    : movementType === "encerramento_processo"
                      ? "Salvar e encerrar processo"
                      : "Salvar movimentação"}
                </Button>

                <Button
                  variant="outline"
                  className="bg-transparent"
                  onClick={resetMovementForm}
                >
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Últimas movimentações</CardTitle>
              <CardDescription>
                Exibe as últimas movimentações registradas no processo, com até 5 por página.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {paginatedLatestMovements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma movimentação registrada.
                </p>
              ) : (
                paginatedLatestMovements.map((item) => (
                  <div key={`ult-${item.id}`} className="rounded-xl border border-border p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.category}</Badge>
                      {(item.badges || []).slice(0, 2).map((badge) => (
                        <Badge key={`ult-${item.id}-${badge}`} variant="secondary">
                          {badge}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                      {item.subtitle ? ` • ${item.subtitle}` : ""}
                    </p>
                    {item.description && (
                      item.html ? (
                        <div
                          className="prose prose-sm mt-1 line-clamp-4 max-w-none text-sm text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: item.description }}
                        />
                      ) : (
                        <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )
                    )}
                    {item.description && (
                      <Button
                        type="button"
                        variant="link"
                        className="mt-1 h-auto p-0 text-xs"
                        onClick={() => setSelectedHistoryItem(item)}
                      >
                        Ler mais...
                      </Button>
                    )}
                    {item.attachments && item.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {item.attachments.map((att) => (
                          <div key={`ult-att-${item.id}-${att.id}`} className="rounded-lg border border-border p-2">
                            <p className="text-sm font-medium">{att.name}</p>
                            <AttachmentActions attachment={att} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  Página {latestMovementsPage} de {totalLatestMovementsPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-transparent"
                    disabled={latestMovementsPage <= 1}
                    onClick={() =>
                      setLatestMovementsPage((prev) => Math.max(1, prev - 1))
                    }
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-transparent"
                    disabled={latestMovementsPage >= totalLatestMovementsPages}
                    onClick={() =>
                      setLatestMovementsPage((prev) =>
                        Math.min(totalLatestMovementsPages, prev + 1),
                      )
                    }
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="cadastros" className="mt-0 min-h-[640px] space-y-4">
          {renderProcedureCidContent()}
        </TabsContent>

        <TabsContent value="anexos" className="mt-0 min-h-[640px] space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Arquivos selecionados na sessão
              </CardTitle>
              <CardDescription>
                Os arquivos escolhidos nos formulários aparecem aqui antes do envio
                definitivo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingSelectedFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum arquivo selecionado nesta sessão.
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingSelectedFiles.map(({ scope, file }) => (
                    <div
                      key={`${scope}-${file.name}-${file.size}`}
                      className="rounded-xl border border-border p-3"
                    >
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {scope} • {formatFileSize(file.size)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Todos os anexos do processo
              </CardTitle>
              <CardDescription>
                Lista paginada contendo anexos do processo, movimentações e manifestações.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {paginatedAttachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum anexo registrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {paginatedAttachments.map((item) => (
                    <div
                      key={`${item.id}-${item.createdAt}`}
                      className="rounded-xl border border-border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{item.category}</Badge>
                        <Badge variant="secondary">{item.source}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString("pt-BR")} •{" "}
                        {item.createdByName}
                      </p>
                      <AttachmentActions attachment={item} />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Página {attachmentsPage} de {totalAttachmentPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="bg-transparent"
                    disabled={attachmentsPage <= 1}
                    onClick={() =>
                      setAttachmentsPage((prev) => Math.max(1, prev - 1))
                    }
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-transparent"
                    disabled={attachmentsPage >= totalAttachmentPages}
                    onClick={() =>
                      setAttachmentsPage((prev) =>
                        Math.min(totalAttachmentPages, prev + 1),
                      )
                    }
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fichas" className="mt-0 min-h-[640px] space-y-4">
          <JudicialFichasPanel caseId={caseItem.id} />
        </TabsContent>

        <TabsContent value="municipio" className="mt-0 min-h-[640px] space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados do município</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <InfoField label="Município" value={caseItem.municipalityName} strong />
              <InfoField
                label="E-mails"
                value={contacts?.emails.join(", ") || "Não informado"}
              />
              <InfoField
                label="Responsáveis"
                value={contacts?.contacts.join(", ") || "Não informado"}
              />
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notificação ao município</CardTitle>
              <CardDescription>
                Editor em formato de e-mail com assunto, formatação, alinhamento e
                anexos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <Label className="mb-1 block text-xs">Modelo de resposta</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedManifestTemplateId}
                    onChange={(e) => setSelectedManifestTemplateId(e.target.value)}
                  >
                    <option value="">Selecione um modelo salvo no Admin Judicial</option>
                    {judicial.emailTemplates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-transparent"
                    onClick={handleApplyManifestTemplate}
                  >
                    Usar modelo
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                Os modelos cadastrados no Admin Judicial podem preencher automaticamente assunto e corpo usando placeholders do processo, inclusive $user_sistema para inserir o nome do usuário logado.
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">Destinatários</Label>
                  <Input
                    value={manifestRecipients}
                    onChange={(e) => setManifestRecipients(e.target.value)}
                    placeholder="email1@municipio.gov.br, email2@..."
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Assunto</Label>
                  <Input
                    value={manifestSubject}
                    onChange={(e) => setManifestSubject(e.target.value)}
                    placeholder="Assunto da notificação"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-muted/10 p-3">
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
                  <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Editor
                  </span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        runEditorCommand("formatBlock", e.target.value)
                        e.currentTarget.value = ""
                      }
                    }}
                  >
                    <option value="">Formato</option>
                    <option value="<p>">Parágrafo</option>
                    <option value="<h2>">Título</option>
                    <option value="<blockquote>">Citação</option>
                  </select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="bg-transparent"
                    title="Negrito"
                    onClick={() => runEditorCommand("bold")}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="bg-transparent"
                    title="Itálico"
                    onClick={() => runEditorCommand("italic")}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="bg-transparent"
                    title="Sublinhado"
                    onClick={() => runEditorCommand("underline")}
                  >
                    <Underline className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="bg-transparent"
                    title="Alinhar à esquerda"
                    onClick={() => runEditorCommand("justifyLeft")}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="bg-transparent"
                    title="Centralizar"
                    onClick={() => runEditorCommand("justifyCenter")}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="bg-transparent"
                    title="Alinhar à direita"
                    onClick={() => runEditorCommand("justifyRight")}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="bg-transparent"
                    title="Lista não ordenada"
                    onClick={() => runEditorCommand("insertUnorderedList")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="bg-transparent"
                    title="Lista ordenada"
                    onClick={() => runEditorCommand("insertOrderedList")}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-transparent text-xs"
                    onClick={() => runEditorCommand("removeFormat")}
                  >
                    Limpar formatação
                  </Button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="prose prose-sm min-h-[260px] max-w-none rounded-lg border border-input bg-background p-4 text-sm outline-none"
                  onInput={(e) =>
                    setManifestHtml((e.target as HTMLDivElement).innerHTML)
                  }
                  dangerouslySetInnerHTML={{ __html: manifestHtml }}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
                <div>
                  <Label className="mb-1 block text-xs">Anexos</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => setSelectedManifestFiles(e.target.files)}
                  />
                </div>

                {fileListToArray(selectedManifestFiles).length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                    {fileListToArray(selectedManifestFiles).map((file) => (
                      <p key={`${file.name}-${file.size}`}>
                        {file.name} • {formatFileSize(file.size)}
                      </p>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="bg-transparent"
                  disabled={uploadingManifest}
                  onClick={handleUploadManifest}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingManifest ? "Enviando..." : "Enviar anexos"}
                </Button>

                <Input
                  value={manifestAttachments}
                  onChange={(e) => setManifestAttachments(e.target.value)}
                  placeholder="Arquivos enviados"
                />

                {uploadedManifestFiles.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    {uploadedManifestFiles.map((file) => (
                      <a
                        key={file.relativePath}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-primary underline"
                      >
                        {file.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleSendMunicipalityNotification}>
                <Mail className="mr-2 h-4 w-4" />
                Registrar envio ao município
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Manifestações registradas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {caseItem.municipalityManifestations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem manifestações registradas.
                </p>
              ) : (
                [...caseItem.municipalityManifestations].reverse().map((item) => (
                  <div key={item.id} className="rounded-xl border border-border p-4">
                    <p className="text-sm font-medium">{item.createdByName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </p>
                    {/<[^>]+>/.test(item.description) ? (
                      <div
                        className="prose prose-sm mt-3 max-w-none"
                        dangerouslySetInnerHTML={{ __html: item.description }}
                      />
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    {item.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {item.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="rounded-lg border border-border p-3"
                          >
                            <p className="text-sm font-medium">{attachment.name}</p>
                            <AttachmentActions attachment={attachment} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-0 min-h-[640px] space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Linha do tempo do processo</CardTitle>
              <CardDescription>
                Inclui movimentações, fichas, procedimentos, CIDs, histórico CORE e
                manifestações do município.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {historyItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-border p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.category}</Badge>
                    {(item.badges || []).map((badge) => (
                      <Badge key={`${item.id}-${badge}`} variant="secondary">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                    {item.subtitle ? ` • ${item.subtitle}` : ""}
                  </p>
                  {item.description &&
                    (item.html ? (
                      <div
                        className="prose prose-sm mt-2 max-w-none"
                        dangerouslySetInnerHTML={{ __html: item.description }}
                      />
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    ))}
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {item.attachments.map((att) => (
                        <div key={att.id} className="rounded-lg border border-border p-3">
                          <p className="text-sm font-medium">{att.name}</p>
                          <AttachmentActions attachment={att} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-0 min-h-[640px] space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Motivos de exibição e fila</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Scale className="h-4 w-4" />
                  Fluxo atual
                </div>
                <p className="text-sm text-muted-foreground">
                  {caseItem.monitoringModeReason}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="h-4 w-4" />
                  Status
                </div>
                <p className="text-sm text-muted-foreground">
                  {JUDICIAL_CASE_STATUS_LABELS[caseItem.status]}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Agendamento
                </div>
                <p className="text-sm text-muted-foreground">
                  {caseItem.appointmentDate
                    ? new Date(caseItem.appointmentDate).toLocaleString("pt-BR")
                    : "Sem agendamento informado"}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  Fila
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {Object.values(QUEUE_REASON_LABELS)
                    .slice(0, 5)
                    .map((item) => (
                      <p key={item}>• {item}</p>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Auditoria de tela</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {judicial.auditTrail
                .filter((item) => item.caseId === caseItem.id)
                .slice()
                .reverse()
                .map((item) => (
                  <div key={item.id} className="rounded-xl border border-border p-4">
                    <p className="text-sm font-medium">{item.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("pt-BR")} •{" "}
                      {item.action}
                    </p>
                    {item.details && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.details}
                      </p>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={fichaModalOpen} onOpenChange={setFichaModalOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Fichas CORE/SISREG</DialogTitle>
            <DialogDescription>
              Cadastre e acompanhe fichas vinculadas ao processo judicial.
            </DialogDescription>
          </DialogHeader>
          <JudicialFichasPanel caseId={caseItem.id} />
        </DialogContent>
      </Dialog>

      <Dialog open={procedureCidModalOpen} onOpenChange={setProcedureCidModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Procedimento/CID</DialogTitle>
            <DialogDescription>
              Adicione procedimentos da tabela SIGTAP e CIDs ao processo judicial.
            </DialogDescription>
          </DialogHeader>

          {renderProcedureCidContent()}
        </DialogContent>
      </Dialog>

      <Dialog open={notificationModalOpen} onOpenChange={setNotificationModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notificação/Manifestação do município</DialogTitle>
            <DialogDescription>
              Registre notificação, manifestação e anexos para o município envolvido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <InfoField label="Município" value={caseItem.municipalityName} strong />
              <InfoField
                label="E-mails"
                value={contacts?.emails.join(", ") || "Não informado"}
              />
              <InfoField
                label="Responsáveis"
                value={contacts?.contacts.join(", ") || "Não informado"}
              />
            </div>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notificação ao município</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div>
                    <Label className="mb-1 block text-xs">Modelo de resposta</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedManifestTemplateId}
                      onChange={(e) => setSelectedManifestTemplateId(e.target.value)}
                    >
                      <option value="">Selecione um modelo salvo no Admin Judicial</option>
                      {judicial.emailTemplates.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-transparent"
                      onClick={handleApplyManifestTemplate}
                    >
                      Usar modelo
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="mb-1 block text-xs">Destinatários</Label>
                    <Input
                      value={manifestRecipients}
                      onChange={(e) => setManifestRecipients(e.target.value)}
                      placeholder="email1@municipio.gov.br, email2@..."
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Assunto</Label>
                    <Input
                      value={manifestSubject}
                      onChange={(e) => setManifestSubject(e.target.value)}
                      placeholder="Assunto da notificação"
                    />
                  </div>
                </div>

                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="prose prose-sm min-h-[220px] max-w-none rounded-lg border border-input bg-background p-4 text-sm outline-none"
                  onInput={(e) =>
                    setManifestHtml((e.target as HTMLDivElement).innerHTML)
                  }
                  dangerouslySetInnerHTML={{ __html: manifestHtml }}
                />

                <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
                  <Label className="mb-1 block text-xs">Anexos</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => setSelectedManifestFiles(e.target.files)}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    className="bg-transparent"
                    disabled={uploadingManifest}
                    onClick={handleUploadManifest}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingManifest ? "Enviando..." : "Enviar anexos"}
                  </Button>

                  <Input
                    value={manifestAttachments}
                    onChange={(e) => setManifestAttachments(e.target.value)}
                    placeholder="Arquivos enviados"
                  />
                </div>

                <Button onClick={handleSendMunicipalityNotification}>
                  <Mail className="mr-2 h-4 w-4" />
                  Registrar envio ao município
                </Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedHistoryItem}
        onOpenChange={(open) => {
          if (!open) setSelectedHistoryItem(null)
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedHistoryItem && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedHistoryItem.title}</DialogTitle>
                <DialogDescription>
                  {new Date(selectedHistoryItem.createdAt).toLocaleString("pt-BR")}
                  {selectedHistoryItem.subtitle ? ` • ${selectedHistoryItem.subtitle}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{selectedHistoryItem.category}</Badge>
                  {(selectedHistoryItem.badges || []).map((badge) => (
                    <Badge key={`modal-read-more-${selectedHistoryItem.id}-${badge}`} variant="secondary">
                      {badge}
                    </Badge>
                  ))}
                </div>

                {selectedHistoryItem.description ? (
                  selectedHistoryItem.html ? (
                    <div
                      className="prose prose-sm max-w-none rounded-xl border border-border bg-muted/20 p-4"
                      dangerouslySetInnerHTML={{ __html: selectedHistoryItem.description }}
                    />
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-muted/20 p-4">
                      <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        {selectedHistoryItem.description}
                      </p>
                    </div>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Esta movimentação não possui texto registrado.
                  </p>
                )}

                {selectedHistoryItem.attachments && selectedHistoryItem.attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Anexos</p>
                    {selectedHistoryItem.attachments.map((att) => (
                      <div
                        key={`modal-read-more-att-${selectedHistoryItem.id}-${att.id}`}
                        className="rounded-lg border border-border p-3"
                      >
                        <p className="text-sm font-medium">{att.name}</p>
                        <AttachmentActions attachment={att} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico do processo</DialogTitle>
            <DialogDescription>
              Linha do tempo contendo movimentações, fichas, procedimentos, CIDs e manifestações.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {historyItems.map((item) => (
              <div key={`modal-hist-${item.id}`} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.category}</Badge>
                  {(item.badges || []).map((badge) => (
                    <Badge key={`modal-hist-${item.id}-${badge}`} variant="secondary">
                      {badge}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                  {item.subtitle ? ` • ${item.subtitle}` : ""}
                </p>
                {item.description &&
                  (item.html ? (
                    <div
                      className="prose prose-sm mt-2 max-w-none"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  ) : (
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ))}
                {item.attachments && item.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {item.attachments.map((att) => (
                      <div key={`modal-hist-att-${item.id}-${att.id}`} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-medium">{att.name}</p>
                        <AttachmentActions attachment={att} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auditoria e motivos da exibição</DialogTitle>
            <DialogDescription>
              Dados de auditoria da tela e justificativas de exibição no fluxo judicial.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Scale className="h-4 w-4" />
                Fluxo atual
              </div>
              <p className="text-sm text-muted-foreground">
                {caseItem.monitoringModeReason}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="h-4 w-4" />
                Status
              </div>
              <p className="text-sm text-muted-foreground">
                {JUDICIAL_CASE_STATUS_LABELS[caseItem.status]}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Agendamento
              </div>
              <p className="text-sm text-muted-foreground">
                {caseItem.appointmentDate
                  ? new Date(caseItem.appointmentDate).toLocaleString("pt-BR")
                  : "Sem agendamento informado"}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="h-4 w-4" />
                Fila
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {Object.values(QUEUE_REASON_LABELS)
                  .slice(0, 5)
                  .map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {judicial.auditTrail
              .filter((item) => item.caseId === caseItem.id)
              .slice()
              .reverse()
              .map((item) => (
                <div key={`modal-audit-${item.id}`} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">{item.userName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("pt-BR")} • {item.action}
                  </p>
                  {item.details && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.details}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={processStatusOpen} onOpenChange={setProcessStatusOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Status do processo judicial</DialogTitle>
            <DialogDescription>
              Informe o status atual do processo. O último status registrado aparece
              em destaque ao lado de “Processos vinculados”.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs">Status obrigatório</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={processStatus}
                onChange={(e) => {
                  setProcessStatus(
                    e.target.value as keyof typeof PROCESS_STATUS_LABELS,
                  )
                  setProcessStatusReason("")
                              setProcessPrazoInicio("")
                  setProcessPrazoDescricao("")
                }}
              >
                <option value="em_andamento">EM ANDAMENTO</option>
                <option value="descumprimento">DESCUMPRIMENTO</option>
                <option value="decisao_judicial_prazo">
                  DECISÃO JUDICIAL COM PRAZO
                </option>
              </select>
            </div>

            {(processStatus === "em_andamento" ||
              processStatus === "descumprimento") && (
              <div>
                <Label className="mb-1 block text-xs">
                  Justificativa obrigatória
                </Label>
                <Textarea
                  rows={4}
                  value={processStatusReason}
                  onChange={(e) => setProcessStatusReason(e.target.value)}
                  placeholder="Descreva a situação atual do processo judicial."
                />
              </div>
            )}

            {processStatus === "decisao_judicial_prazo" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">
                    Data de início do prazo
                  </Label>
                  <Input
                    type="date"
                    value={processPrazoInicio}
                    onChange={(e) => setProcessPrazoInicio(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-1 block text-xs">Prazo</Label>
                  <Input
                    value={processPrazoDescricao}
                    onChange={(e) => setProcessPrazoDescricao(e.target.value)}
                    placeholder="Ex.: 5 dias, 10 dias, 1 mês"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                onClick={() => setProcessStatusOpen(false)}
              >
                Cancelar
              </Button>

              <Button type="button" onClick={handleRegisterProcessStatus}>
                Registrar status
              </Button>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-semibold">Histórico de status</p>

              {[...(caseItem.processStatusHistory ?? [])].length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum status de processo registrado.
                </p>
              ) : (
                [...(caseItem.processStatusHistory ?? [])]
                  .slice()
                  .reverse()
                  .map((item) => (
                    <div key={item.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {PROCESS_STATUS_LABELS[item.status]}
                        </Badge>

                        {item.deadlineType && item.deadlineValue && (
                          <Badge variant="secondary">
                            {item.deadlineValue} {item.deadlineType}
                          </Badge>
                        )}
                      </div>

                      <p className="mt-2 text-sm font-medium">{item.createdByName}</p>

                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString("pt-BR")}
                      </p>

                      {item.reason && (
                        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                          {item.reason}
                        </p>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pgeNetOpen} onOpenChange={setPgeNetOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Processos vinculados ao PGE.net</DialogTitle>
            <DialogDescription>
              Adicione números de PGE.net e processos vinculados ao monitoramento
              judicial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2 rounded-xl border border-border p-4">
              <Label className="text-xs">Adicionar PGE.net</Label>
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  value={newPgeNetNumber}
                  onChange={(e) => setNewPgeNetNumber(e.target.value)}
                  placeholder="Número do PGE.net"
                />
                <Button type="button" onClick={handleAddPgeNetNumber}>
                  Adicionar PGE.net
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {pgeNetNumbers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum PGE.net registrado.
                  </p>
                ) : (
                  pgeNetNumbers.map((number) => (
                    <Badge key={number} variant="secondary">
                      {number}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border p-4">
              <Label className="text-xs">Adicionar processo vinculado</Label>
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  value={newProcessNumber}
                  onChange={(e) => setNewProcessNumber(e.target.value)}
                  placeholder="Número do processo vinculado"
                />
                <Button type="button" onClick={handleAddProcessNumber}>
                  Adicionar processo
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {processNumbers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum processo vinculado.
                  </p>
                ) : (
                  processNumbers.map((number) => (
                    <Badge key={number} variant="outline">
                      {number}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={municipalityContactsOpen} onOpenChange={setMunicipalityContactsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contatos do município</DialogTitle>
            <DialogDescription>
              Dados de contato vinculados ao município envolvido no processo judicial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <InfoField label="Município" value={caseItem.municipalityName} strong />
            <InfoField
              label="E-mails"
              value={contacts?.emails.join(", ") || "Não informado"}
            />
            <InfoField
              label="Telefones"
              value={contacts?.phones.join(", ") || "Não informado"}
            />
            <InfoField
              label="Responsáveis"
              value={contacts?.contacts.join(", ") || "Não informado"}
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={procedureStatusOpen} onOpenChange={setProcedureStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar status do procedimento</DialogTitle>
            <DialogDescription>
              Escolha o novo status do SIGTAP e justifique a alteração.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs">Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={procedureStatusValue}
                onChange={(e) =>
                  setProcedureStatusValue(e.target.value as ProcedureStatusValue)
                }
              >
                {PROCEDURE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {JUDICIAL_PROCEDURE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Justificativa</Label>
              <Textarea
                rows={4}
                value={procedureStatusReason}
                onChange={(e) => setProcedureStatusReason(e.target.value)}
                placeholder="Explique a alteração do status"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                onClick={() => setProcedureStatusOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveProcedureStatus}>
                Salvar status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Finalizar demanda</DialogTitle>
            <DialogDescription>
              Escolha a situação da demanda judicial e preencha os campos obrigatórios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-xs">Status da demanda</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "pendente",
                    "resolvido",
                    "cumprido",
                    "bloqueio",
                    "sequestro",
                    "obito",
                    "arquivado",
                  ] as Array<keyof typeof FINALIZATION_STATUS_LABELS>
                ).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={status === finalizeStatus ? "default" : "outline"}
                    className={
                      status === finalizeStatus
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    }
                    onClick={() => {
                      setFinalizeStatus(status)
                      setFinalizeReason("")
                      setFinalizeValorEstado("")
                      setFinalizeValorMunicipio("")
                    }}
                  >
                    {FINALIZATION_STATUS_LABELS[status].toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            {finalizeStatus === "pendente" && (
              <div className="space-y-3">
                <div>
                  <Label className="mb-1 block text-xs">
                    Onde está pendente?
                  </Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={finalizePendingLocation}
                    onChange={(e) =>
                      setFinalizePendingLocation(
                        e.target.value as "ses" | "core" | "municipio",
                      )
                    }
                  >
                    <option value="ses">Pendente SES</option>
                    <option value="core">Pendente CORE</option>
                    <option value="municipio">Pendente Município</option>
                  </select>
                </div>

                <div>
                  <Label className="mb-1 block text-xs">
                    Justificativa obrigatória
                  </Label>
                  <Textarea
                    rows={4}
                    value={finalizeReason}
                    onChange={(e) => setFinalizeReason(e.target.value)}
                    placeholder="Descreva por que a demanda está pendente."
                  />
                </div>
              </div>
            )}

            {(finalizeStatus === "resolvido" || finalizeStatus === "cumprido") && (
              <div>
                <Label className="mb-1 block text-xs">
                  Justificativa obrigatória
                </Label>
                <Textarea
                  rows={4}
                  value={finalizeReason}
                  onChange={(e) => setFinalizeReason(e.target.value)}
                  placeholder={finalizeStatus === "cumprido" ? "Justifique o cumprimento da demanda." : "Justifique a resolução da demanda."}
                />
              </div>
            )}

            {(finalizeStatus === "bloqueio" || finalizeStatus === "sequestro") && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">
                    Valor para o Estado
                  </Label>
                  <Input
                    value={finalizeValorEstado}
                    onChange={(e) => setFinalizeValorEstado(e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <Label className="mb-1 block text-xs">
                    Valor para o Município
                  </Label>
                  <Input
                    value={finalizeValorMunicipio}
                    onChange={(e) => setFinalizeValorMunicipio(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
            )}

            {(finalizeStatus === "obito" || finalizeStatus === "arquivado") && (
              <div>
                <Label className="mb-1 block text-xs">
                  Justificativa obrigatória
                </Label>
                <Textarea
                  rows={4}
                  value={finalizeReason}
                  onChange={(e) => setFinalizeReason(e.target.value)}
                  placeholder={finalizeStatus === "obito" ? "Justifique o encerramento por óbito." : "Justifique o arquivamento da demanda."}
                />
              </div>
            )}

            {caseItem.finalization && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">
                    Última finalização:
                  </span>{" "}
                  {FINALIZATION_STATUS_LABELS[caseItem.finalization.status]}
                </p>
                <p>
                  {new Date(caseItem.finalization.createdAt).toLocaleString("pt-BR")} •{" "}
                  {caseItem.finalization.createdByName}
                </p>
                {caseItem.finalization.pendingLocation && (
                  <p>
                    Pendente em: {caseItem.finalization.pendingLocation.toUpperCase()}
                  </p>
                )}
                {caseItem.finalization.reason && (
                  <p className="whitespace-pre-line">
                    Justificativa: {caseItem.finalization.reason}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                onClick={() => setFinalizeOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleFinalizeDemand}>
                Salvar finalização
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}