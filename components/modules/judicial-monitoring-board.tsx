"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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

type JudicialBoardItem = {
  id: string
  monitoramentoId: number
  demandaId: string
  pacienteId: string
  protocolo: string
  nomePaciente: string
  cpf: string
  cns: string
  fichaCore: string
  procedimentoCodigo: string
  procedimentoDescricao: string
  cidCodigo: string
  cidDescricao: string
  statusMonitoramentoAtual: string
  statusLabel: string
  origemModulo: string
  origemTabela: string
  origemRegistroId: string
  ativoMonitoramento: boolean
  dataUltimoMonitoramento: string
  atribuicaoStatus: string
  atribuicaoStatusLabel: string
  atribuidaEm: string
  usuarioAtribuidoNome: string
}

const STATUS_BADGE_VARIANTS: Record<
  string,
  "secondary" | "default" | "destructive" | "outline"
> = {
  PENDENTE: "secondary",
  EM_ANDAMENTO: "default",
  FINALIZADO: "outline",
  RESOLVIDO: "default",
  DEVOLVIDA: "destructive",
  DEVOLVIDO: "destructive",
  BLOQUEIO: "destructive",
  SEQUESTRO: "destructive",
  OBITO: "outline",
}

function getStatusVariant(status: string) {
  const key = String(status || "").trim().toUpperCase()
  return STATUS_BADGE_VARIANTS[key] ?? "secondary"
}

function getStatusFilterValue(status: string) {
  const key = String(status || "").trim().toUpperCase()

  if (key === "FINALIZADO" || key === "RESOLVIDO") return "finalizado"
  if (key === "DEVOLVIDA" || key === "DEVOLVIDO") return "devolvida"

  return "pendente"
}
function formatDateTime(value: string) {
  if (!value) return "Não informado"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Não informado"

  return date.toLocaleString("pt-BR")
}

export function JudicialMonitoringBoard() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<JudicialBoardItem[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("pendente")
  const [origemModulo, setOrigemModulo] = useState("todos")

  useEffect(() => {
    void fetchCases()
  }, [])

  async function fetchCases() {
    try {
      setLoading(true)

      const response = await fetch("/api/judicial/casos?somenteAtivos=true", {
        method: "GET",
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        return
      }

      setItems(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_JUDICIAL_CASES_ERROR", error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
if (status !== "todos" && getStatusFilterValue(item.statusMonitoramentoAtual) !== status) {
  return false
      }

      if (origemModulo !== "todos" && item.origemModulo.toLowerCase() !== origemModulo) {
        return false
      }

      if (search.trim()) {
        const q = search.toLowerCase()
        const haystack = [
          item.protocolo,
          item.nomePaciente,
          item.cpf,
          item.cns,
          item.fichaCore,
          item.procedimentoCodigo,
          item.procedimentoDescricao,
          item.cidCodigo,
          item.cidDescricao,
          item.origemModulo,
          item.usuarioAtribuidoNome,
        ]
          .join(" ")
          .toLowerCase()

        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [items, origemModulo, search, status])

const stats = useMemo(() => {
  return {
    total: items.length,
    pendente: items.filter((item) => getStatusFilterValue(item.statusMonitoramentoAtual) === "pendente").length,
    resolvido: items.filter((item) => getStatusFilterValue(item.statusMonitoramentoAtual) === "finalizado").length,
    devolvida: items.filter((item) => getStatusFilterValue(item.statusMonitoramentoAtual) === "devolvida").length,
  }
}, [items])


  const origemOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        items.map((item) => item.origemModulo.toLowerCase()).filter(Boolean),
      ),
    )

    return unique.sort()
  }, [items])

  const showMunicipalityMode = user?.role === "UNIDADE_HOSPITALAR"

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
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar por protocolo, paciente, CPF, CNS, ficha CORE, procedimento ou CID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Buscar casos judiciais"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Status</Label>
                <select
                  className="flex h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >

<option value="todos">Todos ({stats.total})</option>
<option value="pendente">Pendente ({stats.pendente})</option>
<option value="finalizado">Finalizado ({stats.resolvido})</option>
<option value="devolvida">Devolvida ({stats.devolvida})</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Origem</Label>
                <select
                  className="flex h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={origemModulo}
                  onChange={(e) => setOrigemModulo(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  {origemOptions.map((value) => (
                    <option key={value} value={value}>
                      {value.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {(status !== "todos" || origemModulo !== "todos" || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatus("pendente")
                    setOrigemModulo("todos")
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
            {showMunicipalityMode
              ? "Visualização simplificada da Judicialização."
              : "Fila judicial baseada no banco de dados real."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Carregando casos judiciais...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Filter className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">Nenhum processo encontrado com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((item) => (
                <Link
                  key={item.id}
                  href={`/judicial/${item.id}`}
                  className="group flex w-full items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-card-foreground">
                        {item.protocolo}
                      </span>

                      <Badge variant={getStatusVariant(item.statusMonitoramentoAtual)}>
                        {item.statusLabel}
                      </Badge>

                      <Badge variant="outline">
                        {item.origemModulo || "JUDICIAL"}
                      </Badge>

                      {item.usuarioAtribuidoNome && (
                        <Badge variant="secondary">
                          {item.usuarioAtribuidoNome}
                        </Badge>
                      )}

                      {item.atribuicaoStatus && (
                        <Badge variant="outline">
                          {item.atribuicaoStatusLabel}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1 text-lg font-semibold leading-tight text-card-foreground">
                      {item.nomePaciente}
                    </p>

                    <p className="truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">CPF:</span>{" "}
                      {item.cpf || "Não informado"}
                      {" | "}
                      <span className="font-medium text-foreground">CNS:</span>{" "}
                      {item.cns || "Não informado"}
                    </p>

                    <p className="truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Ficha CORE:</span>{" "}
                      {item.fichaCore || "Não informada"}
                    </p>

                    <p className="truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Procedimento:</span>{" "}
                      {item.procedimentoCodigo || "-"}
                      {item.procedimentoDescricao ? ` - ${item.procedimentoDescricao}` : ""}
                    </p>

                    <p className="truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">CID:</span>{" "}
                      {item.cidCodigo || "-"}
                      {item.cidDescricao ? ` - ${item.cidDescricao}` : ""}
                    </p>

                    <p className="truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Último monitoramento:</span>{" "}
                      {formatDateTime(item.dataUltimoMonitoramento)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="pointer-events-none inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-xs">
                      <Eye className="h-4 w-4" />
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}