"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Search,
  ChevronRight,
  Filter,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Calendar,
} from "lucide-react"

import { useStore } from "@/lib/store-context"
import {
  DEMANDA_STATUS,
  DEMANDA_STATUS_LABELS,
  PENDENCIA_LABELS,
  type Module,
  type DemandaStatus,
  type Demanda,
  type PendenciaTipo,
} from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmailOsPanel } from "@/components/modules/email-os-panel"

const STATUS_CONFIG: Record<
  DemandaStatus,
  { icon: typeof AlertTriangle; variant: "secondary" | "default" | "destructive" }
> = {
  pendente: { icon: AlertTriangle, variant: "secondary" },
  resolvido: { icon: CheckCircle2, variant: "default" },
  devolvida: { icon: RotateCcw, variant: "destructive" },
}

type DemandListItem = {
  id: string
  protocolo: string
  pacienteId: string
  pacienteNome: string
  pacienteCpf: string
  modulo: Module
  emailSolicitante: string
  codigoSigtap: string
  descricaoSigtap: string
  cid10: string
  especialidade: string
  subespecialidade: string
  status: DemandaStatus
  criadoEm: string
  atualizadoEm: string
  acaoJudicial: boolean
  interacoesCount: number
  anexosCount: number
  pendenciaAtual?: PendenciaTipo | null
}

interface DemandListingProps {
  modulo: Module
  filterByEmail?: string
}

function mapStoreDemandaToListItem(
  d: Demanda,
  paciente?: { nome?: string; cpf?: string },
): DemandListItem {
  const lastInteracao = d.interacoes[d.interacoes.length - 1]

  return {
    id: d.id,
    protocolo: d.protocolo,
    pacienteId: d.pacienteId,
    pacienteNome: paciente?.nome ?? "Paciente nao encontrado",
    pacienteCpf: paciente?.cpf ?? "",
    modulo: d.modulo,
    emailSolicitante: d.emailSolicitante,
    codigoSigtap: d.codigoSigtap,
    descricaoSigtap: d.descricaoSigtap,
    cid10: d.cid10,
    especialidade: d.especialidade,
    subespecialidade: d.subespecialidade,
    status: d.status,
    criadoEm: d.criadoEm,
    atualizadoEm: d.atualizadoEm,
    acaoJudicial: d.acaoJudicial,
    interacoesCount: d.interacoes.length,
    anexosCount: d.anexos.length,
    pendenciaAtual: lastInteracao?.pendencia ?? null,
  }
}

function getApiPathByModule(modulo: Module) {
  if (modulo === "tfd") return "/api/tfd/demandas"
  if (modulo === "cnrac") return "/api/cnrac/demandas"
  if (modulo === "hemodialise") return "/api/hemodialise/demandas"
  return null
}

