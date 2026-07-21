"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, CalendarClock, RefreshCw } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useAuth } from "@/lib/auth-context"
import { hasUserPermission } from "@/lib/access-control"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

type UserSummary = {
  usuarioId: string
  usuarioNome: string
  usuarioEmail: string
  diasComHorario: number
  quantidadeMonitoramentos: number
  minutosMonitorando: number
  minutosOciosidade: number
  maiorIntervaloOcioso: number
  menorTempoMonitoramento: number | null
  maiorTempoMonitoramento: number | null
  mediaTempoMonitoramento: number | null
  primeiroInicio: string | null
  ultimaFinalizacao: string | null
}

type FilterUser = {
  usuarioId: string
  usuarioNome: string
  usuarioEmail: string
}

type DashboardResponse = {
  ok: boolean
  periodo: { inicio: string; fim: string }
  filtros?: {
    usuarios: FilterUser[]
  }
  resumo: {
    usuarios: number
    monitoramentos: number
    minutosMonitorando: number
    mediaTempoMonitoramento: number
    minutosOciosidade: number
    maiorIntervaloOcioso: number
  }
  graficos?: {
    metaMonitoramentosPorUsuario: {
      diasConsiderados: number
      metaDiaria: number
      meta: number
      usuarios: Array<{
        usuarioId: string
        usuarioNome: string
        quantidade: number
        meta: number
      }>
    }
    ociosidadePorUsuario: Array<{
      usuarioId: string
      usuarioNome: string
      minutosOciosidade: number
    }>
    totalMonitoramentosPorDia: Array<{
      dataReferencia: string
      label: string
      quantidade: number
    }>
    monitoramentosPorUsuarioUltimos5Dias: {
      usuarios: string[]
      dias: string[]
      dados: Array<Record<string, string | number>>
    }
  }
  usuarios: UserSummary[]
  error?: string
  detail?: string
}

const CHART_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
]

function todayText() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatMinutes(minutes: number | null | undefined) {
  if (minutes == null || Number.isNaN(minutes)) return "-"
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours <= 0) return `${mins}min`
  return `${hours}h ${String(mins).padStart(2, "0")}min`
}

function formatTooltipMinutes(value: unknown) {
  return formatMinutes(Number(value))
}


function firstNameLabel(value: unknown) {
  const text = String(value ?? "").trim()
  if (!text) return "Não informado"

  return text.split(/\s+/)[0] || "Não informado"
}

