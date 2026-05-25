"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  Filter,
  RotateCcw,
  Search,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import {
  JUDICIAL_CASE_STATUS_LABELS,
  QUEUE_REASON_LABELS,
} from "@/lib/judicial-types"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_VARIANTS: Record<
  string,
  { variant: "secondary" | "default" | "destructive" }
> = {
  ativo: { variant: "secondary" },
  aguardando_agendamento: { variant: "secondary" },
  agendado: { variant: "default" },
  cumprido: { variant: "default" },
  descumprido: { variant: "destructive" },
  inercia_municipio: { variant: "destructive" },
  encerrado: { variant: "destructive" },
}

const PROCESS_STATUS_LABELS = {
  em_andamento: "Em andamento",
  descumprimento: "Descumprimento",
  decisao_judicial_prazo: "Decisão com prazo",
} as const

export function JudicialMonitoringBoard() {
  const { user } = useAuth()
  const judicial = useJudicial()

  const [search, setSearch] = useState("")
  const [reason, setReason] = useState("todos")
  const [status, setStatus] = useState("todos")

  const all =
    user?.role === "UNIDADE_HOSPITALAR"
      ? judicial.getMunicipalityCases(user)
      : judicial.getDailyQueueForUser(user, 30)

  const filtered = useMemo(() => {
    return all.filter((item) => {
      if (reason !== "todos" && item.queueReason !== reason) return false
      if (status !== "todos" && item.status !== status) return false

      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${item.patientName} ${item.cpf} ${item.processNumber} ${(item.processNumbers ?? []).join(" ")} ${item.originProtocol} ${item.municipalityName} ${item.registration?.pgeNetNumber ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      return true
    })
  }, [all, reason, search, status])

  const stats = useMemo(() => {
    return {
      total: all.length,
      pendente: all.filter((item) => item.finalization?.status === "pendente").length,
      resolvido: all.filter((item) => item.finalization?.status === "resolvido" || ["cumprido", "agendado"].includes(item.status)).length,
      devolvida: all.filter((item) => item.finalization?.status === "devolvida").length,
    }
  }, [all])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-card-foreground">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-2xl font-bold text-card-foreground">{stats.pendente}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 pt-4">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Resolvido</p>
              <p className="text-2xl font-bold text-card-foreground">{stats.resolvido}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 pt-4">
            <RotateCcw className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Devolvida</p>
              <p className="text-2xl font-bold text-card-foreground">{stats.devolvida}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar por protocolo, paciente, CPF, processo, PGE.net..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Buscar processos judiciais"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos ({all.length})</SelectItem>
                    {Object.entries(JUDICIAL_CASE_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Motivo</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {Object.entries(QUEUE_REASON_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(status !== "todos" || reason !== "todos" || search) && (
                <Button variant="ghost" size="sm" onClick={() => { setStatus("todos"); setReason("todos"); setSearch("") }}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-card-foreground">Demandas ({filtered.length})</CardTitle>
          <CardDescription>Clique em um processo para abrir a página completa do paciente.</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Filter className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">Nenhum processo encontrado com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((item) => {
                const statusConfig = STATUS_VARIANTS[item.status] ?? STATUS_VARIANTS.ativo
                const manifestacao = item.pendingMunicipalityAction ? "Pendente" : "Regular"
                const latestProcessStatus = item.processStatusHistory?.[item.processStatusHistory.length - 1]
                const procedurePriorityHighlights = item.priorityHighlights?.filter(
                  (priority) => priority.mode === "procedure",
                ) ?? []
                const cidPriorityHighlights = item.priorityHighlights?.filter(
                  (priority) => priority.mode === "cid",
                ) ?? []
                const prioritySummary = item.priorityHighlights?.map((priority) => {
                  const prefix = priority.mode === "procedure" ? "Procedimento" : "CID"
                  const validity = priority.expiresAt
                    ? ` até ${new Date(`${priority.expiresAt}T00:00:00`).toLocaleDateString("pt-BR")}`
                    : ""
                  return `${prefix}: ${priority.label}${validity}`
                }).join(" • ")
                return (
                  <Link
                    key={item.id}
                    href={`/judicial/${item.id}`}
                    className="group flex w-full items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-card-foreground">{item.originProtocol}</span>
                        <Badge variant={statusConfig.variant} className="text-xs">{JUDICIAL_CASE_STATUS_LABELS[item.status]}</Badge>
                        <Badge variant="destructive" className="text-xs">Judicial</Badge>
                        {latestProcessStatus && (
                          <Badge variant="outline" className="text-xs">
                            {PROCESS_STATUS_LABELS[latestProcessStatus.status]}
                            {latestProcessStatus.deadlineType && latestProcessStatus.deadlineValue
                              ? ` • ${latestProcessStatus.deadlineValue} ${latestProcessStatus.deadlineType}`
                              : ""}
                          </Badge>
                        )}
                        {item.finalization && (
                          <Badge variant="outline" className="text-xs">
                            Finalizado: {item.finalization.status}
                          </Badge>
                        )}
                        {procedurePriorityHighlights.length > 0 && (
                          <Badge variant="default" className="text-xs">
                            Procedimento priorizado
                          </Badge>
                        )}
                        {cidPriorityHighlights.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            CID priorizado
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 text-lg font-semibold leading-tight text-card-foreground">{item.patientName}</p>

                      <p className="truncate text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">CPF:</span> {item.cpf || "Não informado"} | <span className="font-medium text-foreground">PGE.net:</span> {item.registration?.pgeNetNumber || "Não informado"} | <span className="font-medium text-foreground">Município:</span> {item.municipalityName || "Não informado"}
                      </p>

                      <p className="truncate text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Processos:</span> {(item.processNumbers ?? [item.processNumber]).filter(Boolean).join(" | ") || "Não informado"}
                      </p>

                      <p className="truncate text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Prazo:</span> {item.queueDueLabel || "Não informado"} | <span className="font-medium text-foreground">Manifestação:</span> {manifestacao}
                      </p>

                      {prioritySummary && (
                        <p className="truncate text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Prioridades:</span> {prioritySummary}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="pointer-events-none inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-xs">
                        <Eye className="h-4 w-4" />
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
