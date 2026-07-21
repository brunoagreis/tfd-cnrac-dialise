"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Search } from "lucide-react"

import {
  PREJUDICIAL_QUEUE_REASON_LABELS,
  PREJUDICIAL_STATUS_LABELS,
} from "@/lib/pre-judicial-types"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MODULE_LIST_PAGE_SIZE = 10

type PreJudicialBoardItem = {
  id: string
  patientId: string
  patientName: string
  cpf: string
  municipalityName: string
  originModule: string
  originProtocol: string
  protocolNumber: string
  active: boolean
  status: keyof typeof PREJUDICIAL_STATUS_LABELS
  priority: number
  createdAt: string
  updatedAt: string
  deadlineAt: string
  deadlineWarningLevel: "ok" | "warning" | "critical" | "overdue"
  schedulingStatus: "fora_fila" | "pendente" | "reservado"
  latestSchedulingMovementType?: string
  schedulingRequestedAt?: string
  schedulingReservedAt?: string
  schedulingResponseDeadlineAt?: string
  appointmentDate?: string
  procedureCode: string
  procedureDescription: string
  cidCode: string
  cidDescription: string
  queueReason: keyof typeof PREJUDICIAL_QUEUE_REASON_LABELS
  queuePriorityScore: number
  queueDueLabel: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function getStatusLabel(status: string) {
  const key = status as keyof typeof PREJUDICIAL_STATUS_LABELS
  return PREJUDICIAL_STATUS_LABELS[key] ?? status
}

function getReasonLabel(reason: string) {
  const key = reason as keyof typeof PREJUDICIAL_QUEUE_REASON_LABELS
  return PREJUDICIAL_QUEUE_REASON_LABELS[key] ?? reason
}

function getDeadlineLabel(level: string) {
  if (level === "overdue") return "Vencido"
  if (level === "critical") return "Crítico"
  if (level === "warning") return "Atenção"
  return "Regular"
}

function getSchedulingLabel(status: string) {
  if (status === "reservado") return "Reserva"
  if (status === "pendente") return "Agendamento"
  return "Fila interna"
}

function getReturnFromSchedulingBadgeClass(item: PreJudicialBoardItem) {
  const latestType = String(item.latestSchedulingMovementType || "")
    .trim()
    .toLowerCase()

  if (latestType === "agendado") {
    return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
  }

  if (latestType === "retorno_fila") {
    return "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
  }

  return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
}

function getReturnFromSchedulingLabel(item: PreJudicialBoardItem) {
  const status = String(item.status || "").trim().toLowerCase()
  const schedulingStatus = String(item.schedulingStatus || "").trim().toLowerCase()
  const latestType = String(item.latestSchedulingMovementType || "").trim().toLowerCase()

  if (status !== "ativo") return null
  if (schedulingStatus !== "fora_fila") return null

  if (latestType === "agendado") return "AGENDAMENTO REALIZADO"
  if (latestType === "retorno_fila") return "DEVOLVIDO PELO AGENDAMENTO"
  if (latestType === "analise_viabilidade_nao_rede") return "Voltou: não feito na rede"
  if (latestType === "analise_viabilidade_complementacao") return "Voltou: complementar informações"

  return null
}

export function PreJudicialBoard() {
  const [items, setItems] = useState<PreJudicialBoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [reason, setReason] = useState("todos")
  const [status, setStatus] = useState("todos")
  const [modulePage, setModulePage] = useState(1)

  useEffect(() => {
    let active = true

    async function loadItems() {
      try {
        setLoading(true)
        setError("")

const response = await fetch("/api/pre-judicial/casos?somenteAtivos=false", {
  cache: "no-store",
})

        const data = await response.json()

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Erro ao carregar Pré Judicial.")
        }

        if (!active) return

        setItems((data.items ?? []) as PreJudicialBoardItem[])
      } catch (err) {
        if (!active) return

        console.error("[PreJudicialBoard] erro ao carregar:", err)
        setError(
          err instanceof Error
            ? err.message
            : "Erro ao carregar casos do Pré Judicial.",
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadItems()

    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const selectedStatus = String(status || "todos").trim().toLowerCase()
      const itemStatus = String(item.status || "").trim().toLowerCase()
      const selectedFinalStatus =
        selectedStatus !== "todos" && isResolvedPreJudicialStatus(selectedStatus)

      if (selectedFinalStatus) {
        if (itemStatus !== selectedStatus) return false
      } else {
        if (item.active === false) return false
        if (isResolvedPreJudicialStatus(item.status)) return false
        if (status !== "todos" && item.status !== status) return false
      }

      if (reason !== "todos" && item.queueReason !== reason) return false

      if (search.trim()) {
        const q = search.toLowerCase()

        const hay = [
          item.patientName,
          item.cpf,
          item.protocolNumber,
          item.originProtocol,
          item.municipalityName,
          item.procedureCode,
          item.procedureDescription,
          item.cidCode,
          item.cidDescription,
        ]
          .map(normalizeText)
          .join(" ")
          .toLowerCase()

        if (!hay.includes(q)) return false
      }

      return true
    })
  }, [items, reason, search, status])

  // MODULE_LIST_PAGINATION_GLOBAL_SEARCH
  const moduleTotalPages = Math.max(1, Math.ceil(filtered.length / MODULE_LIST_PAGE_SIZE))
  const moduleCurrentPage = Math.min(modulePage, moduleTotalPages)

  const modulePaginated = useMemo(() => {
    const start = (moduleCurrentPage - 1) * MODULE_LIST_PAGE_SIZE
    return filtered.slice(start, start + MODULE_LIST_PAGE_SIZE)
  }, [filtered, moduleCurrentPage])

  useEffect(() => {
    setModulePage(1)
  }, [reason, status, search])

function isResolvedPreJudicialStatus(status: string) {
  return ["resolvido", "encerrado", "cumprido", "arquivado", "obito"].includes(
    String(status || "").trim().toLowerCase(),
  )
}

const stats = {
  total: items.filter((item) => !isResolvedPreJudicialStatus(item.status)).length,

  criticos: items.filter(
    (item) =>
      !isResolvedPreJudicialStatus(item.status) &&
      [
        "prazo_critico",
        "prazo_hoje",
        "prazo_vencido",
        "retorno_automatico",
      ].includes(item.queueReason),
  ).length,

  scheduling: items.filter(
    (item) =>
      !isResolvedPreJudicialStatus(item.status) &&
      item.schedulingStatus !== "fora_fila",
  ).length,

  resolvidos: items.filter((item) =>
    isResolvedPreJudicialStatus(item.status),
  ).length,
}

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Fila ativa</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Casos críticos</p>
            <p className="text-2xl font-bold text-destructive">
              {stats.criticos}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">No Agendamento</p>
            <p className="text-2xl font-bold text-amber-600">
              {stats.scheduling}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Resolvidos</p>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.resolvidos}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fila do Pré Judicial</CardTitle>
          <CardDescription>
            Prioriza prazos vencidos, retorno automático por omissão do setor e
            reservas próximas do vencimento.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px] lg:items-end">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">
                Buscar
              </Label>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 pl-9"
                  placeholder="Buscar por paciente, CPF, protocolo, município, SIGTAP ou CID..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">
                Motivo da fila
              </Label>

              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>

                  {Object.entries(PREJUDICIAL_QUEUE_REASON_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">
                Status
              </Label>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>

                  {Object.entries(PREJUDICIAL_STATUS_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Carregando demandas do Pré Judicial...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-dashed border-destructive/40 p-10 text-center text-sm text-destructive">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhuma demanda encontrada com os filtros atuais.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {modulePaginated.map((item) => {
                return (
                  <Link
                    key={item.id}
                    href={`/pre-judicial/${item.id}`}
                    className="group rounded-xl border border-border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-card-foreground">
                            {item.protocolNumber}
                          </span>

                          <Badge
                            variant={
                              ["prazo_vencido", "retorno_automatico"].includes(
                                item.queueReason,
                              )
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {getReasonLabel(item.queueReason)}
                          </Badge>

                          <Badge variant="outline" className="text-xs">
                            {getStatusLabel(item.status)}
                          </Badge>

                          <Badge variant="outline" className="text-xs">
                            {item.originModule.toUpperCase()}
                          </Badge>
                          {getReturnFromSchedulingLabel(item) ? (
                            <Badge
                              variant="outline"
                              className={getReturnFromSchedulingBadgeClass(item)}
                            >
                              {getReturnFromSchedulingLabel(item)}
                            </Badge>
                          ) : null}
                        </div>

                        <p className="mt-1 text-lg font-semibold leading-tight text-foreground">
                          {item.patientName}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            CPF:
                          </span>{" "}
                          {item.cpf || "Não informado"}
                          {" | "}
                          <span className="font-medium text-foreground">
                            Protocolo:
                          </span>{" "}
                          {item.protocolNumber}
                          {" | "}
                          <span className="font-medium text-foreground">
                            Origem:
                          </span>{" "}
                          {item.originProtocol || "Não informado"}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Município:
                          </span>{" "}
                          {item.municipalityName || "Não informado"}
                        </p>

                        {(item.procedureCode || item.cidCode) && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.procedureCode && (
                              <>
                                <span className="font-medium text-foreground">
                                  SIGTAP:
                                </span>{" "}
                                {item.procedureCode} -{" "}
                                {item.procedureDescription || "Não informado"}
                              </>
                            )}

                            {item.procedureCode && item.cidCode ? " | " : ""}

                            {item.cidCode && (
                              <>
                                <span className="font-medium text-foreground">
                                  CID:
                                </span>{" "}
                                {item.cidCode} -{" "}
                                {item.cidDescription || "Não informado"}
                              </>
                            )}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>
                            <span className="font-medium text-foreground">
                              Prazo:
                            </span>{" "}
                            {item.queueDueLabel || "Não informado"}
                          </span>

                          <span>
                            <span className="font-medium text-foreground">
                              Resposta:
                            </span>{" "}
                            {getSchedulingLabel(item.schedulingStatus)}
                          </span>

                          <span>
                            <span className="font-medium text-foreground">
                              Criticidade:
                            </span>{" "}
                            {getDeadlineLabel(item.deadlineWarningLevel)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        <ModuleListPagination
          page={moduleCurrentPage}
          pages={moduleTotalPages}
          total={filtered.length}
          onPageChange={setModulePage}
        />
        </CardContent>
      </Card>
    </div>
  )
}

function ModuleListPagination({
  page,
  pages,
  total,
  onPageChange,
}: {
  page: number
  pages: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (total <= MODULE_LIST_PAGE_SIZE) return null

  const first = Math.min(total, (page - 1) * MODULE_LIST_PAGE_SIZE + 1)
  const last = Math.min(total, page * MODULE_LIST_PAGE_SIZE)

  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        Exibindo {first} a {last} de {total} resultado(s). Página {page} de {pages}.
      </span>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-md border border-input bg-background px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Anterior
        </button>

        <button
          type="button"
          className="rounded-md border border-input bg-background px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page >= pages}
          onClick={() => onPageChange(Math.min(pages, page + 1))}
        >
          Próxima
        </button>
      </div>
    </div>
  )
}
