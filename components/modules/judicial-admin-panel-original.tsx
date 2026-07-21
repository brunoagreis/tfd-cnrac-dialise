"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  Italic,
  List,
  ListOrdered,
  Mail,
  Save,
  Search,
  Settings2,
  Strikethrough,
  Type,
  Underline,
  Upload,
} from "lucide-react"

import { useJudicial } from "@/lib/judicial-context"
import {
  CORE_TABLE_LABELS,
  CORE_TABLES,
  type CoreTable,
  type EmailTemplate,
  type MunicipalityContact,
  type PriorityFocusItem,
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
import { JudicialBloqueioSequestroPanel } from "@/components/modules/judicial-bloqueio-sequestro-panel"
import { JudicialPrioritiesPanelCombined } from "@/components/modules/judicial-priorities-panel-combined"
import { JudicialPriorityReportShortcuts } from "@/app/(admin)/admin/judicial/page"

type EspecialidadeSubItem = {
  especialidadeId: string
  especialidadeNome: string
  subespecialidadeId: string
  subespecialidadeNome: string
  updatedAt: string
}

type SigTapCadastroItem = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean
  updatedAt: string
}

function csvEscape(value: string | number | undefined) {
  const text = String(value ?? "")
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

const EMAIL_TEMPLATE_DEFAULT_HTML =
  "<p>Prezados,</p><p></p><p>Atenciosamente,</p><p>$user_sistema</p>"

const RICH_FONT_SIZE_OPTIONS = [
  { value: "2", label: "10" },
  { value: "3", label: "12" },
  { value: "4", label: "14" },
  { value: "5", label: "18" },
  { value: "6", label: "24" },
]

const RICH_FONT_FAMILY_OPTIONS = [
  { value: "Arial", label: "Arial" },
  { value: "Verdana", label: "Verdana" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "Times New Roman", label: "Times" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier" },
]

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

function makeUiId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeProcedureCode(value: string) {
  return String(value ?? "").replace(/\D/g, "")
}

function normalizeCidCode(value: string) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

function formatCidCode(value: string) {
  const normalized = normalizeCidCode(value).slice(0, 6)
  if (!normalized) return ""
  if (normalized.length <= 3) return normalized
  return `${normalized.slice(0, 3)}.${normalized.slice(3)}`
}

function normalizeUpperInput(value: string) {
  return value.toUpperCase()
}

function normalizeDigitsOnlyInput(value: string) {
  return value.replace(/\D/g, "")
}

function isPriorityItemActive(item: PriorityFocusItem) {
  if (!item.expiresAt) return true
  const expiresAt = new Date(`${item.expiresAt}T23:59:59.999`)
  return expiresAt >= new Date()
}

function describePriorityItem(item: PriorityFocusItem) {
  const base =
    item.mode === "procedure"
      ? `Procedimento ${item.label}`
      : item.mode === "combined"
        ? `Combinação ${item.label}`
        : `CID ${item.label}`

  return item.expiresAt
    ? `${base} • até ${new Date(`${item.expiresAt}T00:00:00`).toLocaleDateString("pt-BR")}`
    : `${base} • sem prazo final`
}

export function JudicialAdminPanel() {
  const judicial = useJudicial()

  const [table, setTable] = useState<CoreTable>("core_ambulatorial_finalizados")
  const [uploadingCoreFile, setUploadingCoreFile] = useState(false)
  const [selectedCoreFile, setSelectedCoreFile] = useState<File | null>(null)
  const coreFileInputRef = useRef<HTMLInputElement | null>(null)

  const [focusMode, setFocusMode] = useState<"none" | "procedure" | "cid" | "combined">(
    judicial.priorityFocus.mode === "none"
      ? "procedure"
      : judicial.priorityFocus.mode,
  )
  const [priorityProcedureQuery, setPriorityProcedureQuery] = useState("")
  const [priorityCidQuery, setPriorityCidQuery] = useState("")
  const [priorityCombinedCid, setPriorityCombinedCid] = useState("")
  const [priorityCombinedProcedure, setPriorityCombinedProcedure] = useState("")
  const [priorityCombinedSpecialty, setPriorityCombinedSpecialty] = useState("")
  const [priorityCombinedSubspecialty, setPriorityCombinedSubspecialty] = useState("")
  const [priorityExpiresAt, setPriorityExpiresAt] = useState("")
  const [focusItems, setFocusItems] = useState<PriorityFocusItem[]>(
    judicial.priorityFocus.items ?? [],
  )
  const [loadingPriorities, setLoadingPriorities] = useState(false)
  const [savingPriorities, setSavingPriorities] = useState(false)
  const [priorityProcedureOptions, setPriorityProcedureOptions] = useState<SigTapCadastroItem[]>([])
  const [loadingPriorityProcedureOptions, setLoadingPriorityProcedureOptions] = useState(false)
  const [priorityCidOptions, setPriorityCidOptions] = useState<CidCatalogItem[]>([])
  const [loadingPriorityCidOptions, setLoadingPriorityCidOptions] = useState(false)

  const [editingMunicipalityId, setEditingMunicipalityId] = useState("")
  const [municipalityName, setMunicipalityName] = useState("")
  const [emails, setEmails] = useState("")
  const [phones, setPhones] = useState("")
  const [contacts, setContacts] = useState("")
  const [municipalityItems, setMunicipalityItems] = useState<MunicipalityContact[]>([])
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false)
  const [savingMunicipality, setSavingMunicipality] = useState(false)

  const [editingTemplateId, setEditingTemplateId] = useState("")
  const [templateType, setTemplateType] = useState("demanda_judicial_cadastrada")
  const [templateTitle, setTemplateTitle] = useState("")
  const [templateSubject, setTemplateSubject] = useState("")
  const [templateBody, setTemplateBody] = useState(EMAIL_TEMPLATE_DEFAULT_HTML)
  const [templateFontFamily, setTemplateFontFamily] = useState("Arial")
  const [templateFontSize, setTemplateFontSize] = useState("3")
  const [emailTemplateItems, setEmailTemplateItems] = useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const templateEditorRef = useRef<HTMLDivElement | null>(null)

  const [especialidadeSubItems, setEspecialidadeSubItems] = useState<EspecialidadeSubItem[]>([])
  const [loadingEspecialidadeSub, setLoadingEspecialidadeSub] = useState(false)
  const [savingEspecialidadeSub, setSavingEspecialidadeSub] = useState(false)
  const [editingEspecialidadeId, setEditingEspecialidadeId] = useState("")
  const [editingSubespecialidadeId, setEditingSubespecialidadeId] = useState("")
  const [especialidadeNomeCadastro, setEspecialidadeNomeCadastro] = useState("")
  const [subespecialidadeNomeCadastro, setSubespecialidadeNomeCadastro] = useState("")

  const [sigtapCadastroItems, setSigTapCadastroItems] = useState<SigTapCadastroItem[]>([])
  const [loadingSigTapCadastro, setLoadingSigTapCadastro] = useState(false)
  const [savingSigTapCadastro, setSavingSigTapCadastro] = useState(false)
  const [editingSigTapCadastroId, setEditingSigTapCadastroId] = useState("")
  const [sigtapCodigoCadastro, setSigTapCodigoCadastro] = useState("")
  const [sigtapDescricaoCadastro, setSigTapDescricaoCadastro] = useState("")
  const [sigtapBuscaCadastro, setSigTapBuscaCadastro] = useState("")

  const seizure = judicial.getSeizureSummary()

  const groupedEspecialidades = useMemo(() => {
    const map = new Map<
      string,
      {
        especialidadeId: string
        especialidadeNome: string
        subs: EspecialidadeSubItem[]
      }
    >()

    for (const item of especialidadeSubItems) {
      const key = item.especialidadeId
      const existing = map.get(key)

      if (existing) {
        existing.subs.push(item)
      } else {
        map.set(key, {
          especialidadeId: item.especialidadeId,
          especialidadeNome: item.especialidadeNome,
          subs: [item],
        })
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.especialidadeNome.localeCompare(b.especialidadeNome, "pt-BR"),
    )
  }, [especialidadeSubItems])

  const filteredPriorityCidOptions = useMemo(() => priorityCidOptions, [priorityCidOptions])

  const combinedSubspecialtyOptions = useMemo(() => {
    const specialty = normalizeUpperInput(priorityCombinedSpecialty.trim())

    if (!specialty) return []

    return especialidadeSubItems
      .filter(
        (item) => normalizeUpperInput(item.especialidadeNome.trim()) === specialty,
      )
      .sort((a, b) =>
        a.subespecialidadeNome.localeCompare(b.subespecialidadeNome, "pt-BR"),
      )
  }, [especialidadeSubItems, priorityCombinedSpecialty])

  useEffect(() => {
    setFocusItems(judicial.priorityFocus.items ?? [])
  }, [judicial.priorityFocus.items])

  useEffect(() => {
    if (
      judicial.priorityFocus.mode === "procedure" ||
      judicial.priorityFocus.mode === "cid" ||
      judicial.priorityFocus.mode === "combined"
    ) {
      setFocusMode(judicial.priorityFocus.mode)
    }
  }, [judicial.priorityFocus.mode])

  useEffect(() => {
    const html = templateBodyToHtml(templateBody || EMAIL_TEMPLATE_DEFAULT_HTML)
    if (templateEditorRef.current && templateEditorRef.current.innerHTML !== html) {
      templateEditorRef.current.innerHTML = html
    }
  }, [templateBody])

  useEffect(() => {
    void fetchMunicipalities()
    void fetchEmailTemplates()
    void fetchPriorityFocus()
    void fetchEspecialidadeSub()
    void fetchSigTapCadastro()
  }, [])

  useEffect(() => {
    if (focusMode !== "procedure") return

    const timer = setTimeout(() => {
      void fetchPriorityProcedureOptions(priorityProcedureQuery)
    }, 250)

    return () => clearTimeout(timer)
  }, [focusMode, priorityProcedureQuery])

  useEffect(() => {
    if (focusMode !== "cid") return

    const timer = setTimeout(() => {
      void fetchPriorityCidOptions(priorityCidQuery)
    }, 250)

    return () => clearTimeout(timer)
  }, [focusMode, priorityCidQuery])

  async function handleImportCore() {
    if (!selectedCoreFile) {
      toast.error("Selecione um arquivo Excel para importar.")
      return
    }

    try {
      setUploadingCoreFile(true)

      const formData = new FormData()
      formData.append("tipoImportacao", table)
      formData.append("file", selectedCoreFile)

      const response = await fetch("/api/admin/judicial/core-importacoes", {
        method: "POST",
        body: formData,
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao importar arquivo CORE.")
        return
      }

      const totalRegistros = Number(json?.totalRegistros ?? 0)

      toast.success(
        `${CORE_TABLE_LABELS[table]} importado com sucesso. ${totalRegistros} registro(s) processado(s).`,
      )

      setSelectedCoreFile(null)
      if (coreFileInputRef.current) {
        coreFileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("CORE_IMPORT_ERROR", error)
      toast.error("Erro ao importar arquivo CORE.")
    } finally {
      setUploadingCoreFile(false)
    }
  }

  async function fetchPriorityCidOptions(query: string) {
    try {
      setLoadingPriorityCidOptions(true)

      const params = new URLSearchParams()
      const normalized = normalizeCidCode(query)

      if (normalized) {
        params.set("q", normalized)
      }

      params.set("limit", "50")

      const response = await fetch(
        `/api/judicial/cid10${params.toString() ? `?${params.toString()}` : ""}`,
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar CID.")
        setPriorityCidOptions([])
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []

      setPriorityCidOptions(
        items
          .map((item: any) => ({
            code: String(item?.code ?? item?.codigo ?? "").trim(),
            description: String(item?.description ?? item?.descricao ?? "").trim(),
          }))
          .filter((item: CidCatalogItem) => item.code && item.description),
      )
    } catch (error) {
      console.error("LOAD_PRIORITY_CID_ERROR", error)
      toast.error("Erro ao carregar CID.")
      setPriorityCidOptions([])
    } finally {
      setLoadingPriorityCidOptions(false)
    }
  }
  async function fetchMunicipalities() {
    try {
      setLoadingMunicipalities(true)

      const response = await fetch("/api/admin/judicial/municipios", {
        method: "GET",
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar municípios.")
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []

      setMunicipalityItems(
        [...items].sort((a, b) =>
          String(a?.municipalityName ?? "").localeCompare(
            String(b?.municipalityName ?? ""),
            "pt-BR",
          ),
        ),
      )
    } catch (error) {
      console.error("LOAD_MUNICIPIOS_ERROR", error)
      toast.error("Erro ao carregar municípios.")
    } finally {
      setLoadingMunicipalities(false)
    }
  }

  async function handleSaveMunicipality() {
    if (!municipalityName.trim()) {
      toast.error("Informe o município.")
      return
    }

    try {
      setSavingMunicipality(true)

      const response = await fetch("/api/admin/judicial/municipios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingMunicipalityId || undefined,
          municipalityName,
          emails: emails
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          phones: phones
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          contacts: contacts
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok || !json?.item) {
        toast.error(json?.error || "Erro ao salvar município.")
        return
      }

      const savedItem = json.item as MunicipalityContact

      setMunicipalityItems((prev) => {
        const exists = prev.some((item) => item.id === savedItem.id)

        const next = exists
          ? prev.map((item) => (item.id === savedItem.id ? savedItem : item))
          : [...prev, savedItem]

        return next.sort((a, b) =>
          a.municipalityName.localeCompare(b.municipalityName, "pt-BR"),
        )
      })

      judicial.upsertMunicipalityContact(savedItem)

      toast.success("Contatos do município salvos.")
      setEditingMunicipalityId("")
      setMunicipalityName("")
      setEmails("")
      setPhones("")
      setContacts("")
    } catch (error) {
      console.error("SAVE_MUNICIPIO_ERROR", error)
      toast.error("Erro ao salvar município.")
    } finally {
      setSavingMunicipality(false)
    }
  }

  function loadMunicipality(id: string) {
    const item = municipalityItems.find((m) => m.id === id)
    if (!item) return

    setEditingMunicipalityId(item.id)
    setMunicipalityName(item.municipalityName)
    setEmails(item.emails.join(", "))
    setPhones(item.phones.join(", "))
    setContacts(item.contacts.join(", "))
  }

  async function fetchEmailTemplates() {
    try {
      setLoadingTemplates(true)

      const response = await fetch("/api/admin/judicial/emails", {
        method: "GET",
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar modelos de e-mail.")
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []

      setEmailTemplateItems(
        [...items].sort((a, b) =>
          String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "pt-BR"),
        ),
      )
    } catch (error) {
      console.error("LOAD_EMAIL_TEMPLATES_ERROR", error)
      toast.error("Erro ao carregar modelos de e-mail.")
    } finally {
      setLoadingTemplates(false)
    }
  }

  function runTemplateEditorCommand(command: string, value?: string) {
    templateEditorRef.current?.focus()
    document.execCommand("styleWithCSS", false, true)
    document.execCommand(command, false, value)
    setTemplateBody(templateEditorRef.current?.innerHTML || "")
  }

  function handleTemplateFontFamilyChange(value: string) {
    setTemplateFontFamily(value)
    runTemplateEditorCommand("fontName", value)
  }

  function handleTemplateFontSizeChange(value: string) {
    setTemplateFontSize(value)
    runTemplateEditorCommand("fontSize", value)
  }

  async function handleSaveTemplate() {
    const html = templateEditorRef.current?.innerHTML || templateBody

    if (
      !templateTitle.trim() ||
      !templateSubject.trim() ||
      !htmlHasContent(html)
    ) {
      toast.error("Título, assunto e corpo são obrigatórios.")
      return
    }

    try {
      setSavingTemplate(true)

      const response = await fetch("/api/admin/judicial/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingTemplateId || undefined,
          type: templateType,
          title: templateTitle,
          subject: templateSubject,
          body: html,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok || !json?.item) {
        toast.error(json?.error || "Erro ao salvar modelo de e-mail.")
        return
      }

      const savedItem = json.item as EmailTemplate

      setEmailTemplateItems((prev) => {
        const exists = prev.some((item) => item.id === savedItem.id)

        const next = exists
          ? prev.map((item) => (item.id === savedItem.id ? savedItem : item))
          : [...prev, savedItem]

        return next.sort((a, b) =>
          a.title.localeCompare(b.title, "pt-BR"),
        )
      })

      judicial.upsertEmailTemplate(savedItem)

      toast.success("Modelo de e-mail salvo.")
      setEditingTemplateId("")
      setTemplateTitle("")
      setTemplateSubject("")
      setTemplateBody(EMAIL_TEMPLATE_DEFAULT_HTML)

      if (templateEditorRef.current) {
        templateEditorRef.current.innerHTML = EMAIL_TEMPLATE_DEFAULT_HTML
      }
    } catch (error) {
      console.error("SAVE_EMAIL_TEMPLATE_ERROR", error)
      toast.error("Erro ao salvar modelo de e-mail.")
    } finally {
      setSavingTemplate(false)
    }
  }

  function loadTemplate(id: string) {
    const item = emailTemplateItems.find((m) => m.id === id)
    if (!item) return

    const html = templateBodyToHtml(item.body)
    setEditingTemplateId(item.id)
    setTemplateType(item.type)
    setTemplateTitle(item.title)
    setTemplateSubject(item.subject)
    setTemplateBody(html)

    if (templateEditorRef.current) {
      templateEditorRef.current.innerHTML = html
    }
  }

  async function fetchPriorityFocus() {
    try {
      setLoadingPriorities(true)

      const response = await fetch(
        "/api/admin/judicial/prioridades?tipoPrioridade=monitoramento",
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar prioridades.")
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []

      setFocusItems(items)

      if (items.length > 0) {
        const lastMode = items[items.length - 1]?.mode
        if (lastMode === "procedure" || lastMode === "cid" || lastMode === "combined") {
          setFocusMode(lastMode)
        }
      }

      judicial.setPriorityFocus({
        mode:
          items.length === 0
            ? "none"
            : (items[items.length - 1]?.mode ?? "procedure"),
        items,
      })
    } catch (error) {
      console.error("LOAD_PRIORIDADES_ERROR", error)
      toast.error("Erro ao carregar prioridades.")
    } finally {
      setLoadingPriorities(false)
    }
  }

  async function fetchEspecialidadeSub() {
    try {
      setLoadingEspecialidadeSub(true)

      const response = await fetch("/api/admin/judicial/especialidades", {
        method: "GET",
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar especialidades.")
        return
      }

      setEspecialidadeSubItems(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_ESPECIALIDADE_SUB_ERROR", error)
      toast.error("Erro ao carregar especialidades.")
    } finally {
      setLoadingEspecialidadeSub(false)
    }
  }

  async function handleSaveEspecialidadeSub() {
    if (!especialidadeNomeCadastro.trim()) {
      toast.error("Informe a especialidade.")
      return
    }

    if (!subespecialidadeNomeCadastro.trim()) {
      toast.error("Informe a subespecialidade.")
      return
    }

    try {
      setSavingEspecialidadeSub(true)

      const response = await fetch("/api/admin/judicial/especialidades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          especialidadeId: editingEspecialidadeId || undefined,
          subespecialidadeId: editingSubespecialidadeId || undefined,
          especialidadeNome: especialidadeNomeCadastro,
          subespecialidadeNome: subespecialidadeNomeCadastro,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok || !json?.item) {
        toast.error(json?.error || "Erro ao salvar especialidade e subespecialidade.")
        return
      }

      toast.success("Especialidade e subespecialidade salvas com sucesso.")
      setEditingEspecialidadeId("")
      setEditingSubespecialidadeId("")
      setEspecialidadeNomeCadastro("")
      setSubespecialidadeNomeCadastro("")
      await fetchEspecialidadeSub()
    } catch (error) {
      console.error("SAVE_ESPECIALIDADE_SUB_ERROR", error)
      toast.error("Erro ao salvar especialidade e subespecialidade.")
    } finally {
      setSavingEspecialidadeSub(false)
    }
  }

  function loadEspecialidadeSub(item: EspecialidadeSubItem) {
    setEditingEspecialidadeId(item.especialidadeId)
    setEditingSubespecialidadeId(item.subespecialidadeId)
    setEspecialidadeNomeCadastro(item.especialidadeNome)
    setSubespecialidadeNomeCadastro(item.subespecialidadeNome)
  }

  async function fetchSigTapCadastro() {
    try {
      setLoadingSigTapCadastro(true)

      const params = new URLSearchParams()
      if (sigtapBuscaCadastro.trim()) {
        params.set("q", sigtapBuscaCadastro.trim())
      }

      const response = await fetch(
        `/api/admin/judicial/sigtap${params.toString() ? `?${params.toString()}` : ""}`,
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar SIGTAP.")
        return
      }

      setSigTapCadastroItems(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_SIGTAP_CADASTRO_ERROR", error)
      toast.error("Erro ao carregar SIGTAP.")
    } finally {
      setLoadingSigTapCadastro(false)
    }
  }

  async function fetchPriorityProcedureOptions(query: string) {
    try {
      setLoadingPriorityProcedureOptions(true)

      const params = new URLSearchParams()
      const normalized = normalizeProcedureCode(query)

      if (normalized) {
        params.set("q", normalized)
      }

      const response = await fetch(
        `/api/admin/judicial/sigtap${params.toString() ? `?${params.toString()}` : ""}`,
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar procedimentos SIGTAP.")
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []
      setPriorityProcedureOptions(items)
    } catch (error) {
      console.error("LOAD_PRIORITY_SIGTAP_ERROR", error)
      toast.error("Erro ao carregar procedimentos SIGTAP.")
    } finally {
      setLoadingPriorityProcedureOptions(false)
    }
  }

  async function handleSaveSigTapCadastro() {
    if (!sigtapCodigoCadastro.trim()) {
      toast.error("Informe o código do SIGTAP.")
      return
    }

    if (!sigtapDescricaoCadastro.trim()) {
      toast.error("Informe a descrição do SIGTAP.")
      return
    }

    try {
      setSavingSigTapCadastro(true)

      const response = await fetch("/api/admin/judicial/sigtap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingSigTapCadastroId || undefined,
          codigo: sigtapCodigoCadastro,
          descricao: sigtapDescricaoCadastro,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok || !json?.item) {
        toast.error(json?.error || "Erro ao salvar SIGTAP.")
        return
      }

      toast.success("SIGTAP salvo com sucesso.")
      setEditingSigTapCadastroId("")
      setSigTapCodigoCadastro("")
      setSigTapDescricaoCadastro("")
      await fetchSigTapCadastro()

      if (focusMode === "procedure") {
        await fetchPriorityProcedureOptions(priorityProcedureQuery)
      }
    } catch (error) {
      console.error("SAVE_SIGTAP_CADASTRO_ERROR", error)
      toast.error("Erro ao salvar SIGTAP.")
    } finally {
      setSavingSigTapCadastro(false)
    }
  }

  function loadSigTapCadastro(item: SigTapCadastroItem) {
    setEditingSigTapCadastroId(item.id)
    setSigTapCodigoCadastro(item.codigo)
    setSigTapDescricaoCadastro(item.descricao)
  }

  function addProcedurePriority(item: SigTapCadastroItem) {
    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "procedure",
      value: item.codigo,
      label: `${item.codigo} - ${item.descricao}`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => {
      const normalizedValue = normalizeProcedureCode(item.codigo)
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.mode === "procedure" &&
          normalizeProcedureCode(entry.value) === normalizedValue,
      )

      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextItem,
          id: next[existingIndex].id,
        }
        return next
      }

      return [...prev, nextItem]
    })

    setPriorityProcedureQuery("")
    setPriorityExpiresAt("")
    setPriorityProcedureOptions([])
    toast.success("Procedimento adicionado à lista de prioridade.")
  }

  function addManualProcedurePriority() {
    const code = normalizeProcedureCode(priorityProcedureQuery)

    if (!code) {
      toast.error("Informe o procedimento SIGTAP.")
      return
    }

    const exactMatch =
      priorityProcedureOptions.find(
        (item) => normalizeProcedureCode(item.codigo) === code,
      ) ||
      sigtapCadastroItems.find(
        (item) => normalizeProcedureCode(item.codigo) === code,
      )

    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "procedure",
      value: code,
      label: exactMatch
        ? `${normalizeProcedureCode(exactMatch.codigo)} - ${exactMatch.descricao}`
        : `${code} - PROCEDIMENTO PRIORITÁRIO`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => {
      const normalizedValue = normalizeProcedureCode(code)
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.mode === "procedure" &&
          normalizeProcedureCode(entry.value) === normalizedValue,
      )

      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextItem,
          id: next[existingIndex].id,
        }
        return next
      }

      return [...prev, nextItem]
    })

    setPriorityProcedureQuery("")
    setPriorityExpiresAt("")
    setPriorityProcedureOptions([])
    toast.success("Procedimento adicionado à lista de prioridade.")
  }

  function addCidPriority(item: CidCatalogItem) {
    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "cid",
      value: item.code,
      label: `${item.code} - ${item.description}`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => {
      const normalizedValue = normalizeCidCode(item.code)
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.mode === "cid" &&
          normalizeCidCode(entry.value) === normalizedValue,
      )

      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextItem,
          id: next[existingIndex].id,
        }
        return next
      }

      return [...prev, nextItem]
    })

    setPriorityCidQuery("")
    setPriorityExpiresAt("")
    toast.success("CID adicionado à lista de prioridade.")
  }

  function addManualCidPriority() {
    const code = formatCidCode(priorityCidQuery)

    if (!code) {
      toast.error("Informe o CID.")
      return
    }

    const exactMatch = priorityCidOptions.find(
      (item) => normalizeCidCode(item.code) === normalizeCidCode(code),
    )

    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "cid",
      value: code,
      label: exactMatch
        ? `${exactMatch.code} - ${exactMatch.description}`
        : `${code} - CID prioritário`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => {
      const normalizedValue = normalizeCidCode(code)
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.mode === "cid" &&
          normalizeCidCode(entry.value) === normalizedValue,
      )

      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextItem,
          id: next[existingIndex].id,
        }
        return next
      }

      return [...prev, nextItem]
    })

    setPriorityCidQuery("")
    setPriorityExpiresAt("")
    toast.success("CID adicionado à lista de prioridade.")
  }

  function addCombinedPriority() {
    const cid = normalizeCidCode(priorityCombinedCid)
    const procedure = normalizeProcedureCode(priorityCombinedProcedure)
    const specialty = normalizeUpperInput(priorityCombinedSpecialty.trim())
    const subspecialty = normalizeUpperInput(priorityCombinedSubspecialty.trim())

    const filledCriteria = [cid, procedure, specialty, subspecialty].filter(Boolean)

    if (filledCriteria.length < 2) {
      toast.error("Informe pelo menos dois parâmetros para a prioridade combinada.")
      return
    }

    const value = JSON.stringify({
      cid,
      procedure,
      specialty,
      subspecialty,
    })

    const label = [
      cid ? `CID ${cid}` : "",
      procedure ? `SIGTAP ${procedure}` : "",
      specialty,
      subspecialty,
    ].filter(Boolean).join(" + ")

    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "combined",
      value,
      label,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => {
      const existingIndex = prev.findIndex(
        (entry) => entry.mode === "combined" && entry.value === value,
      )

      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextItem,
          id: next[existingIndex].id,
        }
        return next
      }

      return [...prev, nextItem]
    })

    setPriorityCombinedCid("")
    setPriorityCombinedProcedure("")
    setPriorityCombinedSpecialty("")
    setPriorityCombinedSubspecialty("")
    setPriorityExpiresAt("")
    toast.success("Combinação adicionada à lista de prioridade.")
  }

  function removePriorityItem(itemId: string) {
    setFocusItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  async function applyPriorityFocus() {
    if (focusItems.length === 0) {
      toast.error("Adicione pelo menos um procedimento, CID ou combinação antes de aplicar.")
      return
    }

    try {
      setSavingPriorities(true)

      const response = await fetch("/api/admin/judicial/prioridades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipoPrioridade: "monitoramento",
          items: focusItems,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao salvar prioridades.")
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []
      setFocusItems(items)

      judicial.setPriorityFocus({
        mode:
          items.length === 0
            ? "none"
            : focusMode === "none"
              ? (items[items.length - 1]?.mode ?? "procedure")
              : focusMode,
        items,
      })

      toast.success("Lista de prioridades do monitoramento atualizada.")
    } catch (error) {
      console.error("SAVE_PRIORIDADES_ERROR", error)
      toast.error("Erro ao salvar prioridades.")
    } finally {
      setSavingPriorities(false)
    }
  }

  function exportSeizureCsv() {
    const csv = [
      "municipality,total",
      ...seizure.byMunicipality.map(
        (item) =>
          `${csvEscape(item.municipality)},${csvEscape(item.total.toFixed(2))}`,
      ),
    ].join("\n")

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "sequestro-bloqueio-municipios.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Tabs defaultValue="core" className="space-y-4">
      <TabsList className="flex w-full flex-wrap justify-start gap-2 bg-transparent p-0">
        <TabsTrigger value="core">Importações CORE</TabsTrigger>
        <TabsTrigger value="municipios">Municípios</TabsTrigger>
        <TabsTrigger value="emails">E-mails</TabsTrigger>
        <TabsTrigger value="prioridade">Prioridades</TabsTrigger>
        <TabsTrigger value="bloqueio-sequestro">Bloqueio / Sequestro</TabsTrigger>
        <TabsTrigger value="sigtap-cadastro">SIGTAP</TabsTrigger>
        <TabsTrigger value="especialidade-sub">Especialidade / Subespecialidade</TabsTrigger>
      </TabsList>

      <TabsContent value="core" className="mt-0 space-y-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Importações CORE</CardTitle>
            <CardDescription>
              Selecione o tipo de importação e envie o arquivo Excel correspondente.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">Regras de atualização</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong>CORE Ambulatorial Finalizados</strong>: apaga apenas os registros
                  do lote <strong>finalizados</strong> em <strong>core_ambulatorial</strong> e
                  mantém os de <strong>em atendimento</strong>.
                </li>
                <li>
                  <strong>CORE Ambulatorial Em Atendimento</strong>: apaga apenas os registros
                  do lote <strong>em_atendimento</strong> em <strong>core_ambulatorial</strong> e
                  mantém os de <strong>finalizados</strong>.
                </li>
                <li>
                  <strong>CORE Leitos</strong>: apaga todos os dados de <strong>core_leitos</strong> e
                  substitui pelo novo arquivo.
                </li>
              </ul>
            </div>

            <div className="grid gap-3 md:grid-cols-[340px_1fr]">
              <div>
                <Label className="mb-1 block text-xs">Tipo de importação</Label>
                <select
                  value={table}
                  onChange={(e) => setTable(e.target.value as CoreTable)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CORE_TABLES.map((item) => (
                    <option key={item} value={item}>
                      {CORE_TABLE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleImportCore}
                  disabled={uploadingCoreFile || !selectedCoreFile}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingCoreFile ? "Importando..." : "Importar arquivo"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="block text-xs">Arquivo</Label>
              <Input
                ref={coreFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                onChange={(e) => setSelectedCoreFile(e.target.files?.[0] ?? null)}
              />

              {selectedCoreFile ? (
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium text-foreground">{selectedCoreFile.name}</p>
                  <p className="text-muted-foreground">
                    {(selectedCoreFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent
        value="municipios"
        className="mt-0 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastro de contatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={municipalityName}
              onChange={(e) => setMunicipalityName(e.target.value)}
              placeholder="Município"
            />
            <Input
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="e-mail1@..., e-mail2@..."
            />
            <Input
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
              placeholder="(67) 99999-0000, ..."
            />
            <Input
              value={contacts}
              onChange={(e) => setContacts(e.target.value)}
              placeholder="Nome do responsável, outro responsável"
            />
            <Button onClick={handleSaveMunicipality} disabled={savingMunicipality}>
              <Save className="mr-2 h-4 w-4" />
              {savingMunicipality ? "Salvando..." : "Salvar município"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Municípios cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingMunicipalities ? (
              <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                Carregando municípios...
              </div>
            ) : municipalityItems.length === 0 ? (
              <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                Nenhum município cadastrado.
              </div>
            ) : (
              municipalityItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadMunicipality(item.id)}
                  className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">{item.municipalityName}</span>
                    <Badge variant="outline">{item.emails.length} e-mail(s)</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.emails.join(", ") || "sem e-mail"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.contacts.join(", ") || "sem contato"}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent
        value="emails"
        className="mt-0 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Modelo de e-mail</CardTitle>
            <CardDescription>
              Use placeholders como $ficha_core, $cpf, $nome_paciente,
              $numero_processo, $protocolo_judicial, $protocolo_prejudicial,
              $data_agendamento e $user_sistema.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="demanda_judicial_cadastrada">
                Demanda judicial cadastrada
              </option>
              <option value="solicitar_inclusao_ficha">
                Solicitar inclusão de ficha
              </option>
              <option value="reiteracao_municipio">
                Reiteração ao município
              </option>
              <option value="agendamento_informado">
                Agendamento informado
              </option>
              <option value="inercia_municipio">Inércia do município</option>
              <option value="demanda_prejudicial_cadastrada">
                Demanda pré judicial cadastrada
              </option>
              <option value="prazo_prejudicial_vencendo">
                Prazo do pré judicial vencendo
              </option>
              <option value="prazo_prejudicial_vencido">
                Prazo do pré judicial vencido
              </option>
            </select>

            <Input
              value={templateTitle}
              onChange={(e) => setTemplateTitle(e.target.value)}
              placeholder="Título interno"
            />
            <Input
              value={templateSubject}
              onChange={(e) => setTemplateSubject(e.target.value)}
              placeholder="Assunto"
            />

            <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              Placeholders disponíveis: $ficha_core, $cpf, $nome_paciente,
              $numero_processo, $protocolo_judicial, $protocolo_prejudicial,
              $data_agendamento e $user_sistema.
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/10 p-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
                <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Editor
                </span>

                <select
                  value={templateFontFamily}
                  onChange={(e) => handleTemplateFontFamilyChange(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {RICH_FONT_FAMILY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={templateFontSize}
                  onChange={(e) => handleTemplateFontSizeChange(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {RICH_FONT_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}px
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Negrito"
                  onClick={() => runTemplateEditorCommand("bold")}
                >
                  <Bold className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Itálico"
                  onClick={() => runTemplateEditorCommand("italic")}
                >
                  <Italic className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Sublinhado"
                  onClick={() => runTemplateEditorCommand("underline")}
                >
                  <Underline className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Taxado"
                  onClick={() => runTemplateEditorCommand("strikeThrough")}
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Alinhar à esquerda"
                  onClick={() => runTemplateEditorCommand("justifyLeft")}
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Centralizar"
                  onClick={() => runTemplateEditorCommand("justifyCenter")}
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Alinhar à direita"
                  onClick={() => runTemplateEditorCommand("justifyRight")}
                >
                  <AlignRight className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Lista não ordenada"
                  onClick={() => runTemplateEditorCommand("insertUnorderedList")}
                >
                  <List className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Lista ordenada"
                  onClick={() => runTemplateEditorCommand("insertOrderedList")}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="bg-transparent"
                  title="Formato padrão"
                  onClick={() => runTemplateEditorCommand("formatBlock", "<p>")}
                >
                  <Type className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="bg-transparent text-xs"
                  onClick={() => runTemplateEditorCommand("removeFormat")}
                >
                  Limpar formatação
                </Button>
              </div>

              <div
                ref={templateEditorRef}
                contentEditable
                suppressContentEditableWarning
                className="prose prose-sm min-h-[280px] max-w-none rounded-lg border border-input bg-background p-4 text-sm outline-none"
                onInput={(e) =>
                  setTemplateBody((e.target as HTMLDivElement).innerHTML)
                }
                dangerouslySetInnerHTML={{
                  __html: templateBodyToHtml(templateBody),
                }}
              />
            </div>

            <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
              <Mail className="mr-2 h-4 w-4" />
              {savingTemplate ? "Salvando..." : "Salvar modelo"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Modelos cadastrados</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {loadingTemplates ? (
              <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                Carregando modelos...
              </div>
            ) : emailTemplateItems.length === 0 ? (
              <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                Nenhum modelo cadastrado.
              </div>
            ) : (
              emailTemplateItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadTemplate(item.id)}
                  className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="outline">{item.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.subject}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent
        value="sigtap-cadastro"
        className="mt-0 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastro de SIGTAP</CardTitle>
            <CardDescription>
              O SIGTAP é cadastrado apenas com código e descrição.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={sigtapCodigoCadastro}
              onChange={(e) => setSigTapCodigoCadastro(normalizeDigitsOnlyInput(e.target.value))}
              placeholder="Código do SIGTAP"
            />
            <Input
              value={sigtapDescricaoCadastro}
              onChange={(e) => setSigTapDescricaoCadastro(normalizeUpperInput(e.target.value))}
              placeholder="Descrição do SIGTAP"
            />
            <Button onClick={handleSaveSigTapCadastro} disabled={savingSigTapCadastro}>
              <Save className="mr-2 h-4 w-4" />
              {savingSigTapCadastro ? "Salvando..." : "Salvar SIGTAP"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">SIGTAP cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={sigtapBuscaCadastro}
                onChange={(e) => setSigTapBuscaCadastro(e.target.value)}
                placeholder="Buscar SIGTAP por código ou descrição"
              />
              <Button type="button" variant="outline" onClick={fetchSigTapCadastro}>
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
            </div>

            {loadingSigTapCadastro ? (
              <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                Carregando SIGTAP...
              </div>
            ) : sigtapCadastroItems.length === 0 ? (
              <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                Nenhum SIGTAP cadastrado.
              </div>
            ) : (
              sigtapCadastroItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadSigTapCadastro(item)}
                  className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="font-medium">
                    {item.codigo} - {item.descricao}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent
        value="especialidade-sub"
        className="mt-0 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastro conjunto</CardTitle>
            <CardDescription>
              Cadastre a especialidade e a subespecialidade no mesmo salvamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={especialidadeNomeCadastro}
              onChange={(e) => setEspecialidadeNomeCadastro(normalizeUpperInput(e.target.value))}
              placeholder="Especialidade"
            />
            <Input
              value={subespecialidadeNomeCadastro}
              onChange={(e) => setSubespecialidadeNomeCadastro(normalizeUpperInput(e.target.value))}
              placeholder="Subespecialidade"
            />
            <Button onClick={handleSaveEspecialidadeSub} disabled={savingEspecialidadeSub}>
              <Save className="mr-2 h-4 w-4" />
              {savingEspecialidadeSub
                ? "Salvando..."
                : "Salvar especialidade e subespecialidade"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Especialidades cadastradas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingEspecialidadeSub ? (
              <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                Carregando especialidades...
              </div>
            ) : groupedEspecialidades.length === 0 ? (
              <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                Nenhuma especialidade cadastrada.
              </div>
            ) : (
              groupedEspecialidades.map((group) => (
                <div key={group.especialidadeId} className="rounded-xl border border-border p-3">
                  <div className="font-semibold">{group.especialidadeNome}</div>

                  <div className="mt-2 space-y-2">
                    {group.subs.map((sub) => (
                      <button
                        key={sub.subespecialidadeId}
                        type="button"
                        onClick={() => loadEspecialidadeSub(sub)}
                        className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
                      >
                        {sub.subespecialidadeNome}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>      <TabsContent value="prioridade" className="mt-0 space-y-4">
        <JudicialPrioritiesPanelCombined />
      </TabsContent>
<TabsContent value="bloqueio-sequestro" className="mt-0 space-y-4">
        <JudicialBloqueioSequestroPanel />
      </TabsContent>
    </Tabs>
  )
}

