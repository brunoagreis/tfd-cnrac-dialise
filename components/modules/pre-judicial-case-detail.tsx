"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  ClipboardList,
  Download,
  Eye,
  FileText,
  History,
  Info,
  Mail,
  Pencil,
  Plus,
  Printer,
  ShieldCheck,
  Upload,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import {
  PREJUDICIAL_MOVEMENT_LABELS,
  PREJUDICIAL_STATUS_LABELS,
} from "@/lib/pre-judicial-types"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const PRE_FINALIZATION_LABELS = {
  pendente: "Pendente",
  resolvido: "Resolvido",
  cumprido: "Cumprido",
  bloqueio: "Bloqueio",
  sequestro: "Sequestro",
  obito: "Óbito",
  arquivado: "Arquivado",
  devolvida: "Devolvida",
} as const

const PRE_MOVEMENT_OPTIONS = [
  { value: "interacao", label: "Interação" },
  { value: "notificacao_municipio", label: "Notificação ao município" },
  { value: "envio_agendamento_demanda", label: "Envio ao Agendamento da Demanda" },
  { value: "reserva_agendamento", label: "Reserva de agenda" },
  { value: "agendado", label: "Agendado" },
  { value: "nao_agendado", label: "Não agendado" },
  { value: "retorno_fila", label: "Retorno à fila" },
  { value: "reabertura", label: "Reabertura" },
  { value: "resolvido", label: "Resolvido" },
  { value: "cumprido", label: "Cumprido" },
  { value: "arquivado", label: "Arquivado" },
  { value: "obito", label: "Óbito" },
  { value: "encerramento", label: "Encerramento" },
] as const

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
  active?: boolean
}

type SpecialtyOption = {
  id: string
  nome: string
  active?: boolean
}

type SubSpecialtyOption = {
  id: string
  especialidadeId: string
  nome: string
  active?: boolean
}

type CidOption = {
  id: string
  code: string
  description: string
  active?: boolean
}

type PreJudicialAttachmentView = {
  id: string
  name: string
  category: string
  createdAt: string
  createdById: string
  createdByName: string
  storedName?: string
  relativePath?: string
  url?: string
  mimeType?: string
  size?: number
}

type PreJudicialProcedureView = {
  id: string
  sigtapCode: string
  description: string
  specialty?: string
  subSpecialty?: string
  situation?: string
  active: boolean
  createdAt: string
  createdByName: string
}

type PreJudicialCidView = {
  id: string
  code: string
  description: string
  active: boolean
  createdAt: string
  createdByName: string
}

type PreJudicialPgeNetView = {
  id: string
  numero: string
  active: boolean
  createdAt: string
  createdByName: string
}

type PreJudicialProcessNumberView = {
  id: string
  numero: string
  origem?: string
  observacao?: string
  active: boolean
  createdAt: string
  createdByName: string
}

type PreJudicialMovementView = {
  id: string
  type: string
  description: string
  createdAt: string
  createdById: string
  createdByName: string
  dueAt?: string
  appointmentDate?: string
  attachments: PreJudicialAttachmentView[]
}

type PreJudicialFinalizationView = {
  status: keyof typeof PRE_FINALIZATION_LABELS | string
  createdAt: string
  createdById: string
  createdByName: string
  pendingLocation?: "ses" | "core" | "municipio" | string
  reason?: string
}