export default function DashboardAdministrativoPage() {
  const router = useRouter()
  const { user, isReady } = useAuth()
  const [inicio, setInicio] = useState(todayText())
  const [fim, setFim] = useState(todayText())
  const [usuarioId, setUsuarioId] = useState("todos")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<DashboardResponse | null>(null)

  const canAccess = useMemo(
    () => hasUserPermission(user as any, "DASHBOARD_ADMINISTRATIVO", "visualizar"),
    [user],
  )

  async function loadDashboard() {
    try {
      setLoading(true)
      setError("")
      const params = new URLSearchParams({ inicio, fim })
      if (usuarioId && usuarioId !== "todos") params.set("usuarioId", usuarioId)
      const response = await fetch(`/api/admin/dashboard-administrativo/ociosidade?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        throw new Error(json?.detail || json?.error || "Erro ao carregar dashboard.")
      }
      setData(json as DashboardResponse)
    } catch (err) {
      console.error("LOAD_DASHBOARD_ADMINISTRATIVO_ERROR", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar dashboard.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isReady || !canAccess) return

    // Carrega imediatamente ao abrir a pagina ou alterar os filtros.
    void loadDashboard()

    // Atualiza automaticamente os dados a cada 1 minuto.
    const intervalId = window.setInterval(() => {
      void loadDashboard()
    }, 60_000)

    return () => {
      window.clearInterval(intervalId)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, canAccess, inicio, fim, usuarioId])

  function openDetails(id: string) {
    if (!id) return
    router.push(
      `/admin/dashboard-administrativo/detalhes?usuarioId=${encodeURIComponent(id)}&inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`,
    )
  }

  const usuarios = data?.usuarios ?? []
  const filterUsers = data?.filtros?.usuarios ?? []
  const resumo = data?.resumo ?? {
    usuarios: 0,
    monitoramentos: 0,
    minutosMonitorando: 0,
    mediaTempoMonitoramento: 0,
    minutosOciosidade: 0,
    maiorIntervaloOcioso: 0,
  }
  const metaChart = data?.graficos?.metaMonitoramentosPorUsuario
  const ociosidadePie = data?.graficos?.ociosidadePorUsuario ?? []
  const totalPorDia = data?.graficos?.totalMonitoramentosPorDia ?? []
  const ultimos5 = data?.graficos?.monitoramentosPorUsuarioUltimos5Dias
  const agendamentoStatusChart = data?.graficos?.agendamentoStatus ?? []
  const fluxoAgendamentoChart = data?.graficos?.fluxoAgendamento ?? []
  const osCadastrosChart = data?.graficos?.osCadastrosPorUsuario ?? []
  const cadastrosMonitoramentosChart = data?.graficos?.cadastrosMonitoramentosPorUsuario ?? []
  const tipoMonitoramentoChart = data?.graficos?.tipoMonitoramento ?? []
  const atribuidosMonitoradosChart = (
    (data?.graficos as any)
      ?.atribuidosMonitoradosPeriodo ?? []
  ) as Array<{
    label: string
    atribuidos: number
    monitorados: number
  }>

  if (!isReady) return null

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Você não tem permissão para acessar o dashboard administrativo.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard Administrativo</h1>
            <p className="text-sm text-muted-foreground">
              Indicadores de monitoramento, ociosidade e produtividade por período.
            </p>
          </div>
        </div>

        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/dashboard-administrativo/horarios">
            <CalendarClock className="mr-2 h-4 w-4" /> Cadastrar horários
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Os cards e gráficos respeitam o período e o usuário selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[180px_180px_minmax(220px,1fr)_auto] md:items-end">
            <div>
              <Label className="mb-1 block text-xs">Data inicial</Label>
              <Input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Data final</Label>
              <Input type="date" value={fim} onChange={(event) => setFim(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Usuário</Label>
              <select
                value={usuarioId}
                onChange={(event) => setUsuarioId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="todos">Todos os usuários</option>
                {filterUsers.map((item) => (
                  <option key={item.usuarioId} value={item.usuarioId}>
                    {item.usuarioNome || item.usuarioEmail || item.usuarioId}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={loadDashboard} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {loading ? "Calculando..." : "Atualizar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Usuários</CardDescription>
            <CardTitle>{resumo.usuarios}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monitoramentos</CardDescription>
            <CardTitle>{resumo.monitoramentos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tempo médio de monitoramento</CardDescription>
            <CardTitle>{formatMinutes(resumo.mediaTempoMonitoramento)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tempo ocioso</CardDescription>
            <CardTitle>{formatMinutes(resumo.minutosOciosidade)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Maior intervalo ocioso</CardDescription>
            <CardTitle>{formatMinutes(resumo.maiorIntervaloOcioso)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>OS atribuídas</CardDescription>
            <CardTitle>{resumo.osAtribuidas ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>OS não atribuídas</CardDescription>
            <CardTitle>{resumo.osNaoAtribuidas ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Para avaliar</CardDescription>
            <CardTitle>{resumo.paraAvaliar ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Para agendar</CardDescription>
            <CardTitle>{resumo.paraAgendar ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cadastros hoje</CardDescription>
            <CardTitle>{resumo.cadastrosHoje ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Monitoramentos por usuário</CardTitle>
                <CardDescription>
                  Meta: dias com monitoramento no período × 20.
                </CardDescription>
              </div>
              <Badge variant="outline">
                Meta: {metaChart?.meta ?? 0} em {metaChart?.diasConsiderados ?? 0} dia(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(metaChart?.usuarios?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum monitoramento encontrado no período.</p>
            ) : (
<div className="h-[380px]">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart
      layout="vertical"
      data={metaChart?.usuarios ?? []}
      margin={{ top: 20, right: 70, left: 30, bottom: 20 }}
      onClick={(event) => {
        const payload = event?.activePayload?.[0]?.payload as { usuarioId?: string } | undefined
        if (payload?.usuarioId) openDetails(payload.usuarioId)
      }}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        type="number"
        allowDecimals={false}
        domain={[
          0,
          Math.max(
            1,
            metaChart?.meta ?? 0,
            ...((metaChart?.usuarios ?? []).map((item) => item.quantidade ?? 0)),
          ),
        ]}
      />
      <YAxis
        dataKey="usuarioNome"
        type="category"
        width={140}
        interval={0}
                      tickFormatter={(value) => firstNameLabel(value)}
                    />
      <Tooltip />
      <ReferenceLine
        x={metaChart?.meta ?? 0}
        stroke="#dc2626"
        strokeDasharray="6 4"
        label="Meta"
      />
      <Bar
        dataKey="quantidade"
        name="Monitoramentos"
        fill="#2563eb"
        radius={[0, 6, 6, 0]}
      />
    </BarChart>
  </ResponsiveContainer>
</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ociosidade por usuário</CardTitle>
            <CardDescription>
              Soma das ociosidades no período selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ociosidadePie.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ociosidade encontrada no período.</p>
            ) : (
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ociosidadePie}
                      dataKey="minutosOciosidade"
                      nameKey="usuarioNome"
                      outerRadius={115}
                      label={({ usuarioNome, minutosOciosidade }) => `${usuarioNome}: ${formatMinutes(Number(minutosOciosidade))}`}
                      onClick={(entry) => {
                        const payload = entry as { usuarioId?: string }
                        if (payload?.usuarioId) openDetails(payload.usuarioId)
                      }}
                    >
                      {ociosidadePie.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={formatTooltipMinutes} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Para avaliar x Para agendar</CardTitle>
            <CardDescription>
              Quantidade de demandas atualmente na fila de agendamento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {agendamentoStatusChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma demanda encontrada no período.</p>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={agendamentoStatusChart}
                      dataKey="total"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={(entry) => String(entry.label) + ": " + String(entry.total)}
                    >
                      {agendamentoStatusChart.map((item, index) => (
                        <Cell key={item.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enviado x Devolvido x Agendado</CardTitle>
            <CardDescription>
              Movimentações relacionadas ao agendamento no período.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fluxoAgendamentoChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação encontrada no período.</p>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fluxoAgendamentoChart} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="categoria" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="Quantidade" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>OS atribuídas x Cadastros por usuário</CardTitle>
            <CardDescription>
              Comparativo entre OS atribuídas e cadastros realizados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {osCadastrosChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado encontrado no período.</p>
            ) : (
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={osCadastrosChart} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="usuarioNome" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="osAtribuidas" name="OS atribuídas" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="cadastros" name="Cadastros" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cadastros x Monitoramentos por usuário</CardTitle>
            <CardDescription>
              Comparativo entre cadastros realizados e monitoramentos finalizados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cadastrosMonitoramentosChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado encontrado no período.</p>
            ) : (
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cadastrosMonitoramentosChart} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="usuarioNome" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cadastros" name="Cadastros" fill="#16a34a" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="monitoramentos" name="Monitoramentos" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DASHBOARD_LADO_A_LADO_ATRIBUIDOS_MONITORAMENTOS */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* DASHBOARD_GRAFICO_ATRIBUIDOS_X_MONITORADOS */}
        <Card>
          <CardHeader>
            <CardTitle>
              Atribuídos x Monitorado no período
            </CardTitle>
            <CardDescription>
              Protocolos judiciais distintos atribuídos automática ou manualmente e quantos foram monitorados no período selecionado. Ordens de Serviço não entram neste cálculo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {atribuidosMonitoradosChart.length === 0 ||
            !atribuidosMonitoradosChart.some(
              (item) =>
                item.atribuidos > 0 ||
                item.monitorados > 0,
            ) ? (
              <p className="text-sm text-muted-foreground">
                Nenhum protocolo atribuído encontrado no período.
              </p>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={atribuidosMonitoradosChart}
                    margin={{
                      top: 20,
                      right: 20,
                      left: 0,
                      bottom: 20,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="atribuidos"
                      name="Protocolos atribuídos"
                      fill="#2563eb"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="monitorados"
                      name="Protocolos monitorados"
                      fill="#16a34a"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monitoramento humano x automático x monitorados no período</CardTitle>
            <CardDescription>
              Comparativo das execuções humanas, automáticas e do total somado no período selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tipoMonitoramentoChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum monitoramento encontrado.</p>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tipoMonitoramentoChart} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    {/* DASHBOARD_CORES_TIPO_MONITORAMENTO */}
                    <Bar dataKey="total" name="Quantidade" radius={[6, 6, 0, 0]}>
                      {tipoMonitoramentoChart.map((item, index) => (
                        <Cell
                          key={`${item.label}-${index}`}
                          fill={["#2563eb", "#f97316", "#16a34a"][index % 3]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader>
          <CardTitle>Monitoramentos por monitor nos últimos 5 dias</CardTitle>
          <CardDescription>
            Mesmo com período maior, este gráfico usa sempre os últimos 5 dias disponíveis na tabela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(ultimos5?.dados?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum monitoramento encontrado para os últimos dias disponíveis.</p>
          ) : (
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ultimos5?.dados ?? []} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {(ultimos5?.usuarios ?? []).map((usuario, index) => (
                    <Bar
                      key={usuario}
                      dataKey={usuario}
                      name={usuario}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
