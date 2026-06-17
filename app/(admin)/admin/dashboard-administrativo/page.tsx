"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { BarChart3, Clock, Eye, RefreshCw, Timer } from "lucide-react"

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

type DashboardResponse = {
  ok: boolean
  periodo: { inicio: string; fim: string }
  resumo: {
    usuarios: number
    monitoramentos: number
    minutosMonitorando: number
    minutosOciosidade: number
    maiorIntervaloOcioso: number
  }
  usuarios: UserSummary[]
  error?: string
}

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-BR")
}

export default function DashboardAdministrativoPage() {
  const { user, isReady } = useAuth()
  const [inicio, setInicio] = useState(todayText())
  const [fim, setFim] = useState(todayText())
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
      const response = await fetch(`/api/admin/dashboard-administrativo/ociosidade?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar dashboard.")
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
    if (isReady && canAccess) void loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, canAccess])

  const usuarios = data?.usuarios ?? []
  const resumo = data?.resumo ?? {
    usuarios: 0,
    monitoramentos: 0,
    minutosMonitorando: 0,
    minutosOciosidade: 0,
    maiorIntervaloOcioso: 0,
  }
  const maxIdle = usuarios.reduce((max, item) => Math.max(max, item.minutosOciosidade), 0)

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
              Ociosidade e tempo de monitoramento por usuário.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            O cálculo considera o horário de trabalho cadastrado e os monitoramentos iniciados/finalizados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[180px_180px_auto] md:items-end">
            <div>
              <Label className="mb-1 block text-xs">Início</Label>
              <Input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Fim</Label>
              <Input type="date" value={fim} onChange={(event) => setFim(event.target.value)} />
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
            <CardDescription>Tempo monitorando</CardDescription>
            <CardTitle>{formatMinutes(resumo.minutosMonitorando)}</CardTitle>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ociosidade por usuário</CardTitle>
          <CardDescription>
            Clique em um usuário para ver os intervalos que justificam o tempo calculado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Calculando...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado encontrado para o período.</p>
          ) : (
            usuarios.map((item) => {
              const width = maxIdle > 0 ? Math.max(3, Math.round((item.minutosOciosidade / maxIdle) * 100)) : 0
              const detailsHref = `/admin/dashboard-administrativo/detalhes?usuarioId=${encodeURIComponent(item.usuarioId)}&inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`
              return (
                <Link key={item.usuarioId} href={detailsHref} className="block rounded-xl border border-border p-4 transition hover:bg-muted/40">
                  <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{item.usuarioNome}</p>
                      <p className="text-xs text-muted-foreground">{item.usuarioEmail || item.usuarioId}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.quantidadeMonitoramentos} monitoramento(s)</Badge>
                      <Badge>{formatMinutes(item.minutosOciosidade)} ocioso</Badge>
                    </div>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                  </div>
                </Link>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tempo de monitoramento das ações</CardTitle>
          <CardDescription>Menor, maior e média de tempo por usuário.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Usuário</th>
                <th className="py-2 pr-3">Qtd.</th>
                <th className="py-2 pr-3">Menor tempo</th>
                <th className="py-2 pr-3">Maior tempo</th>
                <th className="py-2 pr-3">Média</th>
                <th className="py-2 pr-3">Total monitorando</th>
                <th className="py-2 pr-3">Primeiro início</th>
                <th className="py-2 pr-3">Última finalização</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((item) => (
                <tr key={item.usuarioId} className="border-b last:border-0">
                  <td className="py-3 pr-3 font-medium">{item.usuarioNome}</td>
                  <td className="py-3 pr-3">{item.quantidadeMonitoramentos}</td>
                  <td className="py-3 pr-3">{formatMinutes(item.menorTempoMonitoramento)}</td>
                  <td className="py-3 pr-3">{formatMinutes(item.maiorTempoMonitoramento)}</td>
                  <td className="py-3 pr-3">{formatMinutes(item.mediaTempoMonitoramento)}</td>
                  <td className="py-3 pr-3">{formatMinutes(item.minutosMonitorando)}</td>
                  <td className="py-3 pr-3">{formatDateTime(item.primeiroInicio)}</td>
                  <td className="py-3 pr-3">{formatDateTime(item.ultimaFinalizacao)}</td>
                  <td className="py-3 pr-3 text-right">
                    <Button asChild size="sm" variant="outline" className="bg-transparent">
                      <Link href={`/admin/dashboard-administrativo/detalhes?usuarioId=${encodeURIComponent(item.usuarioId)}&inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`}>
                        <Eye className="mr-2 h-4 w-4" /> Detalhes
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