type PreJudicialCaseView = {
  id: string
  patientId: string
  patientName: string
  cpf: string
  municipalityName: string
  originModule: string
  originProtocol: string
  protocolNumber: string
  active: boolean
  status: string
  priority: number
  createdAt: string
  updatedAt: string
  deadlineAt: string
  deadlineWarningLevel: "ok" | "warning" | "critical" | "overdue" | string
  schedulingStatus: "fora_fila" | "pendente" | "reservado" | string
  schedulingRequestedAt?: string
  schedulingReservedAt?: string
  schedulingResponseDeadlineAt?: string
  appointmentDate?: string
  pgeNetNumbers?: PreJudicialPgeNetView[]
  processNumbers?: PreJudicialProcessNumberView[]
  procedures: PreJudicialProcedureView[]
  cids: PreJudicialCidView[]
  attachments: PreJudicialAttachmentView[]
  movements: PreJudicialMovementView[]
  registration?: {
    receivedAt: string
    actionRecords: string
    pgeNetNumber: string
    deadlineDays: number
    deadlineAt: string
    municipalityId: string
    municipalityIbge: string
    municipalityName: string
  }
  finalization?: PreJudicialFinalizationView
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function splitCommaNames(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatDateTime(value: string | undefined) {
  if (!value) return "Não informado"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Não informado"

  return date.toLocaleString("pt-BR")
}

function formatDate(value: string | undefined) {
  if (!value) return "Não informado"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Não informado"

  return date.toLocaleDateString("pt-BR")
}

function getStatusLabel(status: string) {
  const mapped = PREJUDICIAL_STATUS_LABELS[status as keyof typeof PREJUDICIAL_STATUS_LABELS]

  if (mapped) return mapped

  const fallback: Record<string, string> = {
    pendente: "Pendente",
    resolvido: "Resolvido",
    cumprido: "Cumprido",
    bloqueio: "Bloqueio",
    sequestro: "Sequestro",
    obito: "Óbito",
    arquivado: "Arquivado",
    devolvida: "Devolvida",
  }

  return fallback[status] ?? status
}

function getMovementLabel(type: string) {
  const mapped = PREJUDICIAL_MOVEMENT_LABELS[type as keyof typeof PREJUDICIAL_MOVEMENT_LABELS]

  if (mapped) return mapped

  const fallback: Record<string, string> = {
    resolvido: "Resolvido",
    cumprido: "Cumprido",
    arquivado: "Arquivado",
    obito: "Óbito",
  }

  return fallback[type] ?? type
}

function getDeadlineBadgeText(level: string) {
  if (level === "overdue") return "Prazo vencido"
  if (level === "critical") return "Prazo crítico"
  if (level === "warning") return "Prazo próximo"

  return "Prazo regular"
}

function getSchedulingLabel(status: string) {
  if (status === "fora_fila") return "Interno"
  if (status === "reservado") return "Reservado"

  return "Pendente"
}

function getPendingLocationLabel(value: string | undefined) {
  if (value === "ses") return "Pendente SES"
  if (value === "core") return "Pendente CORE"
  if (value === "municipio") return "Pendente Município"

  return value || "Não informado"
}

function getFinalizationLabel(status: string) {
  return PRE_FINALIZATION_LABELS[status as keyof typeof PRE_FINALIZATION_LABELS] ?? status
}

function AttachmentActions({
  attachment,
}: {
  attachment: { name: string; url?: string; relativePath?: string }
}) {
  if (!attachment.url) {
    return <span className="text-xs text-muted-foreground">Arquivo sem link</span>
  }

  const downloadUrl = attachment.relativePath
    ? `/api/files/${attachment.relativePath}?download=1`
    : `${attachment.url}${attachment.url.includes("?") ? "&" : "?"}download=1`

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <style>{`
        @media print {
          .prejudicial-no-print {
            display: none !important;
          }
        }
      `}</style>

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

export function PreJudicialCaseDetail({ caseId }: { caseId: string }) {
  const { user } = useAuth()
  const judicial = useJudicial()

  const [caseItem, setCaseItem] = useState<PreJudicialCaseView | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState("")

  const lastTrackedTabRef = useRef<string>("")

  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [municipalityOpen, setMunicipalityOpen] = useState(false)
  const [procedureOpen, setProcedureOpen] = useState(false)
  const [cidOpen, setCidOpen] = useState(false)
  const [pgeNetOpen, setPgeNetOpen] = useState(false)
  const [processNumberOpen, setProcessNumberOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)

  const [movementType, setMovementType] = useState("interacao")
  const [movementDescription, setMovementDescription] = useState("")
  const [movementDueAt, setMovementDueAt] = useState("")
  const [movementAppointmentDate, setMovementAppointmentDate] = useState("")
  const [selectedMovementFiles, setSelectedMovementFiles] = useState<FileList | null>(null)
  const [uploadingMovement, setUploadingMovement] = useState(false)

  const [finalizeStatus, setFinalizeStatus] =
    useState<keyof typeof PRE_FINALIZATION_LABELS>("pendente")
  const [finalizePendingLocation, setFinalizePendingLocation] = useState<
    "ses" | "core" | "municipio"
  >("ses")
  const [finalizeReason, setFinalizeReason] = useState("")
  const [finalizeValorEstado, setFinalizeValorEstado] = useState("")
  const [finalizeValorMunicipio, setFinalizeValorMunicipio] = useState("")

  const [procedureSearch, setProcedureSearch] = useState("")
  const [procedureResults, setProcedureResults] = useState<SigtapOption[]>([])
  const [selectedProcedure, setSelectedProcedure] = useState<SigtapOption | null>(null)
  const [procedureDescription, setProcedureDescription] = useState("")
  const [procedureSpecialty, setProcedureSpecialty] = useState("")
  const [procedureSubSpecialty, setProcedureSubSpecialty] = useState("")
  const [procedureSituation, setProcedureSituation] = useState("determinado")
  const [specialtyOptions, setSpecialtyOptions] = useState<SpecialtyOption[]>([])
  const [subSpecialtyOptions, setSubSpecialtyOptions] = useState<SubSpecialtyOption[]>([])

  const [cidCode, setCidCode] = useState("")
  const [cidDescription, setCidDescription] = useState("")
  const [cidOptions, setCidOptions] = useState<CidOption[]>([])

  const [pgeNetNumber, setPgeNetNumber] = useState("")
  const [processNumber, setProcessNumber] = useState("")
  const [processOrigin, setProcessOrigin] = useState("")
  const [processObservation, setProcessObservation] = useState("")

  useEffect(() => {
    let active = true

    async function loadCatalogsForPreJudicial() {
      try {
        const [especialidadesResponse, cidResponse] = await Promise.all([
          fetch("/api/judicial/especialidades", { cache: "no-store" }),
          fetch("/api/judicial/cid10?limit=1000", { cache: "no-store" }),
        ])

        const especialidadesData = await especialidadesResponse.json()
        const cidData = await cidResponse.json()

        if (!active) return

        if (especialidadesResponse.ok && especialidadesData?.ok) {
          setSpecialtyOptions(especialidadesData.items ?? [])
        }

        if (cidResponse.ok && cidData?.ok) {
          setCidOptions(cidData.items ?? [])
        }
      } catch (error) {
        console.error("[PreJudicialCaseDetail] erro ao carregar listas:", error)
      }
    }

    loadCatalogsForPreJudicial()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadSubSpecialties() {
      try {
        const selectedSpecialty = specialtyOptions.find(
          (item) => item.nome === procedureSpecialty,
        )

        if (!selectedSpecialty?.id) {
          setSubSpecialtyOptions([])
          setProcedureSubSpecialty("")
          return
        }

        const response = await fetch(
          `/api/judicial/subespecialidades?especialidadeId=${encodeURIComponent(selectedSpecialty.id)}`,
          { cache: "no-store" },
        )

        const data = await response.json()

        if (!active) return

        if (response.ok && data?.ok) {
          setSubSpecialtyOptions(data.items ?? [])

          if (
            procedureSubSpecialty &&
            !(data.items ?? []).some((item: SubSpecialtyOption) => item.nome === procedureSubSpecialty)
          ) {
            setProcedureSubSpecialty("")
          }
        }
      } catch (error) {
        console.error("[PreJudicialCaseDetail] erro ao carregar subespecialidades:", error)
      }
    }

    loadSubSpecialties()

    return () => {
      active = false
    }
  }, [procedureSpecialty, specialtyOptions])

  const loadCase = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError("")

      const response = await fetch(
        `/api/pre-judicial/casos/${encodeURIComponent(caseId)}`,
        {
          cache: "no-store",
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao carregar processo pré judicial.")
      }

      setCaseItem(data.item as PreJudicialCaseView)
    } catch (error) {
      console.error("[PreJudicialCaseDetail] erro ao carregar:", error)
      setLoadError(
        error instanceof Error
          ? error.message
          : "Erro ao carregar processo pré judicial.",
      )
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    loadCase()
  }, [loadCase])

  useEffect(() => {
    lastTrackedTabRef.current = ""

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(`prejudicial-tab:${caseId}`)
    }
  }, [caseId])

  useEffect(() => {
    let active = true

    async function searchSigtap() {
      const q = procedureSearch.trim()

      if (q.length < 2) {
        setProcedureResults([])
        return
      }

      try {
        const response = await fetch(
          `/api/judicial/sigtap?q=${encodeURIComponent(q)}&limit=20`,
          {
            cache: "no-store",
          },
        )

        const data = await response.json()

        if (!active) return

        if (response.ok && data?.ok) {
          setProcedureResults((data.items ?? []) as SigtapOption[])
        } else {
          setProcedureResults([])
        }
      } catch {
        if (active) setProcedureResults([])
      }
    }

    searchSigtap()

    return () => {
      active = false
    }
  }, [procedureSearch])

  const municipality = judicial.municipalityContacts.find(
    (item) => item.municipalityName === caseItem?.municipalityName,
  )

  const latestFinalization = caseItem?.finalization

  const activeProcedures = useMemo(
    () => caseItem?.procedures.filter((item) => item.active) ?? [],
    [caseItem?.procedures],
  )

  const activeCids = useMemo(
    () => caseItem?.cids.filter((item) => item.active) ?? [],
    [caseItem?.cids],
  )

  const activePgeNetNumbers = useMemo(
    () => caseItem?.pgeNetNumbers?.filter((item) => item.active) ?? [],
    [caseItem?.pgeNetNumbers],
  )

  const activeProcessNumbers = useMemo(
    () => caseItem?.processNumbers?.filter((item) => item.active) ?? [],
    [caseItem?.processNumbers],
  )

  const latestMovements = useMemo(
    () => [...(caseItem?.movements ?? [])].reverse().slice(0, 5),
    [caseItem?.movements],
  )

  function ensureUser() {
    if (!user) {
      toast.error("Usuário não autenticado.")
      return false
    }

    return true
  }

  async function uploadFiles(files: FileList | null) {
    if (!caseItem) return [] as UploadedFileMeta[]
    if (!files || files.length === 0) return [] as UploadedFileMeta[]

    try {
      setUploadingMovement(true)

      const form = new FormData()
      form.append("cpf", caseItem.cpf)
      form.append("protocol", caseItem.protocolNumber)
      form.append("module", "prejudicial")
      form.append("category", "interacao")

      Array.from(files).forEach((file) => {
        form.append("files", file)
      })

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: form,
      })

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Falha no upload.")
      }

      return data.files as UploadedFileMeta[]
    } finally {
      setUploadingMovement(false)
    }
  }

  async function handleSaveMovement() {
    if (!caseItem || !ensureUser()) return

    if (!movementDescription.trim()) {
      toast.error("Descreva a movimentação.")
      return
    }

    if (movementType === "envio_agendamento_demanda" && !movementDueAt) {
      toast.error("Informe o prazo de resposta do Agendamento.")
      return
    }

    if (movementType === "agendado" && !movementAppointmentDate) {
      toast.error("Informe a data do agendamento.")
      return
    }

    try {
      setSaving(true)

      const uploadedFiles = await uploadFiles(selectedMovementFiles)

      const response = await fetch(
        `/api/pre-judicial/casos/${encodeURIComponent(caseItem.id)}/movimentacoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: movementType,
            description: movementDescription.trim(),
            dueAt: movementDueAt || undefined,
            appointmentDate: movementAppointmentDate || undefined,
            attachments: uploadedFiles,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao registrar movimentação.")
      }

      toast.success("Movimentação registrada no banco.")
      setMovementDescription("")
      setMovementDueAt("")
      setMovementAppointmentDate("")
      setSelectedMovementFiles(null)
      await loadCase()
    } catch (error) {
      console.error("[PreJudicialCaseDetail] erro ao salvar movimentação:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao registrar movimentação.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleFinalizeDemand() {
    if (!caseItem || !ensureUser()) return

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

    if (["resolvido", "cumprido", "obito", "arquivado", "devolvida"].includes(finalizeStatus)) {
      if (!finalizeReason.trim()) {
        toast.error("Informe a justificativa antes de salvar.")
        return
      }
    }

    if (["bloqueio", "sequestro"].includes(finalizeStatus)) {
      if (!finalizeValorEstado.trim()) {
        toast.error("Informe o valor para o Estado.")
        return
      }

      if (!finalizeValorMunicipio.trim()) {
        toast.error("Informe o valor para o Município.")
        return
      }
    }

    try {
      setSaving(true)

      const response = await fetch(
        `/api/pre-judicial/casos/${encodeURIComponent(caseItem.id)}/finalizacao`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: finalizeStatus,
            pendingLocation: finalizeStatus === "pendente" ? finalizePendingLocation : undefined,
            reason: finalizeReason.trim() || undefined,
            valorEstado: finalizeValorEstado.trim() || undefined,
            valorMunicipio: finalizeValorMunicipio.trim() || undefined,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao finalizar demanda.")
      }

      toast.success("Finalização salva no banco.")
      setFinalizeReason("")
      setFinalizeValorEstado("")
      setFinalizeValorMunicipio("")
      setFinalizeOpen(false)
      await loadCase()
    } catch (error) {
      console.error("[PreJudicialCaseDetail] erro ao finalizar:", error)
      toast.error(
        error instanceof Error ? error.message : "Erro ao finalizar demanda.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleAddProcedure() {
    if (!caseItem || !ensureUser()) return

    const sigtapCode = selectedProcedure?.sigtapCode || procedureSearch.trim()
    const description = selectedProcedure?.description || procedureDescription.trim()

    if (!sigtapCode || !description) {
      toast.error("Selecione ou informe um procedimento SIGTAP com descrição.")
      return
    }

    try {
      setSaving(true)

      const response = await fetch(
        `/api/pre-judicial/casos/${encodeURIComponent(caseItem.id)}/procedimentos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sigtapId: selectedProcedure?.id,
            sigtapCode,
            description,
            specialty: procedureSpecialty.trim() || undefined,
            subSpecialty: procedureSubSpecialty.trim() || undefined,
            situation: procedureSituation,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao adicionar procedimento.")
      }

      toast.success("Procedimento adicionado.")
      setProcedureSearch("")
      setProcedureResults([])
      setSelectedProcedure(null)
      setProcedureDescription("")
      setProcedureSpecialty("")
      setProcedureSubSpecialty("")
      setProcedureSituation("determinado")
      await loadCase()
    } catch (error) {
      console.error("[PreJudicialCaseDetail] erro ao adicionar procedimento:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao adicionar procedimento.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleProcedure(item: PreJudicialProcedureView) {
    if (!caseItem || !ensureUser()) return

    const nextActive = !item.active
    const reason = nextActive
      ? ""
      : window.prompt("Informe o motivo da inativação do procedimento:") || ""

    try {
      setSaving(true)

      const response = await fetch(
        `/api/pre-judicial/casos/${encodeURIComponent(caseItem.id)}/procedimentos/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            active: nextActive,
            reason,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao atualizar procedimento.")
      }

      toast.success(nextActive ? "Procedimento reativado." : "Procedimento inativado.")
      await loadCase()
    } catch (error) {
      console.error("[PreJudicialCaseDetail] erro ao atualizar procedimento:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao atualizar procedimento.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCid() {
    if (!caseItem || !ensureUser()) return

    if (!cidCode.trim() || !cidDescription.trim()) {
      toast.error("Informe código e descrição do CID.")
      return
    }

    try {
      setSaving(true)

      const response = await fetch(
        `/api/pre-judicial/casos/${encodeURIComponent(caseItem.id)}/cids`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: cidCode.trim(),
            description: cidDescription.trim(),
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao adicionar CID.")
      }

      toast.success("CID adicionado.")
      setCidCode("")
      setCidDescription("")
      await loadCase()
    } catch (error) {
      console.error("[PreJudicialCaseDetail] erro ao adicionar CID:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar CID.")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleCid(item: PreJudicialCidView) {
    if (!caseItem || !ensureUser()) return

    const nextActive = !item.active
    const reason = nextActive
      ? ""
      : window.prompt("Informe o motivo da inativação do CID:") || ""

    try {
      setSaving(true)

      const response = await fetch(
        `/api/pre-judicial/casos/${encodeURIComponent(caseItem.id)}/cids/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            active: nextActive,
            reason,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao atualizar CID.")
      }

      toast.success(nextActive ? "CID reativado." : "CID inativado.")
      await loadCase()
    } catch (error) {
      console.error("[PreJudicialCaseDetail] erro ao atualizar CID:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar CID.")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPgeNet() {
    if (!caseItem || !ensureUser()) return

    const numero = pgeNetNumber.trim()

    if (!numero) {
      toast.error("Informe o número do PGE.net.")
      return
    }

    try {
      setSaving(true)

      const response = await fetch(
        `/api/pre-judicial/casos/${encodeURIComponent(caseItem.id)}/pgenet`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            numero,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao adicionar PGE.net.")
      }

      toast.success("PGE.net vinculado ao banco.")
      setPgeNetNumber("")
      setPgeNetOpen(false)
      await loadCase()
    } catch (error) {
      console.error("[PreJudicialCaseDetail] erro ao adicionar PGE.net:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar PGE.net.")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddProcessNumber() {
    if (!caseItem || !ensureUser()) return

    const numero = processNumber.trim()

    if (!numero) {
      toast.error("Informe o número do processo.")
      return
    }

    try {
      setSaving(true)

      const response = await fetch(
        `/api/pre-judicial/casos/${encodeURIComponent(caseItem.id)}/processos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            numero,
            origem: processOrigin.trim() || undefined,
            observacao: processObservation.trim() || undefined,
            user,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao adicionar processo.")
      }

      toast.success("Processo vinculado ao banco.")
      setProcessNumber("")
      setProcessOrigin("")
      setProcessObservation("")
      setProcessNumberOpen(false)
      await loadCase()
    } catch (error) {
      console.error("[PreJudicialCaseDetail] erro ao adicionar processo:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar processo.")
    } finally {
      setSaving(false)
    }
  }

  function trackUiAction(action: string, details?: string) {
    if (!user || !caseItem?.id) return

    const key = `${caseItem.id}:${action}:${details ?? ""}:${user.id}`
    if (lastTrackedTabRef.current === key) return

    lastTrackedTabRef.current = key
  }

  function handlePrintMovements() {
    if (!caseItem) return

    function escapeHtml(value: unknown) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
    }

    const movements = [...caseItem.movements].reverse()

    const movementsHtml =
      movements.length === 0
        ? "<p>Nenhuma movimentação registrada.</p>"
        : movements
            .map((item) => {
              const attachments =
                item.attachments && item.attachments.length > 0
                  ? `
                    <div class="attachments">
                      <strong>Anexos:</strong>
                      ${item.attachments.map((att) => escapeHtml(att.name)).join(", ")}
                    </div>
                  `
                  : ""

              const dueAt = item.dueAt
                ? `<div class="muted"><strong>Prazo:</strong> ${escapeHtml(formatDateTime(item.dueAt))}</div>`
                : ""

              const appointmentDate = item.appointmentDate
                ? `<div class="muted"><strong>Agendamento:</strong> ${escapeHtml(formatDateTime(item.appointmentDate))}</div>`
                : ""

              return `
                <section class="movement">
                  <div class="movement-title">${escapeHtml(getMovementLabel(item.type))}</div>
                  <div class="muted">
                    ${escapeHtml(formatDateTime(item.createdAt))} • ${escapeHtml(item.createdByName)}
                  </div>
                  ${dueAt}
                  ${appointmentDate}
                  <div class="description">${escapeHtml(item.description)}</div>
                  ${attachments}
                </section>
              `
            })
            .join("")

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Movimentações - ${escapeHtml(caseItem.protocolNumber)}</title>
          <style>
            @page {
              margin: 12mm;
            }

            body {
              font-family: Arial, sans-serif;
              color: #111;
              background: #fff;
              font-size: 12px;
              line-height: 1.35;
            }

            h1 {
              font-size: 18px;
              margin: 0 0 6px 0;
            }

            h2 {
              font-size: 14px;
              margin: 16px 0 8px 0;
            }

            .header {
              border-bottom: 1px solid #ddd;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }

            .muted {
              color: #555;
              margin-top: 2px;
            }

            .movement {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 10px;
              margin-bottom: 8px;
              break-inside: avoid;
            }

            .movement-title {
              font-weight: 700;
              margin-bottom: 3px;
            }

            .description {
              margin-top: 6px;
              white-space: pre-wrap;
            }

            .attachments {
              margin-top: 6px;
              color: #555;
            }
          </style>
        </head>

        <body>
          <div class="header">
            <h1>Movimentações registradas</h1>
            <div><strong>Paciente:</strong> ${escapeHtml(caseItem.patientName)}</div>
            <div>
              <strong>CPF:</strong> ${escapeHtml(caseItem.cpf || "Não informado")}
              |
              <strong>Protocolo:</strong> ${escapeHtml(caseItem.protocolNumber)}
            </div>
            <div><strong>Município:</strong> ${escapeHtml(caseItem.municipalityName || "Não informado")}</div>
          </div>

          <h2>Linha do tempo</h2>
          ${movementsHtml}

          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `

    const printWindow = window.open("", "_blank", "width=900,height=700")

    if (!printWindow) {
      toast.error("O navegador bloqueou a janela de impressão.")
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }


  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Carregando processo pré judicial...
      </div>
    )
  }

  if (loadError || !caseItem) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        {loadError || "Processo pré judicial não encontrado."}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent"
          onClick={() => {
            trackUiAction("voltar_processo_pre_judicial")
            window.history.back()
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="mr-2 h-4 w-4" /> Ver histórico
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="bg-transparent"
            onClick={() => setAuditOpen(true)}
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> Auditoria
          </Button>

                  <Button
          variant="outline"
          size="sm"
          className="bg-transparent"
          onClick={handlePrintMovements}
        >
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-4">
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  caseItem.deadlineWarningLevel === "overdue"
                    ? "destructive"
                    : "secondary"
                }
              >
                {getDeadlineBadgeText(caseItem.deadlineWarningLevel)}
              </Badge>

              <Badge variant="outline">{getStatusLabel(caseItem.status)}</Badge>
              <Badge variant="outline">PRE JUDICIAL</Badge>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {caseItem.patientName}
            </h1>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                <span className="font-medium text-foreground">CPF</span>{" "}
                {caseItem.cpf || "Não informado"}
              </span>

              <span>|</span>

              <span>
                <span className="font-medium text-foreground">Protocolo:</span>{" "}
                <span className="font-mono font-semibold text-foreground">
                  {caseItem.protocolNumber}
                </span>
              </span>

              <Badge variant="secondary">{getStatusLabel(caseItem.status)}</Badge>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Finalizar demanda"
                onClick={() => setFinalizeOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-foreground">PGE.net:</span>

              <span>
                {(caseItem.pgeNetNumbers ?? []).filter((item) => item.active).length === 0
                  ? "Não informado"
                  : (caseItem.pgeNetNumbers ?? [])
                      .filter((item) => item.active)
                      .map((item) => item.numero)
                      .join(" • ")}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Adicionar PGE.net"
                onClick={() => setPgeNetOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-foreground">Processo:</span>

              <span>
                {(caseItem.processNumbers ?? []).filter((item) => item.active).length === 0
                  ? "Não informado"
                  : (caseItem.processNumbers ?? [])
                      .filter((item) => item.active)
                      .map((item) => item.numero)
                      .join(" • ")}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Adicionar processo"
                onClick={() => setProcessNumberOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                <span className="font-medium text-foreground">Município:</span>{" "}
                {caseItem.municipalityName || "Não informado"}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Contatos do município"
                onClick={() => setMunicipalityOpen(true)}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                <span className="font-medium text-foreground">Prazo atual:</span>{" "}
                {formatDate(caseItem.deadlineAt)}
              </span>

              <span>|</span>

              <span>
                <span className="font-medium text-foreground">Agendamento:</span>{" "}
                {getSchedulingLabel(caseItem.schedulingStatus)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
              <span className="font-medium text-foreground">Procedimentos SIGTAP:</span>

              <span>
                {activeProcedures.length === 0
                  ? "Nenhum procedimento ativo"
                  : activeProcedures
                      .map((item) => {
                        const extra = [item.specialty, item.subSpecialty]
                          .filter(Boolean)
                          .join(" - ")

                        return `${item.sigtapCode} - ${item.description}${extra ? ` | ${extra}` : ""}`
                      })
                      .join(" • ")}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Adicionar procedimento"
                onClick={() => setProcedureOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-foreground">CID10:</span>

              <span>
                {activeCids.length === 0
                  ? "Nenhum CID ativo"
                  : activeCids
                      .map((item) => `${item.code} - ${item.description}`)
                      .join(" • ")}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Adicionar CID"
                onClick={() => setCidOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Card className="border-border prejudicial-no-print">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nova movimentação</CardTitle>
            <CardDescription>
              Registre interações, envio ao Agendamento, retorno de fila ou encerramento.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs">Movimentação</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={movementType}
                onChange={(event) => setMovementType(event.target.value)}
              >
                {PRE_MOVEMENT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {(movementType === "envio_agendamento_demanda" ||
              movementType === "reserva_agendamento") && (
              <div>
                <Label className="mb-1 block text-xs">Prazo de resposta</Label>
                <Input
                  type="datetime-local"
                  value={movementDueAt}
                  onChange={(event) => setMovementDueAt(event.target.value)}
                />
              </div>
            )}

            {movementType === "agendado" && (
              <div>
                <Label className="mb-1 block text-xs">Data do agendamento</Label>
                <Input
                  type="datetime-local"
                  value={movementAppointmentDate}
                  onChange={(event) => setMovementAppointmentDate(event.target.value)}
                />
              </div>
            )}

            <Textarea
              rows={5}
              value={movementDescription}
              onChange={(event) => setMovementDescription(event.target.value)}
              placeholder="Descreva a movimentação realizada..."
            />

            <div className="space-y-2">
              <Label className="text-xs">Documentos da movimentação</Label>
              <Input
                type="file"
                multiple
                onChange={(event) => setSelectedMovementFiles(event.target.files)}
              />
              {selectedMovementFiles && selectedMovementFiles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Array.from(selectedMovementFiles)
                    .map((file) => file.name)
                    .join(", ")}
                </p>
              )}
            </div>

            <Button onClick={handleSaveMovement} disabled={saving || uploadingMovement}>
              <Mail className="mr-2 h-4 w-4" />
              {uploadingMovement
                ? "Enviando arquivo..."
                : saving
                  ? "Salvando..."
                  : "Salvar movimentação"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimas movimentações</CardTitle>
            <CardDescription>Exibe as 5 movimentações mais recentes.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {latestMovements.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhuma movimentação registrada.
              </div>
            ) : (
              latestMovements.map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{getMovementLabel(item.type)}</Badge>

                    {item.dueAt && (
                      <Badge variant="secondary">Prazo {formatDateTime(item.dueAt)}</Badge>
                    )}

                    {item.appointmentDate && (
                      <Badge variant="secondary">
                        Agenda {formatDateTime(item.appointmentDate)}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm font-medium">{item.createdByName}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {item.description}
                  </p>

                  {item.attachments.length > 0 && (
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
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Finalizar demanda</DialogTitle>
            <DialogDescription>
              Use esta área para marcar pendência, resolução, cumprimento, bloqueio, sequestro, óbito, arquivamento ou devolução.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                  "devolvida",
                ] as Array<keyof typeof PRE_FINALIZATION_LABELS>
              ).map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={status === finalizeStatus ? "default" : "outline"}
                  className={status === finalizeStatus ? "" : "bg-transparent"}
                  onClick={() => setFinalizeStatus(status)}
                >
                  {PRE_FINALIZATION_LABELS[status]}
                </Button>
              ))}
            </div>

            {finalizeStatus === "pendente" && (
              <div>
                <Label className="mb-1 block text-xs">Onde está pendente?</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={finalizePendingLocation}
                  onChange={(event) =>
                    setFinalizePendingLocation(event.target.value as "ses" | "core" | "municipio")
                  }
                >
                  <option value="ses">Pendente SES</option>
                  <option value="core">Pendente CORE</option>
                  <option value="municipio">Pendente Município</option>
                </select>
              </div>
            )}

            {["bloqueio", "sequestro"].includes(finalizeStatus) && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">Valor para o Estado</Label>
                  <Input
                    value={finalizeValorEstado}
                    onChange={(event) => setFinalizeValorEstado(event.target.value)}
                    placeholder="Exemplo: 1500,00"
                  />
                </div>

                <div>
                  <Label className="mb-1 block text-xs">Valor para o Município</Label>
                  <Input
                    value={finalizeValorMunicipio}
                    onChange={(event) => setFinalizeValorMunicipio(event.target.value)}
                    placeholder="Exemplo: 1500,00"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="mb-1 block text-xs">Justificativa</Label>
              <Textarea
                rows={5}
                value={finalizeReason}
                onChange={(event) => setFinalizeReason(event.target.value)}
                placeholder="Descreva a justificativa da finalização ou pendência."
              />
            </div>

            {latestFinalization && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Última finalização:</span>{" "}
                  {getFinalizationLabel(latestFinalization.status)}
                </p>
                <p>
                  {formatDateTime(latestFinalization.createdAt)} • {latestFinalization.createdByName}
                </p>
                {latestFinalization.pendingLocation && (
                  <p>Pendente em: {getPendingLocationLabel(latestFinalization.pendingLocation)}</p>
                )}
                {latestFinalization.reason && <p>Justificativa: {latestFinalization.reason}</p>}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-transparent" onClick={() => setFinalizeOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleFinalizeDemand} disabled={saving}>
                <FileText className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar finalização"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pgeNetOpen} onOpenChange={setPgeNetOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar PGE.net</DialogTitle>
            <DialogDescription>
              Vincule um novo número PGE.net ao caso Pré Judicial. O registro será salvo no banco, na linha do tempo e na auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs">Número do PGE.net</Label>
              <Input
                value={pgeNetNumber}
                onChange={(event) => setPgeNetNumber(event.target.value)}
                placeholder="Exemplo: PGE-PRE-002"
              />
            </div>

            <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">PGE.net vinculados</p>
              {activePgeNetNumbers.length === 0 ? (
                <p>Nenhum PGE.net ativo.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {activePgeNetNumbers.map((item) => (
                    <p key={item.id}>{item.numero} • {item.createdByName}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-transparent" onClick={() => setPgeNetOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddPgeNet} disabled={saving}>
                {saving ? "Salvando..." : "Salvar PGE.net"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={processNumberOpen} onOpenChange={setProcessNumberOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar processo vinculado</DialogTitle>
            <DialogDescription>
              Cadastre o número do processo relacionado ao caso Pré Judicial. O registro será salvo no banco, na linha do tempo e na auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs">Número do processo</Label>
              <Input
                value={processNumber}
                onChange={(event) => setProcessNumber(event.target.value)}
                placeholder="Informe o número do processo"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">Origem</Label>
              <Input
                value={processOrigin}
                onChange={(event) => setProcessOrigin(event.target.value)}
                placeholder="Exemplo: Tribunal, PGE, Município"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">Observação</Label>
              <Textarea
                rows={3}
                value={processObservation}
                onChange={(event) => setProcessObservation(event.target.value)}
                placeholder="Observação opcional"
              />
            </div>

            <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Processos vinculados</p>
              {activeProcessNumbers.length === 0 ? (
                <p>Nenhum processo ativo.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {activeProcessNumbers.map((item) => (
                    <div key={item.id} className="rounded-md border border-border p-2">
                      <p className="font-medium text-foreground">{item.numero}</p>
                      {item.origem && <p>Origem: {item.origem}</p>}
                      {item.observacao && <p>Observação: {item.observacao}</p>}
                      <p>{item.createdByName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-transparent" onClick={() => setProcessNumberOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddProcessNumber} disabled={saving}>
                {saving ? "Salvando..." : "Salvar processo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={procedureOpen} onOpenChange={setProcedureOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Procedimentos SIGTAP</DialogTitle>
            <DialogDescription>
              Pesquise na tabela SIGTAP, selecione o procedimento e salve o vínculo no Pré Judicial.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <div>
                <Label className="mb-1 block text-xs">Pesquisar procedimento</Label>
                <Input
                  value={procedureSearch}
                  onChange={(event) => {
                    setProcedureSearch(event.target.value)
                    setSelectedProcedure(null)
                  }}
                  placeholder="Digite código ou descrição SIGTAP"
                />
              </div>

              {procedureResults.length > 0 && (
                <div className="max-h-56 overflow-auto rounded-lg border border-border p-2">
                  {procedureResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setSelectedProcedure(item)
                        setProcedureSearch(`${item.sigtapCode} - ${item.description}`)
                        setProcedureDescription(item.description)
                      }}
                    >
                      <span>
                        {item.sigtapCode} - {item.description}
                      </span>
                      <Plus className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              )}

              <div>
                <Label className="mb-1 block text-xs">Descrição</Label>
                <Input
                  value={procedureDescription}
                  onChange={(event) => setProcedureDescription(event.target.value)}
                  placeholder="Descrição do procedimento"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">Especialidade</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={procedureSpecialty}
                    onChange={(event) => {
                      setProcedureSpecialty(event.target.value)
                      setProcedureSubSpecialty("")
                    }}
                  >
                    <option value="">Selecione</option>
                    {specialtyOptions.map((item) => (
                      <option key={item.id} value={item.nome}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="mb-1 block text-xs">Subespecialidade</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={procedureSubSpecialty}
                    onChange={(event) => setProcedureSubSpecialty(event.target.value)}
                    disabled={!procedureSpecialty}
                  >
                    <option value="">Selecione</option>
                    {subSpecialtyOptions.map((item) => (
                      <option key={item.id} value={item.nome}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-xs">Situação</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={procedureSituation}
                  onChange={(event) => setProcedureSituation(event.target.value)}
                >
                  <option value="determinado">Determinado</option>
                  <option value="cumprido">Cumprido</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              </div>

              <Button onClick={handleAddProcedure} disabled={saving}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar procedimento
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Procedimentos vinculados</p>
              {caseItem.procedures.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhum procedimento registrado.
                </div>
              ) : (
                caseItem.procedures.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {item.sigtapCode} - {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.active ? "Ativo" : "Inativo"} • {item.createdByName}
                        </p>
                        {(item.specialty || item.subSpecialty) && (
                          <p className="text-xs text-muted-foreground">
                            {[item.specialty, item.subSpecialty].filter(Boolean).join(" • ")}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent"
                        onClick={() => handleToggleProcedure(item)}
                        disabled={saving}
                      >
                        {item.active ? "Inativar" : "Ativar"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cidOpen} onOpenChange={setCidOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>CID10</DialogTitle>
            <DialogDescription>
              Adicione, inative ou reative CIDs vinculados ao Pré Judicial.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[0.8fr_1fr]">
            <div className="space-y-3">
              <div>
                <Label className="mb-1 block text-xs">CID10</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={cidCode && cidDescription ? `${cidCode}|||__|||${cidDescription}` : ""}
                  onChange={(event) => {
                    const value = event.target.value

                    if (!value) {
                      setCidCode("")
                      setCidDescription("")
                      return
                    }

                    const [code, description] = value.split("|||__|||")
                    setCidCode(code || "")
                    setCidDescription(description || "")
                  }}
                >
                  <option value="">Selecione</option>
                  {cidOptions.map((item) => (
                    <option
                      key={item.id}
                      value={`${item.code}|||__|||${item.description}`}
                    >
                      {item.code} - {item.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="mb-1 block text-xs">Descrição</Label>
                <Input value={cidDescription} readOnly placeholder="Descrição do CID" />
              </div>

              <Button onClick={handleAddCid} disabled={saving || !cidCode}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar CID
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">CIDs vinculados</p>
              {caseItem.cids.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhum CID registrado.
                </div>
              ) : (
                caseItem.cids.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {item.code} - {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.active ? "Ativo" : "Inativo"} • {item.createdByName}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent"
                        onClick={() => handleToggleCid(item)}
                        disabled={saving}
                      >
                        {item.active ? "Inativar" : "Ativar"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={municipalityOpen} onOpenChange={setMunicipalityOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contatos do município</DialogTitle>
            <DialogDescription>
              Dados usados para notificação, manifestação e acompanhamento municipal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <p>
              <strong>Município:</strong> {caseItem.municipalityName}
            </p>
            <p>
              <strong>E-mails:</strong> {municipality?.emails.join(", ") || "Não informado"}
            </p>
            <p>
              <strong>Telefones:</strong> {municipality?.phones.join(", ") || "Não informado"}
            </p>
            <p>
              <strong>Responsáveis:</strong> {municipality?.contacts.join(", ") || "Não informado"}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Histórico do Pré Judicial</DialogTitle>
            <DialogDescription>
              Linha do tempo com as movimentações gravadas no banco.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {[...caseItem.movements].reverse().map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{getMovementLabel(item.type)}</Badge>
                  {item.dueAt && <Badge variant="secondary">Prazo {formatDateTime(item.dueAt)}</Badge>}
                  {item.appointmentDate && (
                    <Badge variant="secondary">Agenda {formatDateTime(item.appointmentDate)}</Badge>
                  )}
                </div>
                <p className="text-sm font-medium">{item.createdByName}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{item.description}</p>

                {item.attachments.length > 0 && (
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Auditoria e motivos da exibição</DialogTitle>
            <DialogDescription>
              As APIs já gravam as ações em sistema_auditoria. A exibição detalhada da tabela de auditoria pode ser ligada em rota própria se necessário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Motivo da exibição</p>
              <p>Processo exibido por acesso direto ao protocolo/caso {caseItem.protocolNumber}.</p>
            </div>

            <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Ações já auditadas no banco</p>
              <p>Finalização, movimentações, inclusão/inativação de procedimento e inclusão/inativação de CID.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
