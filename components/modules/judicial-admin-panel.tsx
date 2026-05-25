"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlignCenter, AlignLeft, AlignRight, Bold, Download, FileSpreadsheet, Italic, List, ListOrdered, Mail, Save, Settings2, Strikethrough, Type, Underline, Upload } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import { CORE_TABLE_LABELS, CORE_TABLES, type CoreTable, type PriorityFocusItem } from "@/lib/judicial-types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

function csvEscape(value: string | number | undefined) {
  const text = String(value ?? "")
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

type UploadedFileMeta = {
  name: string
  storedName: string
  relativePath: string
  url: string
  size: number
  mimeType: string
  content?: string
}

const EMAIL_TEMPLATE_DEFAULT_HTML = "<p>Prezados,</p><p></p><p>Atenciosamente,</p><p>$user_sistema</p>"
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

function formatProcedureCode(value: string) {
  const digits = normalizeProcedureCode(value).slice(0, 10)
  if (!digits) return ""
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6), digits.slice(6, 9), digits.slice(9, 10)].filter(Boolean)
  if (parts.length <= 3) return parts.join(".")
  const head = parts.slice(0, 3).join(".")
  const tail = parts[3] || ""
  return parts[4] ? `${head}.${tail}-${parts[4]}` : `${head}.${tail}`
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

function isPriorityItemActive(item: PriorityFocusItem) {
  if (!item.expiresAt) return true
  const expiresAt = new Date(`${item.expiresAt}T23:59:59.999`)
  return expiresAt >= new Date()
}

function describePriorityItem(item: PriorityFocusItem) {
  const base = item.mode === "procedure" ? `Procedimento ${item.label}` : `CID ${item.label}`
  return item.expiresAt
    ? `${base} • até ${new Date(`${item.expiresAt}T00:00:00`).toLocaleDateString("pt-BR")}`
    : `${base} • sem prazo final`
}

