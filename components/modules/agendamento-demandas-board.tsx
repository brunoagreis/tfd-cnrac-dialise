"use client"

import React, { useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  Eye,
  FileUp,
  Search,
  Upload,
  X,
  Paperclip,
  FileText,
  Send,
  Download,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  canImportSchedulingAgenda,
  canManifestSchedulingItem,
} from "@/lib/judicial-access"

type SchedulingStatus = "Pendente" | "Reservado" | "Agendado" | "Devolvido"

type SchedulingModuleType = "Judicial" | "Pré Judicial"

type QueueItem = {
  id: string
  patientName: string
  protocol: string
  city: string
  procedure: string
  moduleType: SchedulingModuleType
  status: SchedulingStatus
  createdAt: string
  reservedSinceDays?: number
}

type ImportedOffer = {
  specialty: string
  subSpecialty: string
  procedureCode: string
  procedureDescription: string
  cidCode: string
  date: string
  seats: number
}

type ManifestationResult = "Agendado" | "Reservado" | "Devolvido"

type ManifestationForm = {
  result: ManifestationResult
  scheduledDate: string
  description: string
  attachments: File[]
}

const INITIAL_QUEUE: QueueItem[] = [
  {
    id: "1",
    patientName: "Carlos Eduardo Mendes",
    protocol: "0800.2026.000007",
    city: "Itacoatiara",
    procedure: "Renovacao de APAC",
    moduleType: "Judicial",
    status: "Pendente",
    createdAt: "2026-03-20",
  },
  {
    id: "2",
    patientName: "Maria Aparecida Lima",
    protocol: "0800.2026.000003",
    city: "Manaus",
    procedure: "Substituicao Total de Quadril",
    moduleType: "Judicial",
    status: "Reservado",
    createdAt: "2026-03-10",
    reservedSinceDays: 12,
  },
  {
    id: "3",
    patientName: "Carlos Eduardo Mendes",
    protocol: "PREJ-202600004",
    city: "Itacoatiara",
    procedure: "Renovacao de APAC",
    moduleType: "Pré Judicial",
    status: "Pendente",
    createdAt: "2026-03-23",
  },
]

const CSV_EXAMPLE = `specialty,subSpecialty,procedureCode,procedureDescription,cidCode,date,seats
Cardiologia,,04.01.01.002-0,Consulta em cardiologia,I50,2026-03-30,5`

function formatDateToBR(value?: string) {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("pt-BR")
}

function downloadTextFile(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function parseAgendaCsv(csv: string): ImportedOffer[] {
  const normalized = csv.trim()
  if (!normalized) return []

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((item) => item.trim())
  const rows = lines.slice(1)

  return rows.map((line) => {
    const cols = line.split(",").map((item) => item.trim())
    const record = Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""]))

    return {
      specialty: record.specialty ?? "",
      subSpecialty: record.subSpecialty ?? "",
      procedureCode: record.procedureCode ?? "",
      procedureDescription: record.procedureDescription ?? "",
      cidCode: record.cidCode ?? "",
      date: record.date ?? "",
      seats: Number(record.seats ?? 0),
    }
  })
}

function Modal({
  title,
  description,
  open,
  onClose,
  children,
}: {
  title: string
  description?: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function StatusBadge({ value }: { value: SchedulingStatus | SchedulingModuleType }) {
  const styles: Record<string, string> = {
    Judicial: "bg-sky-50 text-sky-700 border-sky-200",
    "Pré Judicial": "bg-violet-50 text-violet-700 border-violet-200",
    Pendente: "bg-amber-50 text-amber-700 border-amber-200",
    Reservado: "bg-orange-50 text-orange-700 border-orange-200",
    Agendado: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Devolvido: "bg-rose-50 text-rose-700 border-rose-200",
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[value]}`}>
      {value}
    </span>
  )
}

function SummaryCard({
  title,
  value,
  valueClassName,
}: {
  title: string
  value: number
  valueClassName?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-2 text-4xl font-semibold tracking-tight text-slate-900 ${valueClassName ?? ""}`}>{value}</p>
    </div>
  )
}

