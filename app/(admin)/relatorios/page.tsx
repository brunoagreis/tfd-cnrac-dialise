"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Download,
  ExternalLink,
  FileText,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { hasUserPermission } from "@/lib/access-control"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ReportModule =
  | "todos"
  | "tfd"
  | "cnrac"
  | "hemodialise"
  | "judicial"
  | "pre_judicial"
  | "agendamento"

type ReportRow = {
  id: string
  modulo: Exclude<ReportModule, "todos">
  protocolo: string
  paciente: string
  cpf: string
  municipio: string
  status: string
  processo: string
  pgenet: string
  procedimento: string
  cid: string
  cadastradoEm: string
  ultimoMonitoramento: string
  finalizadoPor: string
  ultimoResponsavel: string
  detalheHref: string
}

type ApiLoadResult = {
  label: string
  ok: boolean
  count: number
  error?: string
}

const MODULE_LABELS: Record<Exclude<ReportModule, "todos">, string> = {
  tfd: "TFD",
  cnrac: "CNRAC",
  hemodialise: "Hemodiálise",
  judicial: "Judicial",
  pre_judicial: "Pré Judicial",
  agendamento: "Agendamento",
}

const MODULE_OPTIONS: Array<{ value: ReportModule; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "tfd", label: "TFD" },
  { value: "cnrac", label: "CNRAC" },
  { value: "hemodialise", label: "Hemodiálise" },
  { value: "judicial", label: "Judicial" },
  { value: "pre_judicial", label: "Pré Judicial" },
  { value: "agendamento", label: "Agendamento" },
]

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeSearch(value: unknown) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function normalizeStatusKey(value: unknown) {
  const normalized = normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  if (!normalized) return "nao_informado"

  if (normalized.includes("pendente")) return "pendente"
  if (normalized.includes("resolvido") || normalized === "resolver") return "resolvido"
  if (normalized.includes("cumprido") || normalized.includes("cumprida")) return "cumprido"
  if (normalized.includes("arquivado") || normalized.includes("arquivada")) return "arquivado"
  if (normalized.includes("obito")) return "obito"
  if (normalized.includes("devolvid")) return "devolvida"
  if (normalized.includes("bloqueio")) return "bloqueio"
  if (normalized.includes("sequestro")) return "sequestro"
  if (normalized.includes("descumpr")) return "descumprimento"
  if (normalized.includes("decisao_judicial") || normalized.includes("decisao_com_prazo")) return "decisao_judicial_com_prazo"
  if (normalized.includes("enviado_agendamento") || normalized.includes("envio_agendamento")) return "enviado_agendamento"
  if (normalized.includes("reservado") || normalized.includes("reserva")) return "reservado"
  if (normalized.includes("agendado") || normalized.includes("agendada")) return "agendado"
  if (normalized.includes("fora_fila")) return "fora_fila"
  if (normalized.includes("finalizado") || normalized.includes("finalizada")) return "resolvido"
  if (normalized.includes("ativo") || normalized.includes("ativa")) return "ativo"

  return normalized
}

function getStatusLabel(value: unknown) {
  const key = normalizeStatusKey(value)

  const labels: Record<string, string> = {
    pendente: "Pendente",
    resolvido: "Resolvido",
    cumprido: "Cumprido",
    arquivado: "Arquivado",
    obito: "Óbito",
    devolvida: "Devolvida",
    bloqueio: "Bloqueio",
    sequestro: "Sequestro",
    descumprimento: "Descumprimento",
    decisao_judicial_com_prazo: "Decisão judicial com prazo",
    enviado_agendamento: "Enviado ao Agendamento",
    reservado: "Reservado",
    agendado: "Agendado",
    fora_fila: "Fora da fila",
    ativo: "Ativo",
    nao_informado: "Não informado",
  }

  if (labels[key]) return labels[key]

  return text(value) || "Não informado"
}

function pick(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key]

    if (Array.isArray(value)) {
      if (value.length > 0) return value
    } else if (text(value)) {
      return value
    }
  }

  return ""
}

