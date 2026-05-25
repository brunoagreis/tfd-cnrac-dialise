"use client"

import { useMemo, useState } from "react"
import { FileSpreadsheet, FileText, Printer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import { usePreJudicial } from "@/lib/pre-judicial-context"
import { usePermissions } from "@/lib/permissions"
import { useStore } from "@/lib/store-context"
import type { AccessModule } from "@/lib/types"

type ReportModule =
  | "todos"
  | "judicial"
  | "pre_judicial"
  | "hemodialise"
  | "cnrac"
  | "tfd"
  | "agendamento"

type ReportRow = {
  modulo: Exclude<ReportModule, "todos">
  protocolo: string
  paciente: string
  municipio: string
  procedimento: string
  status: string
  processo: string
  pgenet: string
  cadastradoEm: string
  ultimoMonitoramento: string
  finalizadoPor: string
  ultimoResponsavel: string
}

const MODULE_LABELS: Record<Exclude<ReportModule, "todos">, string> = {
  judicial: "Judicial",
  pre_judicial: "Pré Judicial",
  hemodialise: "Hemodiálise",
  cnrac: "CNRAC",
  tfd: "TFD",
  agendamento: "Agendamento",
}

function formatDate(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR")
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

function toCsv(rows: ReportRow[]) {
  const headers = [
    "Modulo",
    "Protocolo",
    "Paciente",
    "Municipio",
    "Procedimento",
    "Status",
    "Processo",
    "PGE.net",
    "CadastradoEm",
    "UltimoMonitoramento",
    "FinalizadoPor",
    "UltimoResponsavel",
  ]

  const escape = (value: string) => `"${String(value ?? "").replaceAll('"', '""')}"`
  const lines = [headers.map(escape).join(";")]

  rows.forEach((row) => {
    lines.push(
      [
        MODULE_LABELS[row.modulo],
        row.protocolo,
        row.paciente,
        row.municipio,
        row.procedimento,
        row.status,
        row.processo,
        row.pgenet,
        row.cadastradoEm,
        row.ultimoMonitoramento,
        row.finalizadoPor,
        row.ultimoResponsavel,
      ]
        .map(escape)
        .join(";"),
    )
  })

  return `\ufeff${lines.join("\n")}`
}

export default function RelatoriosPage() {
  const { user } = useAuth()
  const store = useStore()
  const judicial = useJudicial()
  const pre = usePreJudicial()
  const { canAccessArea } = usePermissions()

  const [moduleFilter, setModuleFilter] = useState<ReportModule>("todos")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [municipioFilter, setMunicipioFilter] = useState("")
  const [processFilter, setProcessFilter] = useState("")
  const [yearFilter, setYearFilter] = useState("")

  if (!user) return null

  const canAccessReports = user.role === "ADMIN"

  if (!canAccessReports) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Sem permissão para acessar Relatórios.
      </div>
    )
  }

  const demandRows = useMemo<ReportRow[]>(() => {
    const byPaciente = new Map(store.pacientes.map((item) => [item.id, item]))

    return store.demandas.map((item) => {
      const paciente = byPaciente.get(item.pacienteId)
      const ultimaInteracao = item.interacoes[item.interacoes.length - 1]

      return {
        modulo: item.modulo,
        protocolo: item.protocolo,
        paciente: paciente?.nome || item.pacienteId,
        municipio: paciente?.municipio || "",
        procedimento: `${item.codigoSigtap} - ${item.descricaoSigtap}`,
        status: item.status,
        processo: item.acaoJudicial ? "Demanda judicializada" : "",
        pgenet: "",
        cadastradoEm: formatDate(item.criadoEm),
        ultimoMonitoramento: formatDate(item.atualizadoEm),
        finalizadoPor:
          item.status === "pendente"
            ? ""
            : ultimaInteracao?.criadoPorNome || item.criadoPorNome,
        ultimoResponsavel: ultimaInteracao?.criadoPorNome || item.criadoPorNome,
      }
    })
  }, [store.demandas, store.pacientes])

  const judicialRows = useMemo<ReportRow[]>(() => {
    return judicial.cases.map((item) => {
      const latestMovement = item.movements[item.movements.length - 1]
      const latestStatus =
        item.processStatusHistory?.[item.processStatusHistory.length - 1]

      return {
        modulo: "judicial",
        protocolo: item.originProtocol,
        paciente: item.patientName,
        municipio: item.municipalityName,
        procedimento: item.procedures.map((proc) => proc.sigtapCode).join(" | "),
        status: item.finalization
          ? item.finalization.status
          : latestStatus
            ? latestStatus.status
            : item.status,
        processo: item.processNumbers?.join(" | ") || item.processNumber || "",
        pgenet: item.registration?.pgeNetNumber || "",
        cadastradoEm: formatDate(item.createdAt),
        ultimoMonitoramento: formatDate(
          item.lastMonitoredAt || latestMovement?.createdAt,
        ),
        finalizadoPor: item.finalization?.createdByName || "",
        ultimoResponsavel:
          latestMovement?.createdByName || item.registration?.createdByName || "",
      }
    })
  }, [judicial.cases])

  const preRows = useMemo<ReportRow[]>(() => {
    return pre.cases.map((item) => {
      const latestMovement = item.movements[item.movements.length - 1]

      return {
        modulo: "pre_judicial",
        protocolo: item.protocolNumber,
        paciente: item.patientName,
        municipio: item.municipalityName,
        procedimento: item.procedures.map((proc) => proc.sigtapCode).join(" | "),
        status: item.finalization ? item.finalization.status : item.status,
        processo: "",
        pgenet: "",
        cadastradoEm: formatDate(item.createdAt),
        ultimoMonitoramento: formatDate(item.updatedAt),
        finalizadoPor: item.finalization?.createdByName || "",
        ultimoResponsavel: latestMovement?.createdByName || item.createdByName,
      }
    })
  }, [pre.cases])

  const schedulingRows = useMemo<ReportRow[]>(() => {
    return pre.cases
      .filter((item) => item.schedulingStatus !== "fora_fila")
      .map((item) => ({
        modulo: "agendamento",
        protocolo: item.protocolNumber,
        paciente: item.patientName,
        municipio: item.municipalityName,
        procedimento: item.procedures.map((proc) => proc.sigtapCode).join(" | "),
        status: item.schedulingStatus,
        processo: "",
        pgenet: "",
        cadastradoEm: formatDate(item.createdAt),
        ultimoMonitoramento: formatDate(item.updatedAt),
        finalizadoPor: "",
        ultimoResponsavel:
          item.movements[item.movements.length - 1]?.createdByName ||
          item.createdByName,
      }))
  }, [pre.cases])

  const allRows = useMemo(
    () => [...demandRows, ...judicialRows, ...preRows, ...schedulingRows],
    [demandRows, judicialRows, preRows, schedulingRows],
  )

  const availableModules = useMemo(() => {
    const base: ReportModule[] = ["todos"]

    ;(
      ["judicial", "pre_judicial", "hemodialise", "cnrac", "tfd", "agendamento"] as AccessModule[]
    ).forEach((item) => {
      if (user && canAccessArea(user.role, item)) {
        base.push(item as ReportModule)
      }
    })

    return base
  }, [canAccessArea, user])

  const rows = useMemo(() => {
    return allRows.filter((row) => {
      if (moduleFilter !== "todos" && row.modulo !== moduleFilter) return false

      if (search) {
        const hay =
          `${row.protocolo} ${row.paciente} ${row.procedimento} ${row.pgenet}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }

      if (
        statusFilter &&
        !row.status.toLowerCase().includes(statusFilter.toLowerCase())
      ) {
        return false
      }

      if (
        municipioFilter &&
        !row.municipio.toLowerCase().includes(municipioFilter.toLowerCase())
      ) {
        return false
      }

      if (
        processFilter &&
        !`${row.processo} ${row.pgenet}`
          .toLowerCase()
          .includes(processFilter.toLowerCase())
      ) {
        return false
      }

      if (
        yearFilter &&
        !row.cadastradoEm.includes(yearFilter) &&
        !row.ultimoMonitoramento.includes(yearFilter)
      ) {
        return false
      }

      return true
    })
  }, [
    allRows,
    moduleFilter,
    municipioFilter,
    processFilter,
    search,
    statusFilter,
    yearFilter,
  ])

  const cards = useMemo(() => {
    const count = (module: Exclude<ReportModule, "todos">) =>
      rows.filter((item) => item.modulo === module).length

    return [
      { label: "Judicial", value: count("judicial") },
      { label: "Pré Judicial", value: count("pre_judicial") },
      { label: "TFD", value: count("tfd") },
      { label: "CNRAC", value: count("cnrac") },
      { label: "Hemodiálise", value: count("hemodialise") },
      { label: "Agendamento", value: count("agendamento") },
    ]
  }, [rows])

  function handleExportExcel() {
    downloadFile(
      "relatorio-modulos.csv",
      toCsv(rows),
      "text/csv;charset=utf-8;",
    )
  }

  return (
    <div className="flex flex-col gap-6 print:p-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Emissão estruturada por módulo com filtros operacionais e exportação
            para Excel UTF-8 e PDF.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel UTF-8
          </Button>
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" /> PDF / Imprimir
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 print:hidden">
        {cards.map((card) => (
          <Card key={card.label} className="border-border">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-semibold">{card.value}</p>
              </div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros do relatório</CardTitle>
          <CardDescription>
            Cada tipo de relatório pode ser liberado no controle de acesso por
            módulo e por ação de visualização/impressão.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <Label className="mb-1 block text-xs">Módulo</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value as ReportModule)}
            >
              {availableModules.map((item) => (
                <option key={item} value={item}>
                  {item === "todos"
                    ? "Todos"
                    : MODULE_LABELS[item as Exclude<ReportModule, "todos">]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-1 block text-xs">Busca geral</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Paciente, protocolo, procedimento, PGE.net"
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Status</Label>
            <Input
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="Pendente, resolvido..."
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Município</Label>
            <Input
              value={municipioFilter}
              onChange={(e) => setMunicipioFilter(e.target.value)}
              placeholder="Município de residência"
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Processo / PGE.net</Label>
            <Input
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              placeholder="Número do processo ou PGE.net"
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Ano</Label>
            <Input
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              placeholder="2026"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resultado do relatório</CardTitle>
          <CardDescription>{rows.length} registro(s) localizado(s).</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              Nenhum registro localizado com os filtros informados.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div
                  key={`${row.modulo}-${row.protocolo}-${index}`}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{MODULE_LABELS[row.modulo]}</Badge>
                    <Badge variant="secondary">{row.status || "Sem status"}</Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Paciente</p>
                      <p className="text-sm font-medium">{row.paciente}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Protocolo</p>
                      <p className="text-sm font-medium">{row.protocolo}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Município</p>
                      <p className="text-sm">{row.municipio || "-"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Procedimento</p>
                      <p className="text-sm">{row.procedimento || "-"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Processo</p>
                      <p className="text-sm">{row.processo || "-"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">PGE.net</p>
                      <p className="text-sm">{row.pgenet || "-"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Cadastrado em</p>
                      <p className="text-sm">{row.cadastradoEm || "-"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Último monitoramento
                      </p>
                      <p className="text-sm">{row.ultimoMonitoramento || "-"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Quem finalizou</p>
                      <p className="text-sm">{row.finalizadoPor || "-"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Último responsável
                      </p>
                      <p className="text-sm">{row.ultimoResponsavel || "-"}</p>
                    </div>
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