export function AgendamentoDemandasBoard() {
  const { user } = useAuth()

  const canManifest = canManifestSchedulingItem(user)
  const canImportAgenda = canImportSchedulingAgenda(user)

  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE)
  const [search, setSearch] = useState("")
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)
  const [manifestationOpen, setManifestationOpen] = useState(false)
  const [importAgendaOpen, setImportAgendaOpen] = useState(false)

  const [manifestationForm, setManifestationForm] = useState<ManifestationForm>({
    result: "Agendado",
    scheduledDate: "",
    description: "",
    attachments: [],
  })

  const [csvContent, setCsvContent] = useState(CSV_EXAMPLE)
  const [csvFilename, setCsvFilename] = useState("")
  const csvFileInputRef = useRef<HTMLInputElement | null>(null)
  const manifestationFileInputRef = useRef<HTMLInputElement | null>(null)

  const [importedOffers, setImportedOffers] = useState<ImportedOffer[]>([
    {
      specialty: "Cardiologia",
      subSpecialty: "",
      procedureCode: "04.01.01.002-0",
      procedureDescription: "Consulta em cardiologia",
      cidCode: "I50",
      date: "2026-03-30",
      seats: 5,
    },
    {
      specialty: "Ortopedia",
      subSpecialty: "Quadril",
      procedureCode: "04.08.05.017-0",
      procedureDescription: "Consulta ortopédica",
      cidCode: "M16",
      date: "2026-03-29",
      seats: 8,
    },
  ])

  const filteredQueue = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return queue

    return queue.filter((item) => {
      return [
        item.patientName,
        item.protocol,
        item.city,
        item.procedure,
        item.moduleType,
        item.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    })
  }, [queue, search])

  const stats = useMemo(() => {
    return {
      totalQueue: queue.length,
      pending10Days: queue.filter((item) => item.status === "Pendente").length,
      reserved10Days: queue.filter((item) => (item.reservedSinceDays ?? 0) >= 10).length,
      importedOffers: importedOffers.length,
    }
  }, [queue, importedOffers])

  function openManifestation(item: QueueItem) {
    if (!canManifest) return

    setSelectedItem(item)
    setManifestationForm({
      result: item.status === "Reservado" ? "Reservado" : "Agendado",
      scheduledDate: "",
      description: "",
      attachments: [],
    })
    setManifestationOpen(true)
  }

  function closeManifestation() {
    setManifestationOpen(false)
    setSelectedItem(null)
    setManifestationForm({
      result: "Agendado",
      scheduledDate: "",
      description: "",
      attachments: [],
    })
  }

  function handleManifestationFiles(files: FileList | null) {
    setManifestationForm((prev) => ({
      ...prev,
      attachments: files ? Array.from(files) : [],
    }))
  }

  function handleRegisterManifestation() {
    if (!selectedItem) return
    if (!manifestationForm.description.trim()) {
      window.alert("Informe a descrição da manifestação.")
      return
    }
    if (manifestationForm.result === "Agendado" && !manifestationForm.scheduledDate) {
      window.alert("Informe a data do agendamento.")
      return
    }

    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== selectedItem.id) return item
        return {
          ...item,
          status:
            manifestationForm.result === "Agendado"
              ? "Agendado"
              : manifestationForm.result === "Reservado"
                ? "Reservado"
                : "Devolvido",
          reservedSinceDays:
            manifestationForm.result === "Reservado" ? 0 : item.reservedSinceDays,
        }
      }),
    )

    closeManifestation()
    window.alert("Manifestação registrada com sucesso no ambiente fake.")
  }

  async function handleReadCsvFile(file: File) {
    const text = await file.text()
    setCsvFilename(file.name)
    setCsvContent(text)
  }

  function handleImportAgenda() {
    if (!canImportAgenda) return

    const parsed = parseAgendaCsv(csvContent)
    if (!parsed.length) {
      window.alert("Nenhum registro válido encontrado para importação.")
      return
    }

    setImportedOffers((prev) => [...parsed, ...prev])
    setImportAgendaOpen(false)
    window.alert("Agenda importada com sucesso no ambiente fake.")
  }

  function handleExportQueueCsv() {
    const header = "paciente,protocolo,municipio,procedimento,modulo,situacao,data_criacao"
    const rows = filteredQueue.map((item) =>
      [
        item.patientName,
        item.protocol,
        item.city,
        item.procedure,
        item.moduleType,
        item.status,
        item.createdAt,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    )

    downloadTextFile("fila-agendamento.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8")
  }

  function handleExportOffersCsv() {
    const header = "specialty,subSpecialty,procedureCode,procedureDescription,cidCode,date,seats"
    const rows = importedOffers.map((item) =>
      [
        item.specialty,
        item.subSpecialty,
        item.procedureCode,
        item.procedureDescription,
        item.cidCode,
        item.date,
        String(item.seats),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    )

    downloadTextFile("ofertas-importadas.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Fila do Agendamento" value={stats.totalQueue} />
        <SummaryCard title="Pendentes ≥ 10 dias" value={stats.pending10Days} valueClassName="text-rose-600" />
        <SummaryCard title="Reservas ≥ 10 dias" value={stats.reserved10Days} valueClassName="text-amber-600" />
        <SummaryCard title="Ofertas importadas" value={stats.importedOffers} valueClassName="text-sky-600" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Fila ativa do agendamento</h2>
              <p className="mt-1 text-sm text-slate-500">
                O setor recebe casos vindos do Judicial e do Pré Judicial.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canImportAgenda ? (
                <button
                  type="button"
                  onClick={() => setImportAgendaOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <FileUp className="h-4 w-4" />
                  IMPORTAR AGENDA
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleExportQueueCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por paciente, município, procedimento ou módulo..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-sky-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredQueue.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{item.patientName}</h3>
                      <StatusBadge value={item.moduleType} />
                      <StatusBadge value={item.status} />
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.protocol} • {item.city}
                    </p>

                    <p className="mt-2 text-sm text-slate-700">{item.procedure}</p>
                  </div>

                  {canManifest ? (
                    <button
                      type="button"
                      onClick={() => openManifestation(item)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                      title="Abrir manifestação do setor"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}

            {!filteredQueue.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Nenhuma demanda encontrada para o filtro informado.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 p-3 text-sky-700">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Resumo do setor</h2>
              <p className="text-sm text-slate-500">Visão rápida do ambiente fake.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Acesso à manifestação</p>
              <p className="mt-2 text-sm text-slate-700">
                {canManifest
                  ? "Perfil com permissão para manifestar pelo botão de olho na fila."
                  : "Perfil sem permissão para abrir manifestação do setor."}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Importação de agenda</p>
              <p className="mt-2 text-sm text-slate-700">
                {canImportAgenda
                  ? "Perfil com permissão para importar agenda pelo botão do cabeçalho."
                  : "Perfil sem permissão para importar agenda."}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ofertas já importadas</p>
              <div className="mt-3 space-y-3">
                {importedOffers.slice(0, 4).map((offer, index) => (
                  <div key={`${offer.procedureCode}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-medium text-slate-900">{offer.specialty || "Especialidade não informada"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {offer.procedureDescription} • {formatDateToBR(offer.date)} • {offer.seats} vagas
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExportOffersCsv}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Exportar fila
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="Manifestação do setor"
        description="Agendar, reservar ou devolver a demanda ao fluxo de origem."
        open={manifestationOpen}
        onClose={closeManifestation}
      >
        {selectedItem ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-slate-900">{selectedItem.patientName}</p>
                <StatusBadge value={selectedItem.moduleType} />
                <StatusBadge value={selectedItem.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {selectedItem.protocol} • {selectedItem.city}
              </p>
              <p className="mt-2 text-sm text-slate-700">{selectedItem.procedure}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Resultado</label>
                <select
                  value={manifestationForm.result}
                  onChange={(event) =>
                    setManifestationForm((prev) => ({
                      ...prev,
                      result: event.target.value as ManifestationResult,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-500"
                >
                  <option value="Agendado">Agendado</option>
                  <option value="Reservado">Reservado</option>
                  <option value="Devolvido">Devolvido</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data do agendamento</label>
                <input
                  type="date"
                  value={manifestationForm.scheduledDate}
                  disabled={manifestationForm.result !== "Agendado"}
                  onChange={(event) =>
                    setManifestationForm((prev) => ({
                      ...prev,
                      scheduledDate: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-sky-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Descrição obrigatória</label>
              <textarea
                value={manifestationForm.description}
                onChange={(event) =>
                  setManifestationForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Explique a manifestação do setor..."
                rows={5}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-sky-500"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700">Documentos da manifestação</label>

              <input
                ref={manifestationFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => handleManifestationFiles(event.target.files)}
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => manifestationFileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Paperclip className="h-4 w-4" />
                  Escolher arquivos
                </button>

                <span className="text-sm text-slate-500">
                  {manifestationForm.attachments.length
                    ? `${manifestationForm.attachments.length} arquivo(s) selecionado(s)`
                    : "Nenhum arquivo selecionado"}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {manifestationForm.attachments.length ? (
                  <div className="space-y-2">
                    {manifestationForm.attachments.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm text-slate-700">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{file.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Arquivos enviados</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRegisterManifestation}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800"
              >
                <Send className="h-4 w-4" />
                Registrar manifestação
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Importar agenda"
        description="Faça upload do CSV da agenda do dia e depois importe no ambiente fake."
        open={importAgendaOpen}
        onClose={() => setImportAgendaOpen(false)}
      >
        <div className="space-y-5">
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              await handleReadCsvFile(file)
            }}
          />

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">Arquivo CSV</label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => csvFileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                Escolher arquivo
              </button>

              <span className="text-sm text-slate-500">
                {csvFilename || "Nenhum arquivo escolhido"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Conteúdo do CSV</label>
            <textarea
              value={csvContent}
              onChange={(event) => setCsvContent(event.target.value)}
              rows={9}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-sm outline-none transition focus:border-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleImportAgenda}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <FileUp className="h-4 w-4" />
              Importar agenda
            </button>

            <button
              type="button"
              onClick={() => downloadTextFile("modelo-importacao-agenda.csv", CSV_EXAMPLE, "text/csv;charset=utf-8")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Baixar modelo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}