function pickText(item: Record<string, unknown>, keys: string[]) {
  return text(pick(item, keys))
}

function pickArrayText(item: Record<string, unknown>, keys: string[]) {
  const value = pick(item, keys)

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return entry

        const obj = asRecord(entry)

        return (
          pickText(obj, ["numero", "number", "processNumber", "pgeNetNumber"]) ||
          text(entry)
        )
      })
      .filter(Boolean)
      .join(" | ")
  }

  return text(value)
}

function joinCodeDescription(code: string, description: string) {
  if (code && description) return `${code} - ${description}`
  if (code) return code
  return description
}

function formatDate(value: unknown) {
  const raw = text(value)

  if (!raw) return ""

  const date = new Date(raw)

  if (Number.isNaN(date.getTime())) return raw

  return date.toLocaleDateString("pt-BR")
}

function formatDateTime(value: unknown) {
  const raw = text(value)

  if (!raw) return ""

  const date = new Date(raw)

  if (Number.isNaN(date.getTime())) return raw

  return date.toLocaleString("pt-BR")
}

function buildProcedure(item: Record<string, unknown>) {
  const code = pickText(item, [
    "procedureCode",
    "procedimentoCodigo",
    "codigoProcedimento",
    "procedimento_codigo",
    "sigtapCode",
    "sigtapCodigo",
    "codigo",
  ])

  const description = pickText(item, [
    "procedureDescription",
    "procedimentoDescricao",
    "descricaoProcedimento",
    "procedimento_descricao",
    "sigtapDescription",
    "sigtapDescricao",
    "description",
    "descricao",
  ])

  return joinCodeDescription(code, description)
}

function buildCid(item: Record<string, unknown>) {
  const code = pickText(item, [
    "cidCode",
    "cidCodigo",
    "codigoCid",
    "cid_codigo",
    "code",
  ])

  const description = pickText(item, [
    "cidDescription",
    "cidDescricao",
    "descricaoCid",
    "cid_descricao",
    "description",
    "descricao",
  ])

  return joinCodeDescription(code, description)
}

function buildDetailHref(module: Exclude<ReportModule, "todos">, item: Record<string, unknown>) {
  const id = pickText(item, ["id", "monitoramentoId", "monitoramento_id", "caseId"])
  const protocolo = pickText(item, ["protocolo", "protocol", "protocolNumber", "originProtocol"])

  if (module === "judicial") return `/judicial/${encodeURIComponent(id || protocolo)}`
  if (module === "pre_judicial") return `/pre-judicial/${encodeURIComponent(id || protocolo)}`
  if (module === "agendamento") {
    return pickText(item, ["detalheHref"]) || `/agendamento-demanda`
  }

  return protocolo ? `/protocolo/${encodeURIComponent(protocolo)}` : ""
}

