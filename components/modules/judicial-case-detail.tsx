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
  Strikethrough,
  AlignJustify,
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
  "encaminhar_demanda_municipio",
  "resposta_procuradoria",
  "envio_agendamento_demanda",
  "agendamento",
  "solicitacao_inclusao",
  "reiteracao",
  "descumprimento",
  "cumprimento",
  "procedimento_nao_sus",
  "competencia_municipio",
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

function normalizeEmailList(value: string | string[] | undefined) {
  const source = Array.isArray(value) ? value.join(",") : String(value ?? "")
  const items = source
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)

  const unique: string[] = []
  for (const item of items) {
    if (!unique.some((email) => email.toLowerCase() === item.toLowerCase())) {
      unique.push(item)
    }
  }

  return unique
}

function mergeRequiredEmails(value: string, requiredEmails: string[]) {
  const items = normalizeEmailList(value)
  const merged = [...items]

  for (const required of requiredEmails) {
    if (!merged.some((email) => email.toLowerCase() === required.toLowerCase())) {
      merged.unshift(required)
    }
  }

  return merged.join(", ")
}

function htmlToText(value: string) {
  return String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeMunicipalityKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
}

function adminText(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function adminList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => adminText(item)).filter(Boolean)
  }

  return String(value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function adminArray(value: unknown) {
  if (Array.isArray(value)) return value

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["items", "data", "rows", "templates", "municipios"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[]
    }
  }

  return []
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
  return String(value ?? "").replace(/\$([a-zA-Z0-9_]+)/g, (match) => {
    const replacement = replacements[match]
    if (replacement === undefined || replacement === null) return match
    const text = String(replacement)
    return text.trim() ? text : match
  })
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

function sanitizeEmailHtml(value: string) {
  const fallback = String(value ?? "")
    .replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")

  if (typeof DOMParser === "undefined") return fallback

  const doc = new DOMParser().parseFromString("<div>" + String(value ?? "") + "</div>", "text/html")
  doc.querySelectorAll("script,style,meta,link,o\\:p").forEach((node) => node.remove())

  doc.body.querySelectorAll("*").forEach((node) => {
    const element = node as HTMLElement
    const styles: string[] = []

    const textAlign = element.style.textAlign
    const fontFamily = element.style.fontFamily
    const fontSize = element.style.fontSize
    const fontWeight = element.style.fontWeight
    const fontStyle = element.style.fontStyle
    const textDecoration = element.style.textDecoration || element.style.textDecorationLine

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (element.tagName === "A" && name === "href") return
      element.removeAttribute(attribute.name)
    })

    if (textAlign) styles.push("text-align: " + textAlign)
    if (fontFamily && fontFamily.length < 80 && !fontFamily.includes(";")) styles.push("font-family: " + fontFamily)
    if (fontSize && fontSize.length < 40 && !fontSize.includes(";")) styles.push("font-size: " + fontSize)
    if (fontWeight && /^(bold|normal|[1-9]00)$/.test(fontWeight)) styles.push("font-weight: " + fontWeight)
    if (fontStyle && /^(italic|normal)$/.test(fontStyle)) styles.push("font-style: " + fontStyle)
    if (textDecoration && textDecoration.length < 80 && !textDecoration.includes(";")) styles.push("text-decoration: " + textDecoration)

    if (styles.length > 0) element.setAttribute("style", styles.join("; "))
  })

  return doc.body.firstElementChild?.innerHTML || fallback
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size)) return "-"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function formatCns(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "")
  return digits.length === 15 ? digits : "Não informado"
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
  competencia_municipio: "Competência do Município",
  nao_sus: "Não SUS",
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

  const [supportMaterialFormOpen, setSupportMaterialFormOpen] = useState(false)
  const [supportMaterialListOpen, setSupportMaterialListOpen] = useState(false)
  const [supportMaterialName, setSupportMaterialName] = useState("")
  const [selectedSupportMaterialFiles, setSelectedSupportMaterialFiles] = useState<FileList | null>(null)
  const [uploadingSupportMaterial, setUploadingSupportMaterial] = useState(false)

  const supportMaterials = useMemo(() => {
    const prefix = "[MATERIAL_DE_APOIO]"
    return (caseItem?.movements || [])
      .filter((item) => String(item.description || "").startsWith(prefix))
      .map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        createdByName: item.createdByName,
        name: String(item.description || "").replace(prefix, "").trim() || "Material de apoio",
        attachments: Array.isArray(item.attachments) ? item.attachments : [],
      }))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
  }, [caseItem?.movements])

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
  const [additionalManifestRecipients, setAdditionalManifestRecipients] = useState("")
  const [selectedManifestTemplateId, setSelectedManifestTemplateId] = useState("")
  const [adminEmailTemplates, setAdminEmailTemplates] = useState<any[]>([])
  const [adminMunicipalityContacts, setAdminMunicipalityContacts] = useState<any[]>([])
  const [adminJudicialResourcesLoaded, setAdminJudicialResourcesLoaded] = useState(false)
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
  const [forwardMunicipalityMode, setForwardMunicipalityMode] = useState(false)
  const [procuradoriaModalOpen, setProcuradoriaModalOpen] = useState(false)
  const [selectedProcuradoriaTemplateId, setSelectedProcuradoriaTemplateId] = useState("")
  const defaultProcuradoriaHtml = "<p>Prezados,</p><p></p><p>Atenciosamente.</p>"
  const [procuradoriaHtml, setProcuradoriaHtml] = useState(defaultProcuradoriaHtml)
  const [procuradoriaEditorKey, setProcuradoriaEditorKey] = useState(0)
  const procuradoriaEditorRef = useRef<HTMLDivElement | null>(null)
  const procuradoriaHtmlRef = useRef(defaultProcuradoriaHtml)
  const [generatingProcuradoria, setGeneratingProcuradoria] = useState(false)
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


  function handleMovementTypeChange(value: string) {
    const nextType = value as MovementType

    if (nextType === "encaminhar_demanda_municipio") {
      setMovementType("monitoramento")
      setForwardMunicipalityMode(true)
      setNotificationModalOpen(true)
      setSelectedManifestTemplateId("__blank__")
      applyBlankManifestEditor()
      setManifestRecipients((prev) => mergeRequiredEmails(prev, requiredMunicipalityEmails))
      return
    }

    if (nextType === "resposta_procuradoria") {
      setMovementType("monitoramento")
      setSelectedProcuradoriaTemplateId("")
      setProcuradoriaEditorContent(defaultProcuradoriaHtml)
      setProcuradoriaModalOpen(true)
      return
    }

    setMovementType(nextType)
  }

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
  const municipalityContactsSource =
    adminJudicialResourcesLoaded
      ? adminMunicipalityContacts
      : judicial.municipalityContacts

  const caseMunicipalityKey = normalizeMunicipalityKey(caseItem.municipalityName)

  const contacts = municipalityContactsSource.find(
    (item) => normalizeMunicipalityKey(item.municipalityName) === caseMunicipalityKey,
  )

  const availableEmailTemplates = adminJudicialResourcesLoaded ? adminEmailTemplates : []

  const requiredMunicipalityEmails = useMemo(
    () => normalizeEmailList(contacts?.emails ?? []),
    [contacts],
  )

  useEffect(() => {
    let active = true

    async function loadAdminJudicialResources() {
      try {
        const [emailResponse, municipalityResponse] = await Promise.all([
          fetch("/api/admin/judicial/emails", { cache: "no-store" }),
          fetch("/api/admin/judicial/municipios", { cache: "no-store" }),
        ])

        const [emailPayload, municipalityPayload] = await Promise.all([
          emailResponse.json().catch(() => null),
          municipalityResponse.json().catch(() => null),
        ])

        if (!active) return

        const emailModels = adminArray(emailPayload)
          .map((item) => {
            const record = item as Record<string, unknown>
            return {
              id: adminText(record.id),
              title: adminText(record.title || record.titulo || record.type || record.tipo_template),
              subject: adminText(record.subject || record.assunto),
              body: adminText(record.body || record.corpo || record.corpo_html),
              type: adminText(record.type || record.tipo_template),
              automaticDispatch: Boolean(record.automaticDispatch || record.disparo_automatico),
            }
          })
          .filter((item) => item.id)

        const municipalityContacts = adminArray(municipalityPayload)
          .map((item) => {
            const record = item as Record<string, unknown>
            return {
              id: adminText(record.id),
              municipalityName: adminText(record.municipalityName || record.municipio_nome),
              emails: adminList(record.emails),
              phones: adminList(record.phones || record.telefones),
              contacts: adminList(record.contacts || record.contatos),
            }
          })
          .filter((item) => item.municipalityName)

        setAdminEmailTemplates(emailModels)
        setAdminMunicipalityContacts(municipalityContacts)
      } catch (error) {
        console.error("[JudicialCaseDetail] erro ao carregar modelos/municipios do Admin Judicial:", error)
      } finally {
        if (active) setAdminJudicialResourcesLoaded(true)
      }
    }

    void loadAdminJudicialResources()

    return () => {
      active = false
    }
  }, [])

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
        html: /<[^>]+>/.test(item.description),
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

  const latestMovementsPageSize = 2
  const totalLatestMovementsPages = Math.max(
    1,
    Math.ceil(latestMovementItems.length / latestMovementsPageSize),
  )
  const paginatedLatestMovements = latestMovementItems.slice(
    (latestMovementsPage - 1) * latestMovementsPageSize,
    latestMovementsPage * latestMovementsPageSize,
  )

  useEffect(() => {
    if (requiredMunicipalityEmails.length > 0) {
      setManifestRecipients((prev) => mergeRequiredEmails(prev, requiredMunicipalityEmails))
    }
  }, [requiredMunicipalityEmails])

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

  async function handleSaveSupportMaterial() {
    if (!user || !caseItem) return

    const materialName = supportMaterialName.trim()

    if (!materialName) {
      toast.error("Informe o nome do material de apoio.")
      return
    }

    if (!selectedSupportMaterialFiles || selectedSupportMaterialFiles.length === 0) {
      toast.error("Selecione o arquivo do material de apoio.")
      return
    }

    try {
      const uploadedFiles = await uploadFiles({
        files: selectedSupportMaterialFiles,
        category: "material_apoio",
        setUploading: setUploadingSupportMaterial,
      })

      if (uploadedFiles.length === 0) {
        toast.error("Não foi possível enviar o arquivo do material de apoio.")
        return
      }

      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/movimentacoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "monitoramento",
            description: `[MATERIAL_DE_APOIO] ${materialName}`,
            attachments: uploadedFiles,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao salvar material de apoio.")
      }

      toast.success("Material de apoio cadastrado.")
      setSupportMaterialName("")
      setSelectedSupportMaterialFiles(null)
      setSupportMaterialFormOpen(false)
      setSupportMaterialListOpen(true)
      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao salvar material de apoio:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o material de apoio.",
      )
    }
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
            sigtapCode: item.sigtapCode,
            codigo: item.sigtapCode,
            description: item.description,
            descricao: item.description,
            specialty: item.specialty,
            especialidade: item.specialty,
            subSpecialty: item.subSpecialty,
            subespecialidade: item.subSpecialty,
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

  function buildManifestTemplateReplacements() {
    const record = caseItem as unknown as Record<string, unknown>
    const missing = "N\u00e3o informado"

    const read = (...keys: string[]) => {
      for (const key of keys) {
        const value = record[key]

        if (Array.isArray(value)) {
          const joined = value.map((item) => adminText(item)).filter(Boolean).join(" / ")
          if (joined) return joined
        }

        const text = adminText(value)
        if (text) return text
      }

      return ""
    }

    const protocol =
      caseItem.originProtocol ||
      read("protocol", "protocolo", "judicialProtocol", "protocoloJudicial") ||
      missing

    const processList =
      processNumbers.join(" / ") ||
      caseItem.processNumber ||
      read("numeroProcesso", "processo", "processNumbers", "autosAcao") ||
      missing

    const pgeNet =
      adminList(record.pgeNetNumbers).join(" / ") ||
      read("pgeNetNumber", "pgeNet", "numeroPgeNet", "pge_net") ||
      missing

    const sigtapCode =
      read("sigtapCode", "codigoSigtap", "procedureCode", "codigoProcedimento") ||
      missing

    const sigtapDescription =
      read("sigtapDescription", "descricaoSigtap", "procedureDescription", "procedimento") ||
      missing

    const cidCode =
      read("cid", "cid10", "cidCode", "codigoCid") ||
      missing

    const cidDescription =
      read("cidDescription", "descricaoCid") ||
      missing

    const appointmentDate = caseItem.appointmentDate
      ? new Date(caseItem.appointmentDate).toLocaleString("pt-BR")
      : read("dataAgendamento", "appointment", "appointmentDate") || missing

    return {
      "$modulo": "Judicial",
      "$protocolo": protocol,
      "$protocolo_judicial": protocol,
      "$protocolo_prejudicial": read("preJudicialProtocol", "protocoloPreJudicial") || missing,
      "$nome_paciente": caseItem.patientName || read("nomePaciente", "patientName") || missing,
      "$paciente_nome": caseItem.patientName || read("nomePaciente", "patientName") || missing,
      "$cpf": caseItem.cpf || read("patientCpf", "pacienteCpf") || missing,
      "$paciente_cpf": caseItem.cpf || read("patientCpf", "pacienteCpf") || missing,
      "$cns": read("cns", "patientCns", "pacienteCns") || missing,
      "$paciente_cns": read("cns", "patientCns", "pacienteCns") || missing,
      "$municipio": caseItem.municipalityName || read("municipio", "municipality") || missing,
      "$municipio_paciente": caseItem.municipalityName || read("municipio", "municipality") || missing,
      "$ficha_core": activeFicha?.number || read("fichaCore", "coreFicha") || missing,
      "$numero_processo": processList,
      "$processo": processList,
      "$autos_acao": processList,
      "$pge_net": pgeNet,
      "$numero_pge_net": pgeNet,
      "$numero_oficio": read("oficioNumber", "numeroOficio") || missing,
      "$oficio": read("oficioNumber", "numeroOficio") || missing,
      "$data_agendamento": appointmentDate,
      "$user_sistema": user?.nome || missing,
      "$codigo_sigtap": sigtapCode,
      "$sigtap_codigo": sigtapCode,
      "$descricao_sigtap": sigtapDescription,
      "$sigtap_descricao": sigtapDescription,
      "$procedimento": sigtapDescription,
      "$cid": cidCode,
      "$cid10": cidCode,
      "$cid_descricao": cidDescription,
      "$especialidade": read("specialty", "especialidade") || missing,
      "$subespecialidade": read("subSpecialty", "subespecialidade") || missing,
    }
  }

  function applyBlankManifestEditor() {
    setManifestSubject("")
    setManifestHtml("<p></p>")
    if (editorRef.current) {
      editorRef.current.innerHTML = "<p></p>"
    }
  }

  function applyManifestTemplateById(templateId: string) {
    if (!templateId || templateId === "__blank__") {
      applyBlankManifestEditor()
      return
    }

    const template = availableEmailTemplates.find((item) => item.id === templateId)

    if (!template) {
      toast.error("Modelo não encontrado.")
      return
    }

    const replacements = buildManifestTemplateReplacements()

    const nextSubject = replaceTemplatePlaceholders(template.subject, replacements)
    const nextHtml = templateBodyToHtml(
      replaceTemplatePlaceholders(template.body, replacements),
    )

    setManifestSubject(nextSubject)
    setManifestHtml(nextHtml)
    if (editorRef.current) {
      editorRef.current.innerHTML = nextHtml
    }
  }

  function handleSelectManifestTemplate(templateId: string) {
    setSelectedManifestTemplateId(templateId)
    applyManifestTemplateById(templateId)
  }

  function handleApplyManifestTemplate() {
    if (!selectedManifestTemplateId) {
      toast.error("Selecione um modelo de resposta ou EM BRANCO.")
      return
    }

    applyManifestTemplateById(selectedManifestTemplateId)
    toast.success("Modelo aplicado na notificação ao município.")
  }

  function htmlToPlainText(value: string) {
    if (typeof document === "undefined") {
      return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    }

    const element = document.createElement("div")
    element.innerHTML = value || ""
    return element.innerText.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim()
  }

  function wrapPdfLine(value: string, maxLength = 92) {
    const words = value.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let current = ""

    for (const word of words) {
      const next = current ? current + " " + word : word

      if (next.length > maxLength && current) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }

    if (current) lines.push(current)
    return lines.length ? lines : [""]
  }


  function normalizePdfText(value: string) {
    return String(value ?? "")
      .normalize("NFC")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u00a0/g, " ")
      .replace(/[^\x00-\xff]/g, " ")
  }

  function estimatePdfTextWidth(value: string, fontSize = 12) {
    const text = normalizePdfText(value)
    let units = 0

    for (const char of text) {
      if (char === " ") units += 0.28
      else if ("ilI.,:;!|'".includes(char)) units += 0.28
      else if ("mwMW".includes(char)) units += 0.9
      else if (/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(char)) units += 0.68
      else units += 0.55
    }

    return units * fontSize
  }

  function wrapPdfParagraph(value: string, maxWidth: number, fontSize = 12) {
    const words = normalizePdfText(value).split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let current = ""

    for (const word of words) {
      const next = current ? current + " " + word : word

      if (estimatePdfTextWidth(next, fontSize) > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }

    if (current) lines.push(current)
    return lines.length ? lines : [""]
  }

  function formatPdfDateLong(date = new Date()) {
    const months = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ]

    return String(date.getDate()).padStart(2, "0") +
      " de " +
      months[date.getMonth()] +
      " de " +
      date.getFullYear()
  }

  function resolveProcuradoriaProcedureText() {
    const procedures = (activeProcedures as Array<Record<string, unknown>>)
      .map((item) => {
        const code = String(item.sigtapCode ?? item.code ?? item.codigo ?? "").trim()
        const description = String(item.description ?? item.descricao ?? item.name ?? "").trim()

        return [code, description].filter(Boolean).join(" - ")
      })
      .filter(Boolean)

    return procedures.join(" / ") || "Não informado"
  }

  function resolveProcuradoriaAuthor() {
    const currentUser = user as unknown as Record<string, unknown> | null

    return String(
      currentUser?.nome ||
      currentUser?.name ||
      currentUser?.email ||
      "Sistema",
    ).trim()
  }

  function pdfTextCommand(text: string, maxWidth: number, justify = false) {
    const normalized = normalizePdfText(text)
    const words = normalized.split(/\s+/).filter(Boolean)
    const width = estimatePdfTextWidth(normalized, 12)

    if (justify && words.length > 1 && width > 0 && width < maxWidth) {
      const spaces = words.length - 1
      const wordSpacing = Math.max(0, Math.min(8, (maxWidth - width) / spaces))

      return wordSpacing.toFixed(2) + " Tw <" + toPdfHex(normalized) + "> Tj 0 Tw"
    }

    return "0 Tw <" + toPdfHex(normalized) + "> Tj"
  }