export function JudicialAdminPanel() {
  const { user } = useAuth()
  const judicial = useJudicial()

  const [table, setTable] = useState<CoreTable>("core_ambulatorial")
  const [csvRaw, setCsvRaw] = useState(
    "fichaNumber,patientName,cpf,appointmentDate,procedureCode,procedureDescription,statusText\nCORE-202600001,Paciente Exemplo,000.000.000-00,2026-03-28,04.01.01.001-2,Consulta em ortopedia,Agendado",
  )
  const [focusMode, setFocusMode] = useState<"none" | "procedure" | "cid">(
    judicial.priorityFocus.mode === "none" ? "procedure" : judicial.priorityFocus.mode,
  )
  const [priorityProcedureQuery, setPriorityProcedureQuery] = useState("")
  const [priorityCidQuery, setPriorityCidQuery] = useState("")
  const [priorityExpiresAt, setPriorityExpiresAt] = useState("")
  const [focusItems, setFocusItems] = useState<PriorityFocusItem[]>(
    judicial.priorityFocus.items ?? [],
  )

  const [editingMunicipalityId, setEditingMunicipalityId] = useState("")
  const [municipalityName, setMunicipalityName] = useState("")
  const [emails, setEmails] = useState("")
  const [phones, setPhones] = useState("")
  const [contacts, setContacts] = useState("")

  const [editingTemplateId, setEditingTemplateId] = useState("")
  const [templateType, setTemplateType] = useState("demanda_judicial_cadastrada")
  const [templateTitle, setTemplateTitle] = useState("")
  const [templateSubject, setTemplateSubject] = useState("")
  const [templateBody, setTemplateBody] = useState(EMAIL_TEMPLATE_DEFAULT_HTML)
  const [templateFontFamily, setTemplateFontFamily] = useState("Arial")
  const [templateFontSize, setTemplateFontSize] = useState("3")
  const templateEditorRef = useRef<HTMLDivElement | null>(null)

  const [selectedCoreFile, setSelectedCoreFile] = useState<File | null>(null)
  const [uploadedCoreFiles, setUploadedCoreFiles] = useState<UploadedFileMeta[]>([])
  const [uploadingCoreFile, setUploadingCoreFile] = useState(false)

  const seizure = judicial.getSeizureSummary()
  const coreStats = useMemo(
    () =>
      CORE_TABLES.map((name) => ({
        table: name,
        total: judicial.coreRows.filter((row) => row.table === name).length,
      })),
    [judicial.coreRows],
  )

  useEffect(() => {
    setFocusItems(judicial.priorityFocus.items ?? [])
  }, [judicial.priorityFocus.items])

  useEffect(() => {
    if (judicial.priorityFocus.mode === "procedure" || judicial.priorityFocus.mode === "cid") {
      setFocusMode(judicial.priorityFocus.mode)
    }
  }, [judicial.priorityFocus.mode])

  const filteredPriorityProcedureOptions = useMemo(() => {
    const query = priorityProcedureQuery.trim()
    const normalizedQuery = normalizeProcedureCode(query)
    return judicial.procedureCatalog
      .filter((item) => {
        if (!query) return true
        const code = normalizeProcedureCode(item.sigtapCode)
        const description = `${item.description} ${item.specialty || ""} ${item.subSpecialty || ""}`.toLowerCase()
        return (!!normalizedQuery && code.includes(normalizedQuery)) || description.includes(query.toLowerCase())
      })
      .slice(0, 8)
  }, [judicial.procedureCatalog, priorityProcedureQuery])

  const filteredPriorityCidOptions = useMemo(() => {
    const query = priorityCidQuery.trim()
    const normalizedQuery = normalizeCidCode(query)
    return judicial.cidCatalog
      .filter((item) => {
        if (!query) return true
        const code = normalizeCidCode(item.code)
        return (!!normalizedQuery && code.includes(normalizedQuery)) || item.description.toLowerCase().includes(query.toLowerCase())
      })
      .slice(0, 8)
  }, [judicial.cidCatalog, priorityCidQuery])

  useEffect(() => {
    const html = templateBodyToHtml(templateBody || EMAIL_TEMPLATE_DEFAULT_HTML)
    if (templateEditorRef.current && templateEditorRef.current.innerHTML !== html) {
      templateEditorRef.current.innerHTML = html
    }
  }, [templateBody])

  function parseCsvRows(raw: string) {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const [header, ...rows] = lines
    if (!header) return []
    const columns = header.split(",").map((col) => col.trim())
    return rows.map((line) => {
      const values = line.split(",")
      const obj: Record<string, string> = {}
      columns.forEach((column, index) => {
        obj[column] = values[index] ?? ""
      })
      return obj
    })
  }

  async function handleUploadCoreFile() {
    if (!selectedCoreFile) {
      toast.error("Selecione um arquivo CSV.")
      return
    }

    try {
      setUploadingCoreFile(true)
      const form = new FormData()
      form.append("area", "core")
      form.append("bucket", table)
      form.append("files", selectedCoreFile)

      const res = await fetch("/api/import-uploads", {
        method: "POST",
        body: form,
      })

      const data = await res.json()
      if (!res.ok || !data?.ok || !data.files?.length) {
        throw new Error(data?.error || "Falha no upload do CSV.")
      }

      const file = data.files[0] as UploadedFileMeta
      setUploadedCoreFiles((prev) => [...prev, file])
      if (file.content) {
        setCsvRaw(file.content)
      }
      setSelectedCoreFile(null)
      toast.success("CSV enviado e carregado no formulário.")
    } catch (error) {
      console.error("CORE_UPLOAD_ERROR", error)
      toast.error("Erro ao enviar CSV.")
    } finally {
      setUploadingCoreFile(false)
    }
  }

  function handleImportCore() {
    const rows = parseCsvRows(csvRaw)
    judicial.importCoreTable(
      table,
      rows.map((row) => ({
        fichaNumber: row.fichaNumber || "",
        patientName: row.patientName || "",
        cpf: row.cpf || "",
        appointmentDate: row.appointmentDate || undefined,
        procedureCode: row.procedureCode || undefined,
        procedureDescription: row.procedureDescription || undefined,
        statusText: row.statusText || "Sem status",
      })),
    )
    judicial.runAutomaticCoreScan(user)
    toast.success(
      `Tabela ${CORE_TABLE_LABELS[table]} importada e rotina automática executada.`,
    )
  }

  function handleSaveMunicipality() {
    if (!municipalityName.trim()) {
      toast.error("Informe o município.")
      return
    }

    judicial.upsertMunicipalityContact({
      id: editingMunicipalityId || `mun_${Math.random().toString(36).slice(2, 9)}`,
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
      updatedAt: new Date().toISOString(),
    })
    toast.success("Contatos do município salvos.")
    setEditingMunicipalityId("")
    setMunicipalityName("")
    setEmails("")
    setPhones("")
    setContacts("")
  }

  function loadMunicipality(id: string) {
    const item = judicial.municipalityContacts.find((m) => m.id === id)
    if (!item) return
    setEditingMunicipalityId(item.id)
    setMunicipalityName(item.municipalityName)
    setEmails(item.emails.join(", "))
    setPhones(item.phones.join(", "))
    setContacts(item.contacts.join(", "))
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

  function handleSaveTemplate() {
    const html = templateEditorRef.current?.innerHTML || templateBody
    if (!templateTitle.trim() || !templateSubject.trim() || !htmlHasContent(html)) {
      toast.error("Título, assunto e corpo são obrigatórios.")
      return
    }
    judicial.upsertEmailTemplate({
      id: editingTemplateId || `tpl_${Math.random().toString(36).slice(2, 9)}`,
      type: templateType as any,
      title: templateTitle,
      subject: templateSubject,
      body: html,
      updatedAt: new Date().toISOString(),
    })
    toast.success("Modelo de e-mail salvo.")
    setEditingTemplateId("")
    setTemplateTitle("")
    setTemplateSubject("")
    setTemplateBody(EMAIL_TEMPLATE_DEFAULT_HTML)
    if (templateEditorRef.current) {
      templateEditorRef.current.innerHTML = EMAIL_TEMPLATE_DEFAULT_HTML
    }
  }

  function loadTemplate(id: string) {
    const item = judicial.emailTemplates.find((m) => m.id === id)
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

  function addProcedurePriority(item: (typeof judicial.procedureCatalog)[number]) {
    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "procedure",
      value: item.sigtapCode,
      label: `${item.sigtapCode} - ${item.description}`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => {
      const normalizedValue = normalizeProcedureCode(item.sigtapCode)
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.mode === "procedure" &&
          normalizeProcedureCode(entry.value) === normalizedValue,
      )
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...next[existingIndex], ...nextItem, id: next[existingIndex].id }
        return next
      }
      return [...prev, nextItem]
    })

    setPriorityProcedureQuery("")
    setPriorityExpiresAt("")
    toast.success("Procedimento adicionado à lista de prioridade.")
  }

  function addCidPriority(item: (typeof judicial.cidCatalog)[number]) {
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
        (entry) => entry.mode === "cid" && normalizeCidCode(entry.value) === normalizedValue,
      )
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...next[existingIndex], ...nextItem, id: next[existingIndex].id }
        return next
      }
      return [...prev, nextItem]
    })

    setPriorityCidQuery("")
    setPriorityExpiresAt("")
    toast.success("CID adicionado à lista de prioridade.")
  }

  function removePriorityItem(itemId: string) {
    setFocusItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  function applyPriorityFocus() {
    judicial.setPriorityFocus({
      mode:
        focusItems.length === 0
          ? "none"
          : focusMode === "none"
            ? (focusItems[focusItems.length - 1]?.mode ?? "procedure")
            : focusMode,
      items: focusItems,
    })
    toast.success("Lista de prioridades do monitoramento atualizada.")
  }

  function exportSeizureCsv() {
    const csv = [
      "municipality,total",
      ...seizure.byMunicipality.map(
        (item) => `${csvEscape(item.municipality)},${csvEscape(item.total.toFixed(2))}`,
      ),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
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
        <TabsTrigger value="prioridade">Prioridade / relatórios</TabsTrigger>
      </TabsList>

      <TabsContent value="core" className="mt-0 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {coreStats.map((item) => (
            <Card key={item.table} className="border-border">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{CORE_TABLE_LABELS[item.table]}</p>
                <p className="text-2xl font-bold">{item.total}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upload de CSV</CardTitle>
            <CardDescription>
              Ao importar, a tabela selecionada é substituída e a varredura automática CORE é disparada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[260px_1fr]">
              <div>
                <Label className="mb-1 block text-xs">Tabela</Label>
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
              <div className="flex items-end gap-2">
                <Button onClick={handleImportCore}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Importar tabela
                </Button>
                <Button
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => judicial.runAutomaticCoreScan(user)}
                >
                  <Settings2 className="mr-2 h-4 w-4" /> Rodar varredura manual
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setSelectedCoreFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                disabled={uploadingCoreFile}
                onClick={handleUploadCoreFile}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadingCoreFile ? "Enviando..." : "Enviar CSV"}
              </Button>
              {uploadedCoreFiles.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {uploadedCoreFiles.map((file) => (
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

            <Textarea rows={10} value={csvRaw} onChange={(e) => setCsvRaw(e.target.value)} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="municipios" className="mt-0 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastro de contatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={municipalityName} onChange={(e) => setMunicipalityName(e.target.value)} placeholder="Município" />
            <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="e-mail1@..., e-mail2@..." />
            <Input value={phones} onChange={(e) => setPhones(e.target.value)} placeholder="(67) 99999-0000, ..." />
            <Input value={contacts} onChange={(e) => setContacts(e.target.value)} placeholder="Nome do responsável, outro responsável" />
            <Button onClick={handleSaveMunicipality}>
              <Save className="mr-2 h-4 w-4" /> Salvar município
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Municípios cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {judicial.municipalityContacts.map((item) => (
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
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="emails" className="mt-0 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Modelo de e-mail</CardTitle>
            <CardDescription>
              Use placeholders como $ficha_core, $cpf, $nome_paciente, $numero_processo, $protocolo_judicial, $protocolo_prejudicial, $data_agendamento e $user_sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="demanda_judicial_cadastrada">Demanda judicial cadastrada</option>
              <option value="solicitar_inclusao_ficha">Solicitar inclusão de ficha</option>
              <option value="reiteracao_municipio">Reiteração ao município</option>
              <option value="agendamento_informado">Agendamento informado</option>
              <option value="inercia_municipio">Inércia do município</option>
              <option value="demanda_prejudicial_cadastrada">Demanda pré judicial cadastrada</option>
              <option value="prazo_prejudicial_vencendo">Prazo do pré judicial vencendo</option>
              <option value="prazo_prejudicial_vencido">Prazo do pré judicial vencido</option>
            </select>
            <Input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} placeholder="Título interno" />
            <Input value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} placeholder="Assunto" />

            <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              Placeholders disponíveis: $ficha_core, $cpf, $nome_paciente, $numero_processo, $protocolo_judicial, $protocolo_prejudicial, $data_agendamento e $user_sistema.
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
                onInput={(e) => setTemplateBody((e.target as HTMLDivElement).innerHTML)}
                dangerouslySetInnerHTML={{ __html: templateBodyToHtml(templateBody) }}
              />
            </div>

            <Button onClick={handleSaveTemplate}>
              <Mail className="mr-2 h-4 w-4" /> Salvar modelo
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Modelos cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {judicial.emailTemplates.map((item) => (
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
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="prioridade" className="mt-0 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prioridades do monitoramento</CardTitle>
            <CardDescription>
              Adicione múltiplos procedimentos e CIDs com vigência. O destaque sai automaticamente da fila quando o prazo expira ou quando o item é removido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs">Tipo de prioridade</Label>
              <select
                value={focusMode}
                onChange={(e) => setFocusMode(e.target.value as "none" | "procedure" | "cid")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="procedure">Priorizar por procedimento</option>
                <option value="cid">Priorizar por CID</option>
                <option value="none">Somente visualizar lista</option>
              </select>
            </div>

            {focusMode === "procedure" && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <div>
                  <Label className="mb-1 block text-xs">Procedimento SIGTAP</Label>
                  <Input
                    value={priorityProcedureQuery}
                    onChange={(e) => setPriorityProcedureQuery(formatProcedureCode(e.target.value))}
                    placeholder="00.00.00.000-0"
                  />
                  {priorityProcedureQuery.trim() && (
                    <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-background p-1">
                      {filteredPriorityProcedureOptions.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum procedimento localizado.</p>
                      ) : (
                        filteredPriorityProcedureOptions.map((item) => (
                          <button
                            key={`${item.sigtapCode}-${item.description}`}
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => addProcedurePriority(item)}
                          >
                            <span className="font-medium">{item.sigtapCode}</span> - {item.description}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Vigente até</Label>
                  <Input
                    type="date"
                    value={priorityExpiresAt}
                    onChange={(e) => setPriorityExpiresAt(e.target.value)}
                  />
                </div>
              </div>
            )}

            {focusMode === "cid" && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <div>
                  <Label className="mb-1 block text-xs">CID</Label>
                  <Input
                    value={priorityCidQuery}
                    onChange={(e) => setPriorityCidQuery(formatCidCode(e.target.value))}
                    placeholder="A00.0"
                  />
                  {priorityCidQuery.trim() && (
                    <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-background p-1">
                      {filteredPriorityCidOptions.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum CID localizado.</p>
                      ) : (
                        filteredPriorityCidOptions.map((item) => (
                          <button
                            key={`${item.code}-${item.description}`}
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => addCidPriority(item)}
                          >
                            <span className="font-medium">{item.code}</span> - {item.description}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Vigente até</Label>
                  <Input
                    type="date"
                    value={priorityExpiresAt}
                    onChange={(e) => setPriorityExpiresAt(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Itens priorizados</Label>
                <Badge variant="outline">{focusItems.length}</Badge>
              </div>
              {focusItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum procedimento ou CID incluído na lista.</p>
              ) : (
                focusItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={item.mode === "procedure" ? "default" : "secondary"}>
                          {item.mode === "procedure" ? "Procedimento" : "CID"}
                        </Badge>
                        {!isPriorityItemActive(item) && <Badge variant="destructive">Expirado</Badge>}
                      </div>
                      <p className="mt-2 text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{describePriorityItem(item)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-transparent"
                      onClick={() => removePriorityItem(item.id)}
                    >
                      Remover
                    </Button>
                  </div>
                ))
              )}
            </div>

            <Button onClick={applyPriorityFocus}>
              <Settings2 className="mr-2 h-4 w-4" /> Aplicar prioridades
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bloqueio / sequestro</CardTitle>
            <CardDescription>Relatório fake para impressão/exportação futura.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total bloqueado do estado</p>
              <p className="text-2xl font-bold">R$ {seizure.totalState.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              {seizure.byMunicipality.map((item) => (
                <div key={item.municipality} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm font-medium">{item.municipality}</span>
                  <span className="text-sm">R$ {item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" className="bg-transparent" onClick={exportSeizureCsv}>
              <Download className="mr-2 h-4 w-4" /> Exportar Excel/CSV
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