function normalizeGenericDemand(
  module: Exclude<ReportModule, "todos">,
  raw: unknown,
): ReportRow {
  const item = asRecord(raw)
  const id = pickText(item, ["id", "demandaId", "protocolo", "protocolNumber"])
  const protocol = pickText(item, [
    "protocolo",
    "protocol",
    "protocolNumber",
    "originProtocol",
    "demandaId",
    "id",
  ])

  return {
    id: id || `${module}-${protocol}-${Math.random()}`,
    modulo: module,
    protocolo: protocol || "Não informado",
    paciente: pickText(item, [
      "pacienteNome",
      "patientName",
      "nomePaciente",
      "nome_paciente",
      "paciente",
      "nome",
    ]) || "Paciente não informado",
    cpf: pickText(item, ["cpf", "pacienteCpf", "patientCpf"]),
    municipio: pickText(item, [
      "municipio",
      "municipioNome",
      "municipalityName",
      "municipality",
      "localSolicitado",
    ]) || "Não informado",
    status: pickText(item, [
      "statusLabel",
      "status",
      "statusMonitoramentoAtual",
      "status_monitoramento_atual",
      "statusAgendamentoLabel",
    ]) || "Não informado",
    processo: pickArrayText(item, [
      "processNumbers",
      "processNumber",
      "processo",
      "numeroProcesso",
    ]),
    pgenet: pickArrayText(item, [
      "pgeNetNumbers",
      "pgeNetNumber",
      "pgenet",
      "pgeNet",
    ]),
    procedimento: buildProcedure(item),
    cid: buildCid(item),
    cadastradoEm: formatDate(pick(item, ["createdAt", "criadoEm", "created_at"])),
    ultimoMonitoramento: formatDateTime(
      pick(item, [
        "updatedAt",
        "atualizadoEm",
        "lastMonitoredAt",
        "ultimoMonitoramento",
        "updated_at",
      ]),
    ),
    finalizadoPor:
      pickText(asRecord(item.finalization), ["createdByName", "created_by_name"]) ||
      pickText(item, ["finalizadoPor", "createdByName", "criadoPorNome"]),
    ultimoResponsavel: pickText(item, [
      "ultimoResponsavel",
      "usuarioAtribuidoNome",
      "createdByName",
      "criadoPorNome",
      "updatedByName",
    ]),
    detalheHref: buildDetailHref(module, item),
  }
}

function normalizeAgendamento(raw: unknown): ReportRow {
  const item = asRecord(raw)

  return {
    id: pickText(item, ["id"]) || `agendamento-${Math.random()}`,
    modulo: "agendamento",
    protocolo: pickText(item, ["protocolo", "protocolNumber", "id"]) || "Não informado",
    paciente: pickText(item, ["pacienteNome", "patientName"]) || "Paciente não informado",
    cpf: pickText(item, ["cpf"]),
    municipio: pickText(item, ["municipio", "municipalityName"]) || "Não informado",
    status: pickText(item, ["statusAgendamentoLabel", "statusAgendamento", "statusCaso"]) || "Não informado",
    processo: pickArrayText(item, ["processNumbers", "processNumber"]),
    pgenet: pickArrayText(item, ["pgeNetNumbers", "pgeNetNumber"]),
    procedimento: joinCodeDescription(
      pickText(item, ["procedimentoCodigo", "procedureCode"]),
      pickText(item, ["procedimentoDescricao", "procedureDescription"]),
    ),
    cid: joinCodeDescription(
      pickText(item, ["cidCodigo", "cidCode"]),
      pickText(item, ["cidDescricao", "cidDescription"]),
    ),
    cadastradoEm: formatDate(pick(item, ["solicitadoEm", "createdAt"])),
    ultimoMonitoramento: formatDateTime(pick(item, ["atualizadoEm", "updatedAt"])),
    finalizadoPor: "",
    ultimoResponsavel: "Agendamento da Demanda",
    detalheHref: pickText(item, ["detalheHref"]),
  }
}