export function DemandListing({ modulo, filterByEmail }: DemandListingProps) {
  const store = useStore()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<DemandaStatus | "todos">("pendente")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [dbDemandas, setDbDemandas] = useState<DemandListItem[]>([])
  const [loadingDbDemandas, setLoadingDbDemandas] = useState(false)

  useEffect(() => {
    async function fetchModuleDemandas() {
      const apiPath = getApiPathByModule(modulo)
      if (!apiPath) return

      try {
        setLoadingDbDemandas(true)

        const params = new URLSearchParams()
        if (filterByEmail) {
          params.set("email", filterByEmail)
        }

        const response = await fetch(
          `${apiPath}${params.toString() ? `?${params.toString()}` : ""}`,
          {
            method: "GET",
            cache: "no-store",
          },
        )

        const json = await response.json().catch(() => ({}))

        if (!response.ok || !json?.ok) {
          toast.error(json?.error || `Erro ao carregar demandas do módulo ${modulo.toUpperCase()}.`)
          return
        }

        setDbDemandas(Array.isArray(json?.items) ? json.items : [])
      } catch (error) {
        console.error(`LOAD_${modulo.toUpperCase()}_DB_DEMANDAS_ERROR`, error)
        toast.error(`Erro ao carregar demandas do módulo ${modulo.toUpperCase()}.`)
      } finally {
        setLoadingDbDemandas(false)
      }
    }

    void fetchModuleDemandas()
  }, [modulo, filterByEmail])

  const allDemandas = useMemo(() => {
    const apiPath = getApiPathByModule(modulo)

    if (apiPath) {
      return dbDemandas
    }

    const byModule = store.demandasByModule(modulo)

    const mapped = byModule.map((d) => {
      const paciente = store.pacientes.find((p) => p.id === d.pacienteId)
      return mapStoreDemandaToListItem(d, paciente)
    })

    if (filterByEmail) {
      return mapped.filter(
        (d) => d.emailSolicitante.toLowerCase() === filterByEmail.toLowerCase(),
      )
    }

    return mapped
  }, [modulo, dbDemandas, store, filterByEmail])

  const filtered = useMemo(() => {
    return allDemandas.filter((d) => {
      if (statusFilter !== "todos" && d.status !== statusFilter) return false

      if (dateFrom) {
        const from = new Date(dateFrom)
        if (new Date(d.criadoEm) < from) return false
      }

      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59)
        if (new Date(d.criadoEm) > to) return false
      }

      if (search.trim()) {
        const q = search.toLowerCase()
        const searchStr =
          `${d.protocolo} ${d.descricaoSigtap} ${d.codigoSigtap} ${d.cid10} ${d.especialidade} ${d.pacienteNome} ${d.pacienteCpf}`.toLowerCase()

        if (!searchStr.includes(q)) return false
      }

      return true
    })
  }, [allDemandas, statusFilter, dateFrom, dateTo, search])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: allDemandas.length }

    for (const s of DEMANDA_STATUS) {
      counts[s] = allDemandas.filter((d) => d.status === s).length
    }

    return counts
  }, [allDemandas])

  return (
    <div className="flex flex-col gap-4">
      <EmailOsPanel modulo={modulo} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-card-foreground">{statusCounts.todos}</p>
          </CardContent>
        </Card>

        {DEMANDA_STATUS.map((s) => {
          const cfg = STATUS_CONFIG[s]
          const Icon = cfg.icon

          return (
            <Card key={s} className="border-border">
              <CardContent className="flex items-center gap-3 pt-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{DEMANDA_STATUS_LABELS[s]}</p>
                  <p className="text-2xl font-bold text-card-foreground">{statusCounts[s]}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar por protocolo, paciente, procedimento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Buscar demandas"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as DemandaStatus | "todos")}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos ({statusCounts.todos})</SelectItem>
                    {DEMANDA_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {DEMANDA_STATUS_LABELS[s]} ({statusCounts[s]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">De</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Ate</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>

              {(statusFilter !== "todos" || dateFrom || dateTo || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("pendente")
                    setDateFrom("")
                    setDateTo("")
                    setSearch("")
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-card-foreground">
            Demandas ({filtered.length})
          </CardTitle>
          <CardDescription>
            Clique em uma demanda para acessar o protocolo completo.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {getApiPathByModule(modulo) && loadingDbDemandas ? (
            <div className="py-12 text-center text-muted-foreground">
              <Filter className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">Carregando demandas do banco de dados...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Filter className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">Nenhuma demanda encontrada com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((d) => (
                <DemandRow key={d.id} demanda={d} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DemandRow({ demanda }: { demanda: DemandListItem }) {
  const cfg = STATUS_CONFIG[demanda.status]

  return (
    <Link
      href={`/protocolo/${demanda.protocolo}`}
      className="group flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-card-foreground">
            {demanda.protocolo}
          </span>
          <Badge variant={cfg.variant} className="text-xs">
            {DEMANDA_STATUS_LABELS[demanda.status]}
          </Badge>
          {demanda.acaoJudicial && (
            <Badge variant="destructive" className="text-xs">
              Judicial
            </Badge>
          )}
        </div>

        <p className="mt-1 text-sm text-card-foreground">{demanda.pacienteNome}</p>

        <p className="truncate text-xs text-muted-foreground">
          {demanda.codigoSigtap} - {demanda.descricaoSigtap} | {demanda.especialidade}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(demanda.criadoEm).toLocaleDateString("pt-BR")}
          </span>
          <span>{demanda.interacoesCount} interacao(es)</span>
          <span>{demanda.anexosCount} anexo(s)</span>
          {demanda.pendenciaAtual && (
            <Badge variant="outline" className="bg-amber-50 text-amber-800 text-xs">
              {PENDENCIA_LABELS[demanda.pendenciaAtual]}
            </Badge>
          )}
        </div>
      </div>

      <ChevronRight
        className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}