function toPdfHex(value: string) {
    const normalized = normalizePdfText(value)
    let hex = ""

    for (let index = 0; index < normalized.length; index++) {
      hex += normalized.charCodeAt(index).toString(16).padStart(2, "0")
    }

    return hex.toUpperCase()
  }

  async function buildSimplePdfBlob(title: string, html: string) {
    const pageWidth = 595.28
    const pageHeight = 841.89
    const marginTop = 85.04
    const marginLeft = 85.04
    const marginRight = 56.69
    const marginBottom = 56.69
    const bodyFontSize = 12
    const footerFontSize = 10
    const lineHeight = 18
    const maxWidth = pageWidth - marginLeft - marginRight
    const bodyTop = 135
    const bodyBottom = pageHeight - marginBottom - 34
    const footerLineHeight = 12
    const headerImagePath = "/assets/pdf/cabecalho-ses-ms.png"

    type RichToken = {
      text: string
      bold?: boolean
    }

    type PdfVisualLine = {
      tokens: RichToken[]
      align?: "left" | "center" | "right"
      justify?: boolean
      fontSize?: number
      lineHeight?: number
    }

    function createCanvasPage() {
      const scale = 2
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(pageWidth * scale)
      canvas.height = Math.round(pageHeight * scale)

      const context = canvas.getContext("2d")
      if (!context) throw new Error("Não foi possível gerar o PDF.")

      context.scale(scale, scale)
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, pageWidth, pageHeight)
      context.fillStyle = "#000000"
      context.textBaseline = "alphabetic"

      return { canvas, context }
    }

    function setCanvasFont(
      context: CanvasRenderingContext2D,
      fontSize = bodyFontSize,
      bold = false,
    ) {
      context.font = (bold ? "bold " : "") + fontSize + "px Arial"
    }

    function measureTokens(
      context: CanvasRenderingContext2D,
      tokens: RichToken[],
      fontSize = bodyFontSize,
    ) {
      let width = 0

      tokens.forEach((token, index) => {
        setCanvasFont(context, fontSize, Boolean(token.bold))
        width += context.measureText(token.text).width

        if (index < tokens.length - 1) {
          setCanvasFont(context, fontSize, false)
          width += context.measureText(" ").width
        }
      })

      return width
    }

    function splitSegmentWords(segments: RichToken[]) {
      const words: RichToken[] = []

      for (const segment of segments) {
        const parts = normalizePdfText(segment.text).split(/\s+/).filter(Boolean)

        for (const part of parts) {
          words.push({
            text: part,
            bold: segment.bold,
          })
        }
      }

      return words
    }

    function wrapRichParagraph(
      context: CanvasRenderingContext2D,
      segments: RichToken[],
      availableWidth: number,
      fontSize = bodyFontSize,
      justify = false,
      align: "left" | "center" | "right" = "left",
    ) {
      const words = splitSegmentWords(segments)
      const lines: PdfVisualLine[] = []

      if (words.length === 0) {
        return [{ tokens: [], fontSize, lineHeight }]
      }

      let current: RichToken[] = []

      for (const word of words) {
        const next = [...current, word]

        if (current.length > 0 && measureTokens(context, next, fontSize) > availableWidth) {
          lines.push({
            tokens: current,
            align,
            justify,
            fontSize,
            lineHeight,
          })
          current = [word]
        } else {
          current = next
        }
      }

      if (current.length > 0) {
        lines.push({
          tokens: current,
          align,
          justify: false,
          fontSize,
          lineHeight,
        })
      }

      return lines
    }

    function drawRichLine(
      context: CanvasRenderingContext2D,
      line: PdfVisualLine,
      y: number,
    ) {
      const tokens = line.tokens || []
      const fontSize = line.fontSize || bodyFontSize

      if (tokens.length === 0) return

      let x = marginLeft
      const measuredWidth = measureTokens(context, tokens, fontSize)

      if (line.align === "center") {
        x = marginLeft + (maxWidth - measuredWidth) / 2
      } else if (line.align === "right") {
        x = marginLeft + maxWidth - measuredWidth
      }

      setCanvasFont(context, fontSize, false)
      const normalSpaceWidth = context.measureText(" ").width
      let extraSpace = 0

      if (line.justify && tokens.length > 1 && measuredWidth < maxWidth) {
        extraSpace = Math.min(8, Math.max(0, (maxWidth - measuredWidth) / (tokens.length - 1)))
      }

      for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index]
        setCanvasFont(context, fontSize, Boolean(token.bold))
        context.fillText(token.text, x, y)
        x += context.measureText(token.text).width

        if (index < tokens.length - 1) {
          x += normalSpaceWidth + extraSpace
        }
      }
    }

    function addBlankLine(lines: PdfVisualLine[]) {
      lines.push({
        tokens: [],
        lineHeight,
      })
    }

    function addRichParagraph(
      context: CanvasRenderingContext2D,
      lines: PdfVisualLine[],
      segments: RichToken[],
      options?: {
        align?: "left" | "center" | "right"
        justify?: boolean
        fontSize?: number
      },
    ) {
      const wrapped = wrapRichParagraph(
        context,
        segments,
        maxWidth,
        options?.fontSize || bodyFontSize,
        Boolean(options?.justify),
        options?.align || "left",
      )

      lines.push(...wrapped)
    }

    type PdfHtmlBlock = {


      segments: RichToken[]


      blank?: boolean


      align?: "left" | "center" | "right"


      justify?: boolean


      fontSize?: number


    }



    function htmlElementAlign(element: Element): "left" | "center" | "right" {


      const style = String(element.getAttribute("style") || "").toLowerCase()


      const align = String(element.getAttribute("align") || "").toLowerCase()



      if (align === "center" || style.includes("text-align: center")) return "center"


      if (align === "right" || style.includes("text-align: right")) return "right"



      return "left"


    }



    function htmlElementIsBold(element: Element, inheritedBold: boolean) {


      const tagName = element.tagName.toLowerCase()


      const style = String(element.getAttribute("style") || "").toLowerCase()



      return (


        inheritedBold ||


        tagName === "strong" ||


        tagName === "b" ||


        /font-weight\s*:\s*(bold|[6-9]00)/.test(style)


      )


    }



    function collectHtmlSegments(node: Node, inheritedBold = false): RichToken[] {


      if (node.nodeType === Node.TEXT_NODE) {


        const text = String(node.textContent || "")


          .replace(/\u00a0/g, " ")


          .replace(/\s+/g, " ")


          .trim()



        return text ? [{ text, bold: inheritedBold }] : []


      }



      if (node.nodeType !== Node.ELEMENT_NODE) return []



      const element = node as Element


      const tagName = element.tagName.toLowerCase()



      if (tagName === "br") return []



      const nextBold = htmlElementIsBold(element, inheritedBold)


      const segments: RichToken[] = []



      element.childNodes.forEach((child) => {


        segments.push(...collectHtmlSegments(child, nextBold))


      })



      return segments


    }



    function htmlToPdfRichBlocks(value: string): PdfHtmlBlock[] {


      if (typeof document === "undefined") {


        const text = htmlToPlainText(value)


        return text ? [{ segments: [{ text, bold: false }], justify: true }] : []


      }



      const container = document.createElement("div")


      container.innerHTML = value || ""



      const blocks: PdfHtmlBlock[] = []


      const blockTags = new Set(["p", "div", "section", "article", "li", "h1", "h2", "h3", "h4", "h5", "h6"])



      function pushBlockFromNode(node: Node) {


        if (node.nodeType === Node.TEXT_NODE) {


          const text = String(node.textContent || "").replace(/\s+/g, " ").trim()


          if (text) {


            blocks.push({


              segments: [{ text, bold: false }],


              justify: true,


            })


          }


          return


        }



        if (node.nodeType !== Node.ELEMENT_NODE) return



        const element = node as Element


        const tagName = element.tagName.toLowerCase()



        if (tagName === "br") {


          blocks.push({ segments: [], blank: true })


          return


        }



        const isBlock = blockTags.has(tagName)



        if (!isBlock) {


          const segments = collectHtmlSegments(element)


          if (segments.length > 0) {


            blocks.push({ segments, justify: true })


          }


          return


        }



        const segments = collectHtmlSegments(element)


        const text = segments.map((segment) => segment.text).join(" ").trim()



        if (!text) {


          blocks.push({ segments: [], blank: true })


          return


        }



        const fontSize =


          tagName === "h1" ? 16 :


          tagName === "h2" ? 15 :


          tagName === "h3" ? 14 :


          undefined



        blocks.push({


          segments,


          align: htmlElementAlign(element),


          justify: htmlElementAlign(element) === "left",


          fontSize,


        })


      }



      container.childNodes.forEach(pushBlockFromNode)



      return blocks.filter((block, index, list) => {


        if (!block.blank) return true



        const previous = list[index - 1]


        return previous && !previous.blank


      })


    }



    async function loadHeaderImage() {
      return await new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => resolve(null)
        image.src = headerImagePath
      })
    }

    function drawHeader(
      context: CanvasRenderingContext2D,
      image: HTMLImageElement | null,
    ) {
      if (!image) return

      const maxLogoWidth = 240
      const maxLogoHeight = 62
      const ratio = Math.min(maxLogoWidth / image.width, maxLogoHeight / image.height)
      const logoWidth = image.width * ratio
      const logoHeight = image.height * ratio
      const logoX = (pageWidth - logoWidth) / 2
      const logoY = 18

      context.drawImage(image, logoX, logoY, logoWidth, logoHeight)
    }

    function drawFooter(context: CanvasRenderingContext2D) {
      const footerLines = [
        "Endereço: Av. do Poeta, S/N - Bloco 7 - Jardim Veraneio, Campo Grande - MS, 79031-350",
        "Telefone: (67) 3318-1600",
      ]

      setCanvasFont(context, footerFontSize, false)

      footerLines.forEach((line, index) => {
        const y = pageHeight - 35 + index * footerLineHeight
        const width = context.measureText(line).width
        const x = (pageWidth - width) / 2
        context.fillText(line, x, y)
      })
    }

    function canvasToJpegBytes(canvas: HTMLCanvasElement) {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.94)
      const base64 = dataUrl.split(",")[1] || ""
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)

      for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index)
      }

      return bytes
    }

    function asciiBytes(value: string) {
      return new TextEncoder().encode(value)
    }

    function createImagePdf(pageImages: Array<{ bytes: Uint8Array; width: number; height: number }>) {
      type PdfObject =
        | string
        | {
            prefix: string
            data: Uint8Array
            suffix: string
          }

      const objects: PdfObject[] = []
      const pageIds: number[] = []

      objects.push("<< /Type /Catalog /Pages 2 0 R >>")
      objects.push("__PAGES__")

      pageImages.forEach((image, pageIndex) => {
        const imageId = objects.length + 1
        const contentId = imageId + 1
        const pageId = imageId + 2
        const imageName = "Im" + (pageIndex + 1)
        const contentStream =
          "q\n" +
          pageWidth +
          " 0 0 " +
          pageHeight +
          " 0 0 cm\n/" +
          imageName +
          " Do\nQ"

        pageIds.push(pageId)

        objects.push({
          prefix:
            "<< /Type /XObject /Subtype /Image /Width " +
            image.width +
            " /Height " +
            image.height +
            " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
            image.bytes.length +
            " >>\nstream\n",
          data: image.bytes,
          suffix: "\nendstream",
        })

        objects.push(
          "<< /Length " +
            contentStream.length +
            " >>\nstream\n" +
            contentStream +
            "\nendstream",
        )

        objects.push(
          "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
            pageWidth +
            " " +
            pageHeight +
            "] /Resources << /XObject << /" +
            imageName +
            " " +
            imageId +
            " 0 R >> >> /Contents " +
            contentId +
            " 0 R >>",
        )
      })

      objects[1] =
        "<< /Type /Pages /Kids [" +
        pageIds.map((id) => id + " 0 R").join(" ") +
        "] /Count " +
        pageIds.length +
        " >>"

      const chunks: Uint8Array[] = []
      const offsets = [0]
      let length = 0

      function addBytes(bytes: Uint8Array) {
        chunks.push(bytes)
        length += bytes.length
      }

      function addString(value: string) {
        addBytes(asciiBytes(value))
      }

      addString("%PDF-1.4\n")

      objects.forEach((object, index) => {
        offsets.push(length)
        addString(index + 1 + " 0 obj\n")

        if (typeof object === "string") {
          addString(object)
        } else {
          addString(object.prefix)
          addBytes(object.data)
          addString(object.suffix)
        }

        addString("\nendobj\n")
      })

      const xrefOffset = length
      addString("xref\n0 " + (objects.length + 1) + "\n")
      addString("0000000000 65535 f \n")

      for (let index = 1; index <= objects.length; index++) {
        addString(String(offsets[index]).padStart(10, "0") + " 00000 n \n")
      }

      addString(
        "trailer\n<< /Size " +
          (objects.length + 1) +
          " /Root 1 0 R >>\nstartxref\n" +
          xrefOffset +
          "\n%%EOF",
      )

      return new Blob(chunks, { type: "application/pdf" })
    }

    const selectedTemplate = availableEmailTemplates.find(
      (item: any) => item.id === selectedProcuradoriaTemplateId,
    )

    const replacements = buildManifestTemplateReplacements()
    const currentYear = new Date().getFullYear()
    const processText = processNumbers.join(" / ") || caseItem.processNumber || "Não informado"
    const patientText = caseItem.patientName || "Não informado"
    const municipalityText = caseItem.municipalityName || "Não informado"
    const protocolText = caseItem.originProtocol || caseItem.id || "Não informado"
    const procedureText = resolveProcuradoriaProcedureText()
    const authorText = resolveProcuradoriaAuthor()
    const rawSubject = String(selectedTemplate?.subject || "").trim()
    const subjectText =
      replaceTemplatePlaceholders(rawSubject, replacements) ||
      "Encaminhamento de informações referente a procedimento não atendido pela Rede Estadual de Saúde - CORE."

    const defaultBodyText =
      "Cumprimentando-o cordialmente, em atenção ao Ofício supracitado, que solicita informações acerca da oferta do procedimento SIGTAP " +
      procedureText +
      ", informamos que, no âmbito da Rede Estadual de Saúde de Mato Grosso do Sul, não há contratualização vigente com prestadores habilitados para a execução do referido procedimento."

    const bodyBlocks = htmlToPdfRichBlocks(html)
    const finalBodyBlocks =
      bodyBlocks.length > 0
        ? bodyBlocks
        : [{ segments: [{ text: defaultBodyText, bold: false }], justify: true }]

    const scratch = createCanvasPage()
    const allLines: PdfVisualLine[] = []

    addRichParagraph(scratch.context, allLines, [
      { text: "CI de Resposta nº " + protocolText + "/" + currentYear, bold: true },
    ])
    addRichParagraph(scratch.context, allLines, [
      { text: "Campo Grande/MS, " + formatPdfDateLong(new Date()) + ".", bold: false },
    ], { align: "right" })
    addBlankLine(allLines)

    addRichParagraph(scratch.context, allLines, [
      { text: "PROCESSO Nº ", bold: true },
      { text: processText, bold: false },
    ])
    addRichParagraph(scratch.context, allLines, [
      { text: "REQUERENTE(S): ", bold: true },
      { text: patientText, bold: false },
    ])
    addRichParagraph(scratch.context, allLines, [
      { text: "REQUERIDO(S): ", bold: true },
      { text: "ESTADO DE MATO GROSSO DO SUL E O MUNICÍPIO DE " + municipalityText.toUpperCase() + ".", bold: false },
    ])
    addBlankLine(allLines)

    for (const block of finalBodyBlocks) {
      if (block.blank || block.segments.length === 0) {
        addBlankLine(allLines)
        continue
      }

      addRichParagraph(scratch.context, allLines, block.segments, {
        align: block.align,
        justify: block.justify,
        fontSize: block.fontSize,
      })
      addBlankLine(allLines)
    }

    addBlankLine(allLines)

    addRichParagraph(scratch.context, allLines, [
      { text: "Elaborado por:", bold: false },
    ])
    addRichParagraph(scratch.context, allLines, [
      { text: authorText, bold: true },
    ])

    const headerImage = await loadHeaderImage()
    const pageImages: Array<{ bytes: Uint8Array; width: number; height: number }> = []

    let page = createCanvasPage()
    let y = bodyTop

    drawHeader(page.context, headerImage)
    drawFooter(page.context)

    for (const line of allLines) {
      const currentLineHeight = line.lineHeight || lineHeight

      if (y + currentLineHeight > bodyBottom) {
        pageImages.push({
          bytes: canvasToJpegBytes(page.canvas),
          width: page.canvas.width,
          height: page.canvas.height,
        })

        page = createCanvasPage()
        drawHeader(page.context, headerImage)
        drawFooter(page.context)
        y = bodyTop
      }

      drawRichLine(page.context, line, y)
      y += currentLineHeight
    }

    pageImages.push({
      bytes: canvasToJpegBytes(page.canvas),
      width: page.canvas.width,
      height: page.canvas.height,
    })

    return createImagePdf(pageImages)
  }

  async function uploadGeneratedProcuradoriaPdf(file: File) {
    const form = new FormData()
    form.append("cpf", caseItem.cpf)
    form.append("protocol", caseItem.originProtocol)
    form.append("module", "judicial")
    form.append("category", "movimentacao")
    form.append("files", file)

    const response = await fetch("/api/uploads", { method: "POST", body: form })
    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data?.ok || !Array.isArray(data?.files) || data.files.length === 0) {
      throw new Error(data?.error || "Erro ao salvar PDF da resposta.")
    }

    return data.files[0] as UploadedFileMeta
  }

  function setProcuradoriaEditorContent(nextHtml: string) {
    const html = String(nextHtml || defaultProcuradoriaHtml)

    procuradoriaHtmlRef.current = html
    setProcuradoriaHtml(html)
    setProcuradoriaEditorKey((current) => current + 1)

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (procuradoriaEditorRef.current && procuradoriaEditorRef.current.innerHTML !== html) {
          procuradoriaEditorRef.current.innerHTML = html
        }
      }, 0)
    }
  }

  function captureProcuradoriaEditorContent(value: string) {
    procuradoriaHtmlRef.current = String(value || "")
  }

  function handleProcuradoriaEditorPaste(event: any) {
    event.preventDefault()

    const text = String(event.clipboardData?.getData("text/plain") || "")
    if (!text) return

    document.execCommand("insertText", false, text)

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (procuradoriaEditorRef.current) {
          procuradoriaHtmlRef.current = procuradoriaEditorRef.current.innerHTML
        }
      }, 0)
    }
  }

  function applyProcuradoriaTemplateById(templateId: string) {
    setSelectedProcuradoriaTemplateId(templateId)

    const template = availableEmailTemplates.find((item: any) => item.id === templateId)

    if (!template) {
      setProcuradoriaEditorContent(defaultProcuradoriaHtml)
      return
    }

    const replacements = buildManifestTemplateReplacements()
    const nextHtml = templateBodyToHtml(
      replaceTemplatePlaceholders(template.body, replacements),
    )

    setProcuradoriaEditorContent(nextHtml)
  }

  async function handleGenerateProcuradoriaResponse() {
    if (!user) return

    if (!selectedProcuradoriaTemplateId) {
      toast.error("Selecione um modelo de resposta.")
      return
    }

    const rawHtml =
      procuradoriaEditorRef.current?.innerHTML ||
      procuradoriaHtmlRef.current ||
      procuradoriaHtml

    const safeHtml = sanitizeEmailHtml(rawHtml)
    const textContent = htmlToPlainText(safeHtml)

    if (!textContent) {
      toast.error("O modelo selecionado não gerou conteúdo.")
      return
    }

    try {
      setGeneratingProcuradoria(true)

      const pdfBlob = await buildSimplePdfBlob("Resposta a Procuradoria", safeHtml)
      const safeProtocol = String(caseItem.originProtocol || caseItem.id || "judicial").replace(/[^a-zA-Z0-9_-]+/g, "_")
      const file = new File([pdfBlob], "resposta-a-procuradoria-" + safeProtocol + ".pdf", {
        type: "application/pdf",
      })

      const uploadedPdf = await uploadGeneratedProcuradoriaPdf(file)

      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/movimentacoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "resposta_procuradoria",
            description: textContent,
            attachments: [uploadedPdf],
            user,
          }),
        },
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao salvar resposta a Procuradoria.")
      }

      toast.success("Resposta a Procuradoria salva nas movimentações.")
      setProcuradoriaModalOpen(false)
      setSelectedProcuradoriaTemplateId("")
      setProcuradoriaEditorContent(defaultProcuradoriaHtml)

      if (typeof window !== "undefined") {
        window.setTimeout(() => window.location.reload(), 500)
      }
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao gerar resposta a Procuradoria.")
    } finally {
      setGeneratingProcuradoria(false)
    }
  }


  async function handleSendMunicipalityNotification(options?: {
    movementType?: MovementType
    closeForwardModal?: boolean
  }) {
    if (!user) return

    const requiredRecipients = requiredMunicipalityEmails
    const extraRecipients = normalizeEmailList(additionalManifestRecipients)
    const recipients = normalizeEmailList([...requiredRecipients, ...extraRecipients].join(", "))

    setManifestRecipients(requiredRecipients.join(", "))
    setAdditionalManifestRecipients(extraRecipients.join(", "))

    if (requiredRecipients.length === 0) {
      toast.error("Município sem e-mail cadastrado no Admin Judicial.")
      return
    }

    if (!manifestSubject.trim()) {
      toast.error("Informe o assunto da notificação.")
      return
    }

    const rawHtml = editorRef.current?.innerHTML || manifestHtml
    const html = sanitizeEmailHtml(rawHtml)

    if (!htmlHasContent(html)) {
      toast.error("Escreva o conteúdo da notificação.")
      return
    }

    const composedHtml = `
      <p><strong>Destinat&aacute;rios:</strong> ${recipients.map((email) => escapeHtml(email)).join(", ")}</p>
      <p><strong>Assunto:</strong> ${escapeHtml(manifestSubject.trim())}</p>
      <hr />
      ${html}
    `

    try {
      const emailResponse = await fetch("/api/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipients,
          subject: manifestSubject.trim(),
          html,
          text: htmlToText(html),
        }),
      })

      const emailData = await emailResponse.json().catch(() => ({}))

      if (!emailResponse.ok || emailData?.success === false) {
        const details = typeof emailData?.details === "string" ? emailData.details : ""
        throw new Error(emailData?.error || details || "Falha ao enviar e-mail.")
      }

      const movementResponse = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseItem.id)}/movimentacoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: options?.movementType || (forwardMunicipalityMode ? "encaminhar_demanda_municipio" : "manifestacao_municipio"),
            description: composedHtml,
            attachments:
              uploadedManifestFiles.length > 0
                ? uploadedManifestFiles
                : splitCommaNames(manifestAttachments),
            user,
          }),
        },
      )

      const movementData = await movementResponse.json().catch(() => ({}))

      if (!movementResponse.ok || !movementData?.ok) {
        throw new Error(movementData?.error || "E-mail enviado, mas houve erro ao salvar a movimentação.")
      }

      toast.success("E-mail enviado e movimentação registrada.")
      setManifestSubject("")
      setManifestHtml("<p>Prezados,</p><p></p><p>Atenciosamente.</p>")
      setManifestAttachments("")
      setAdditionalManifestRecipients("")
      setSelectedManifestFiles(null)
      setUploadedManifestFiles([])
      setSelectedManifestTemplateId("")
      if (editorRef.current) {
        editorRef.current.innerHTML =
          "<p>Prezados,</p><p></p><p>Atenciosamente.</p>"
      }

      if (options?.closeForwardModal || forwardMunicipalityMode) {
        setForwardMunicipalityMode(false)
        setNotificationModalOpen(false)
      }

      window.location.reload()
    } catch (error) {
      console.error("[JudicialCaseDetail] erro ao enviar ao município:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao enviar e registrar notificação ao município.",
      )
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

    if ((["resolvido", "cumprido", "nao_sus", "competencia_municipio"].includes(finalizeStatus)) && !finalizeReason.trim()) {
      toast.error(finalizeStatus === "cumprido" ? "Justifique o cumprimento." : "Justifique a finalização.")
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
              {caseItem.cpf} | CNS: {formatCns(caseItem.patientId)} | Município:{" "}
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

                  {item.description && !(item.html || /<[^>]+>/.test(item.description)) && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6">
                      {item.description}
                    </p>
                  )}

                  {item.description && (item.html || /<[^>]+>/.test(item.description)) && (
                    <div
                      className="mt-2 text-sm leading-6"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeEmailHtml(item.description),
                      }}
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
                      CPF {caseItem.cpf} | CNS: {formatCns(caseItem.patientId)} | Município: {caseItem.municipalityName}
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
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      MATERIAL DE APOIO
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cadastre arquivos de orientação para o Agendamento da Demanda e consulte os materiais já vinculados.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                      onClick={() => setSupportMaterialFormOpen((value) => !value)}
                    >
                      Cadastrar material
                    </button>

                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                      onClick={() => setSupportMaterialListOpen((value) => !value)}
                    >
                      Visualizar materiais
                    </button>
                  </div>
                </div>

                {supportMaterialFormOpen ? (
                  <div className="mt-4 grid gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Nome do material
                      </label>
                      <input
                        type="text"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Ex.: Manual de agendamento"
                        value={supportMaterialName}
                        onChange={(event) => setSupportMaterialName(event.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Arquivo
                      </label>
                      <input
                        type="file"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        onChange={(event) => setSelectedSupportMaterialFiles(event.target.files)}
                      />
                    </div>

                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
                      disabled={uploadingSupportMaterial}
                      onClick={handleSaveSupportMaterial}
                    >
                      {uploadingSupportMaterial ? "Enviando..." : "Salvar"}
                    </button>
                  </div>
                ) : null}

                {supportMaterialListOpen ? (
                  <div className="mt-4 space-y-2">
                    {supportMaterials.length === 0 ? (
                      <p className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                        Nenhum material de apoio cadastrado.
                      </p>
                    ) : (
                      supportMaterials.map((material) => (
                        <div
                          key={material.id}
                          className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{material.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {material.createdByName || "Usuário"} • {material.createdAt ? new Date(material.createdAt).toLocaleString("pt-BR") : "Data não informada"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {material.attachments.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Sem arquivo</span>
                            ) : (
                              material.attachments.map((attachment: any, index: number) => {
                                const attachmentName = String(attachment?.name || attachment?.filename || `Arquivo ${index + 1}`)
                                const attachmentUrl = String(attachment?.url || attachment?.relativePath || attachment?.path || "")

                                return attachmentUrl ? (
                                  <a
                                    key={`${material.id}-${index}`}
                                    href={attachmentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                  >
                                    Visualizar {attachmentName}
                                  </a>
                                ) : (
                                  <span
                                    key={`${material.id}-${index}`}
                                    className="text-xs text-muted-foreground"
                                  >
                                    {attachmentName}
                                  </span>
                                )
                              })
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">Movimentação</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={movementType}
                    onChange={(e) => handleMovementTypeChange(e.target.value)}
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
                Exibe as últimas movimentações registradas no processo, com até 2 por página.
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
                      <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
                        {/<[^>]+>/.test(item.description)
                          ? htmlToText(sanitizeEmailHtml(item.description))
                          : item.description}
                      </p>
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
                    onChange={(e) => handleSelectManifestTemplate(e.target.value)}
                  >
                    <option value="">Selecione um modelo salvo no Admin Judicial</option>
                    <option value="__blank__">EM BRANCO</option>
                    {availableEmailTemplates.map((item) => (
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
                    onChange={(e) =>
                      setManifestRecipients(
                        mergeRequiredEmails(e.target.value, requiredMunicipalityEmails),
                      )
                    }
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
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        runEditorCommand("fontName", e.target.value)
                        e.currentTarget.value = ""
                      }
                    }}
                  >
                    <option value="">Fonte</option>
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Courier New">Courier New</option>
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        runEditorCommand("fontSize", e.target.value)
                        e.currentTarget.value = ""
                      }
                    }}
                  >
                    <option value="">Tamanho</option>
                    <option value="2">Pequeno</option>
                    <option value="3">Normal</option>
                    <option value="4">Medio</option>
                    <option value="5">Grande</option>
                    <option value="6">Muito grande</option>
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
                    title="Tachado"
                    onClick={() => runEditorCommand("strikeThrough")}
                  >
                    <Strikethrough className="h-4 w-4" />
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
                    title="Justificar"
                    onClick={() => runEditorCommand("justifyFull")}
                  >
                    <AlignJustify className="h-4 w-4" />
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
                        dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(item.description) }}
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
                        dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(item.description) }}
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

      <Dialog
        open={notificationModalOpen}
        onOpenChange={(open) => {
          setNotificationModalOpen(open)
          if (!open) setForwardMunicipalityMode(false)
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {forwardMunicipalityMode
                ? "ENCAMINHAR DEMANDA AO MUNICÍPIO"
                : "Notificação/Manifestação do município"}
            </DialogTitle>
            <DialogDescription>
              {forwardMunicipalityMode
                ? "Selecione um modelo, edite o texto e envie ao município cadastrado."
                : "Registre notificação, manifestação e anexos para o município envolvido."}
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
                      onChange={(e) => handleSelectManifestTemplate(e.target.value)}
                    >
                      <option value="">Selecione um modelo salvo no Admin Judicial</option>
                    <option value="__blank__">EM BRANCO</option>
                      {availableEmailTemplates.map((item) => (
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
                  <div className="space-y-2">
                    <Label className="mb-1 block text-xs">Destinat&aacute;rio fixo do munic&iacute;pio</Label>
                    <Input
                      value={requiredMunicipalityEmails.join(", ") || "Municipio sem e-mail cadastrado"}
                      readOnly
                      className="bg-muted/50"
                    />
                    <Label className="mb-1 block text-xs">E-mails adicionais</Label>
                    <Input
                      value={additionalManifestRecipients}
                      onChange={(e) => setAdditionalManifestRecipients(e.target.value)}
                      placeholder="email.extra@municipio.gov.br, outro@email.gov.br"
                    />
                    <p className="text-xs text-muted-foreground">
                      O e-mail cadastrado do munic&iacute;pio n&atilde;o pode ser removido. Use este campo apenas para acrescentar outros destinat&aacute;rios.
                    </p>
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
                    <span className="mr-1 text-xs font-semibold uppercase text-muted-foreground">Editor</span>
                    <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) { runEditorCommand("formatBlock", e.target.value); e.currentTarget.value = "" } }}>
                      <option value="">Formato</option>
                      <option value="<p>">Paragrafo</option>
                      <option value="<h2>">Titulo</option>
                      <option value="<blockquote>">Citacao</option>
                    </select>
                    <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) { runEditorCommand("fontName", e.target.value); e.currentTarget.value = "" } }}>
                      <option value="">Fonte</option>
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Courier New">Courier New</option>
                    </select>
                    <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) { runEditorCommand("fontSize", e.target.value); e.currentTarget.value = "" } }}>
                      <option value="">Tamanho</option>
                      <option value="2">Pequeno</option>
                      <option value="3">Normal</option>
                      <option value="4">Medio</option>
                      <option value="5">Grande</option>
                      <option value="6">Muito grande</option>
                    </select>
                    <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Negrito" onClick={() => runEditorCommand("bold")}><Bold className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Italico" onClick={() => runEditorCommand("italic")}><Italic className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Tachado" onClick={() => runEditorCommand("strikeThrough")}><Strikethrough className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Sublinhado" onClick={() => runEditorCommand("underline")}><Underline className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Alinhar a esquerda" onClick={() => runEditorCommand("justifyLeft")}><AlignLeft className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Centralizar" onClick={() => runEditorCommand("justifyCenter")}><AlignCenter className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Alinhar a direita" onClick={() => runEditorCommand("justifyRight")}><AlignRight className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Justificar" onClick={() => runEditorCommand("justifyFull")}><AlignJustify className="h-4 w-4" /></Button>
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
                  (selectedHistoryItem.html || /<[^>]+>/.test(selectedHistoryItem.description)) ? (
                    <div
                      className="prose prose-sm max-w-none rounded-xl border border-border bg-muted/20 p-4"
                      dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(selectedHistoryItem.description) }}
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
                      dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(item.description) }}
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


      <Dialog open={procuradoriaModalOpen} onOpenChange={setProcuradoriaModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gerar Resposta a Procuradoria</DialogTitle>
            <DialogDescription>
              Selecione um modelo, confira a resposta gerada e salve o PDF nas últimas movimentações.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs">Modelo de resposta</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedProcuradoriaTemplateId}
                onChange={(event) => applyProcuradoriaTemplateById(event.target.value)}
              >
                <option value="">Selecione um modelo</option>
                {availableEmailTemplates.map((template: any) => (
                  <option key={template.id} value={template.id}>
                    {template.title} - {template.subject}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Texto da resposta editável</Label>
              <div
                key={procuradoriaEditorKey}
                ref={procuradoriaEditorRef}
                contentEditable
                suppressContentEditableWarning
                className="prose prose-sm max-h-[420px] min-h-[260px] max-w-none overflow-auto rounded-md border border-input bg-background p-4 text-sm leading-relaxed outline-none"
                onInput={(event) =>
                  captureProcuradoriaEditorContent((event.target as HTMLDivElement).innerHTML)
                }
                onBlur={(event) =>
                  captureProcuradoriaEditorContent((event.target as HTMLDivElement).innerHTML)
                }
                onPaste={handleProcuradoriaEditorPaste}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Clique no texto acima para editar as informações antes de gerar a resposta.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                onClick={() => setProcuradoriaModalOpen(false)}
                disabled={generatingProcuradoria}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleGenerateProcuradoriaResponse}
                disabled={generatingProcuradoria || !selectedProcuradoriaTemplateId}
              >
                {generatingProcuradoria ? "Gerando..." : "GERAR RESPOSTA/SALVAR"}
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
                    "nao_sus",
                    "competencia_municipio",
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

            {(["resolvido", "cumprido", "nao_sus", "competencia_municipio"].includes(finalizeStatus)) && (
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