async function loadEndpoint(label: string, url: string) {
  const response = await fetch(url, { cache: "no-store" })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Falha ao carregar ${label}.`)
  }

  const items = data?.items ?? data?.demandas ?? data?.rows ?? []

  return Array.isArray(items) ? items : []
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function uniqueSorted(values: string[]) {
  return Array.from(
    new Set(values.map((value) => text(value)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"))
}

function uniqueSortedDesc(values: string[]) {
  return uniqueSorted(values).sort((a, b) => b.localeCompare(a, "pt-BR"))
}

function extractYears(...values: string[]) {
  return values
    .flatMap((value) => text(value).match(/(?:19|20)\d{2}/g) ?? [])
    .filter(Boolean)
}

function splitOptionValues(value: string) {
  return text(value)
    .split(/\s*[|•]\s*/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function statusBadgeVariant(status: string) {
  const normalized = normalizeStatusKey(status)

  if (["resolvido", "cumprido", "agendado", "arquivado"].includes(normalized)) {
    return "default" as const
  }

  if (["descumprimento", "obito", "sequestro", "bloqueio"].includes(normalized)) {
    return "destructive" as const
  }

  return "secondary" as const
}

export default function RelatoriosPage() {
  const { user } = useAuth()

  const canAccessRelatorios = Boolean(
    user && hasUserPermission(user, "RELATORIOS", "visualizar"),
  )

  const [rows, setRows] = useState<ReportRow[]>([])
  const [loadResults, setLoadResults] = useState<ApiLoadResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [moduleFilter, setModuleFilter] = useState<ReportModule>("todos")
  const [statusFilter, setStatusFilter] = useState("")
  const [yearFilter, setYearFilter] = useState("")
  const [processFilter, setProcessFilter] = useState("")
  const [search, setSearch] = useState("")

  const loadReports = useCallback(async () => {
    if (!canAccessRelatorios) {
      setRows([])
      setLoadResults([])
      setLoading(false)
      setError("")
      return
    }

    try {
      setLoading(true)
      setError("")

      const endpoints = [
        { label: "TFD", module: "tfd" as const, url: "/api/tfd/demandas" },
        { label: "CNRAC", module: "cnrac" as const, url: "/api/cnrac/demandas" },
        {
          label: "Hemodiálise",
          module: "hemodialise" as const,
          url: "/api/hemodialise/demandas",
        },
        {
          label: "Judicial",
          module: "judicial" as const,
          url: "/api/judicial/casos?status=todos",
        },
        {
          label: "Pré Judicial",
          module: "pre_judicial" as const,
          url: "/api/pre-judicial/casos?status=todos",
        },
        {
          label: "Agendamento",
          module: "agendamento" as const,
          url: "/api/agendamento-demanda/fila",
        },
      ]

      const settled = await Promise.allSettled(
        endpoints.map(async (endpoint) => {
          const items = await loadEndpoint(endpoint.label, endpoint.url)

          return {
            ...endpoint,
            items,
          }
        }),
      )

      const nextRows: ReportRow[] = []
      const nextResults: ApiLoadResult[] = []

      settled.forEach((result, index) => {
        const endpoint = endpoints[index]

        if (result.status === "fulfilled") {
          const normalized = result.value.items.map((item) =>
            endpoint.module === "agendamento"
              ? normalizeAgendamento(item)
              : normalizeGenericDemand(endpoint.module, item),
          )

          nextRows.push(...normalized)
          nextResults.push({
            label: endpoint.label,
            ok: true,
            count: normalized.length,
          })
        } else {
          nextResults.push({
            label: endpoint.label,
            ok: false,
            count: 0,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : `Falha ao carregar ${endpoint.label}.`,
          })
        }
      })

      setRows(nextRows)
      setLoadResults(nextResults)

      const failed = nextResults.filter((item) => !item.ok)

      if (failed.length > 0) {
        setError(
          `Algumas fontes não carregaram: ${failed
            .map((item) => item.label)
            .join(", ")}.`,
        )
      }
    } catch (err) {
      console.error("[RelatoriosPage] erro ao carregar relatórios:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar relatórios do banco de dados.",
      )
    } finally {
      setLoading(false)
    }
  }, [canAccessRelatorios])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const statusOptions = useMemo(() => {
    const optionMap = new Map<string, string>()

    for (const row of rows) {
      const key = normalizeStatusKey(row.status)

      if (!optionMap.has(key)) {
        optionMap.set(key, getStatusLabel(row.status))
      }
    }

    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
  }, [rows])

  const yearOptions = useMemo(() => {
    return uniqueSortedDesc(
      rows.flatMap((row) =>
        extractYears(row.cadastradoEm, row.ultimoMonitoramento),
      ),
    )
  }, [rows])

  const processSuggestions = useMemo(() => {
    return uniqueSorted(
      rows.flatMap((row) => [
        ...splitOptionValues(row.processo),
        ...splitOptionValues(row.pgenet),
      ]),
    )
  }, [rows])

  const generalSearchSuggestions = useMemo(() => {
    return uniqueSorted(
      rows.flatMap((row) => [
        row.protocolo,
        row.paciente,
        row.cpf,
        row.municipio,
        ...splitOptionValues(row.procedimento),
        ...splitOptionValues(row.cid),
      ]),
    )
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (moduleFilter !== "todos" && row.modulo !== moduleFilter) return false

      if (statusFilter.trim()) {
        if (normalizeStatusKey(row.status) !== statusFilter) {
          return false
        }
      }

      if (yearFilter.trim()) {
        const year = yearFilter.trim()

        if (
          !row.cadastradoEm.includes(year) &&
          !row.ultimoMonitoramento.includes(year)
        ) {
          return false
        }
      }

      if (processFilter.trim()) {
        const hay = normalizeSearch(`${row.processo} ${row.pgenet} ${row.protocolo}`)

        if (!hay.includes(normalizeSearch(processFilter))) return false
      }

      if (search.trim()) {
        const hay = normalizeSearch(
          `${row.protocolo} ${row.paciente} ${row.cpf} ${row.municipio} ${row.procedimento} ${row.cid}`,
        )

        if (!hay.includes(normalizeSearch(search))) return false
      }

      return true
    })
  }, [moduleFilter, processFilter, rows, search, statusFilter, yearFilter])

  const stats = useMemo(() => {
    const count = (module: Exclude<ReportModule, "todos">) =>
      filteredRows.filter((row) => row.modulo === module).length

    const finalized = filteredRows.filter((row) => {
      const status = normalizeStatusKey(row.status)

      return ["resolvido", "cumprido", "agendado", "arquivado", "obito"].includes(status)
    }).length

    const pending = filteredRows.length - finalized

    return {
      total: filteredRows.length,
      pending,
      finalized,
      tfd: count("tfd"),
      cnrac: count("cnrac"),
      hemodialise: count("hemodialise"),
      judicial: count("judicial"),
      preJudicial: count("pre_judicial"),
      agendamento: count("agendamento"),
    }
  }, [filteredRows])

  function handleExportCsv() {
    const header = [
      "Modulo",
      "Protocolo",
      "Paciente",
      "CPF",
      "Municipio",
      "Status",
      "Processo",
      "PGE.net",
      "Procedimento",
      "CID",
      "CadastradoEm",
      "UltimoMonitoramento",
      "FinalizadoPor",
      "UltimoResponsavel",
    ]

    const csvRows = filteredRows.map((row) => [
      MODULE_LABELS[row.modulo],
      row.protocolo,
      row.paciente,
      row.cpf,
      row.municipio,
      getStatusLabel(row.status),
      row.processo,
      row.pgenet,
      row.procedimento,
      row.cid,
      row.cadastradoEm,
      row.ultimoMonitoramento,
      row.finalizadoPor,
      row.ultimoResponsavel,
    ])

    const csv = [
      header.map(escapeCsv).join(";"),
      ...csvRows.map((row) => row.map(escapeCsv).join(";")),
    ].join("\n")

    downloadFile(
      `relatorio-sigajus-${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${csv}`,
      "text/csv;charset=utf-8",
    )
  }

  function handlePrintReportResults() {
    const rowsToPrint = filteredRows

    const filters = [
      moduleFilter !== "todos" ? `Módulo: ${MODULE_LABELS[moduleFilter]}` : "",
      statusFilter ? `Status: ${getStatusLabel(statusFilter)}` : "",
      yearFilter ? `Ano: ${yearFilter}` : "",
      processFilter ? `Processo/PGE.net: ${processFilter}` : "",
      search ? `Busca geral: ${search}` : "",
    ].filter(Boolean)

    const rowsHtml =
      rowsToPrint.length === 0
        ? `<div class="empty">Nenhum registro localizado com os filtros informados.</div>`
        : rowsToPrint
            .map((row) => {
              return `
                <section class="result-card">
                  <div class="badges">
                    <span class="badge">${escapeHtml(MODULE_LABELS[row.modulo])}</span>
                    <span class="badge">${escapeHtml(getStatusLabel(row.status))}</span>
                    <span class="protocol">${escapeHtml(row.protocolo)}</span>
                  </div>

                  <h2>${escapeHtml(row.paciente)}</h2>

                  <div class="muted">
                    <strong>CPF:</strong> ${escapeHtml(row.cpf || "Não informado")}
                    |
                    <strong>Município:</strong> ${escapeHtml(row.municipio || "Não informado")}
                  </div>

                  <div class="grid">
                    <div><span>Processo</span><p>${escapeHtml(row.processo || "-")}</p></div>
                    <div><span>PGE.net</span><p>${escapeHtml(row.pgenet || "-")}</p></div>
                    <div><span>Procedimento</span><p>${escapeHtml(row.procedimento || "-")}</p></div>
                    <div><span>CID</span><p>${escapeHtml(row.cid || "-")}</p></div>
                    <div><span>Cadastrado em</span><p>${escapeHtml(row.cadastradoEm || "-")}</p></div>
                    <div><span>Último monitoramento</span><p>${escapeHtml(row.ultimoMonitoramento || "-")}</p></div>
                    <div><span>Finalizado por</span><p>${escapeHtml(row.finalizadoPor || "-")}</p></div>
                    <div><span>Último responsável</span><p>${escapeHtml(row.ultimoResponsavel || "-")}</p></div>
                  </div>
                </section>
              `
            })
            .join("")

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Resultado do relatório</title>
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
              margin: 0 0 4px 0;
            }

            h2 {
              font-size: 15px;
              margin: 8px 0 4px 0;
            }

            .header {
              border-bottom: 1px solid #ddd;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }

            .muted {
              color: #555;
            }

            .filters {
              margin-top: 6px;
              color: #555;
            }

            .result-card {
              border: 1px solid #ddd;
              border-radius: 10px;
              padding: 10px;
              margin-bottom: 10px;
              break-inside: avoid;
            }

            .badges {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              align-items: center;
            }

            .badge {
              border: 1px solid #ccc;
              border-radius: 999px;
              padding: 2px 8px;
              font-size: 11px;
            }

            .protocol {
              font-family: monospace;
              font-weight: 700;
            }

            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 8px 16px;
              margin-top: 10px;
            }

            .grid span {
              color: #666;
              font-size: 11px;
            }

            .grid p {
              margin: 2px 0 0 0;
            }

            .empty {
              border: 1px dashed #ccc;
              border-radius: 10px;
              padding: 16px;
              text-align: center;
              color: #555;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Resultado do relatório</h1>
            <div class="muted">${rowsToPrint.length} registro(s) localizado(s).</div>
            ${filters.length > 0 ? `<div class="filters"><strong>Filtros:</strong> ${escapeHtml(filters.join(" | "))}</div>` : ""}
          </div>

          ${rowsHtml}

          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `

    const printWindow = window.open("", "_blank", "width=1000,height=700")

    if (!printWindow) {
      window.alert("O navegador bloqueou a janela de impressão.")
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  if (!user) return null

  if (!canAccessRelatorios) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Você não possui permissão para acessar o módulo Relatórios.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
            <p className="text-sm text-muted-foreground">
              Consolidação em tempo real dos módulos vinculados ao banco de dados.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="bg-transparent"
            onClick={loadReports}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>

          <Button
            type="button"
            variant="outline"
            className="bg-transparent"
            onClick={handlePrintReportResults}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>

          <Button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Registros encontrados</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Pendentes / ativos</p>
            <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Finalizados / resolvidos</p>
            <p className="text-3xl font-bold text-emerald-600">{stats.finalized}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Agendamento</p>
            <p className="text-3xl font-bold text-sky-600">{stats.agendamento}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fontes do banco</CardTitle>
          <CardDescription>
            O relatório usa as APIs reais dos módulos já conectados ao PostgreSQL.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-2">
            {loadResults.length === 0 ? (
              <Badge variant="outline">Aguardando carregamento</Badge>
            ) : (
              loadResults.map((item) => (
                <Badge
                  key={item.label}
                  variant={item.ok ? "secondary" : "destructive"}
                  title={item.error || ""}
                >
                  {item.label}: {item.ok ? item.count : "erro"}
                </Badge>
              ))
            )}
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros do relatório</CardTitle>
          <CardDescription>
            Filtre por módulo, status, ano, processo, PGE.net, paciente, município, procedimento ou CID.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_220px_160px_260px_minmax(0,1fr)]">
            <div>
              <Label className="mb-1 block text-xs">Módulo</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value as ReportModule)}
              >
                {MODULE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Todos</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Ano</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
              >
                <option value="">Todos</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Processo / PGE.net</Label>
              <Input
                value={processFilter}
                onChange={(event) => setProcessFilter(event.target.value)}
                placeholder="Número do processo ou PGE.net"
                list="relatorio-processo-pgenet-opcoes"
              />
              <datalist id="relatorio-processo-pgenet-opcoes">
                {processSuggestions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Busca geral</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Paciente, CPF, município, procedimento, CID ou protocolo..."
                  list="relatorio-busca-geral-opcoes"
                />
                <datalist id="relatorio-busca-geral-opcoes">
                  {generalSearchSuggestions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="border-border"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">TFD</p><p className="text-2xl font-bold">{stats.tfd}</p></CardContent></Card>
        <Card className="border-border"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">CNRAC</p><p className="text-2xl font-bold">{stats.cnrac}</p></CardContent></Card>
        <Card className="border-border"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Hemodiálise</p><p className="text-2xl font-bold">{stats.hemodialise}</p></CardContent></Card>
        <Card className="border-border"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Judicial</p><p className="text-2xl font-bold">{stats.judicial}</p></CardContent></Card>
        <Card className="border-border"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pré Judicial</p><p className="text-2xl font-bold">{stats.preJudicial}</p></CardContent></Card>
        <Card className="border-border"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Agendamento</p><p className="text-2xl font-bold">{stats.agendamento}</p></CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resultado do relatório</CardTitle>
          <CardDescription>
            {filteredRows.length} registro(s) localizado(s).
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Carregando relatórios do banco...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhum registro localizado com os filtros informados.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRows.map((row) => (
                <div
                  key={`${row.modulo}-${row.id}-${row.protocolo}`}
                  className="rounded-xl border border-border p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{MODULE_LABELS[row.modulo]}</Badge>
                        <Badge variant={statusBadgeVariant(row.status)}>{getStatusLabel(row.status)}</Badge>
                        <span className="font-mono text-sm font-semibold">{row.protocolo}</span>
                      </div>

                      <p className="text-lg font-bold leading-tight text-foreground">
                        {row.paciente}
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">CPF:</span>{" "}
                        {row.cpf || "Não informado"}
                        {" | "}
                        <span className="font-medium text-foreground">Município:</span>{" "}
                        {row.municipio || "Não informado"}
                      </p>

                      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Processo</p>
                          <p className="text-sm">{row.processo || "-"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">PGE.net</p>
                          <p className="text-sm">{row.pgenet || "-"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Procedimento</p>
                          <p className="text-sm">{row.procedimento || "-"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">CID</p>
                          <p className="text-sm">{row.cid || "-"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Cadastrado em</p>
                          <p className="text-sm">{row.cadastradoEm || "-"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Último monitoramento</p>
                          <p className="text-sm">{row.ultimoMonitoramento || "-"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Finalizado por</p>
                          <p className="text-sm">{row.finalizadoPor || "-"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Último responsável</p>
                          <p className="text-sm">{row.ultimoResponsavel || "-"}</p>
                        </div>
                      </div>
                    </div>

                    {row.detalheHref && (
                      <Button
                        asChild
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-transparent"
                      >
                        <Link href={row.detalheHref}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Abrir origem
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}