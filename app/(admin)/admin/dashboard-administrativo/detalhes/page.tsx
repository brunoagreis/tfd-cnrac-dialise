"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Clock, Timer } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import { hasUserPermission } from "@/lib/access-control"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type IdleInterval = {
  dataReferencia: string
  idUsuario: string
  usuarioNome: string
  usuarioEmail: string
  horarioTrabalhoId: string
  tipoIntervalo: string
  inicioOciosidade: string
  fimOciosidade: string
  minutosOciosidade: number
  observacao: string
}

type MonitorDetail = {
  id: string
  dataReferencia: string
  monitoramentoId: string
  usuarioId: string
  usuarioNome: string
  usuarioEmail: string
  pacienteNome: string
  procedimento: string
  cid: string
  iniciadoEm: string
  finalizadoEm: string
  minutosMonitoramento: number
}

type UserSummary = {
  usuarioId: string
  usuarioNome: string
  usuarioEmail: string
  quantidadeMonitoramentos: number
  minutosMonitorando: number
  minutosOciosidade: number
  maiorIntervaloOcioso: number
  menorTempoMonitoramento: number | null
  maiorTempoMonitoramento: number | null
  mediaTempoMonitoramento: number | null
}

type DashboardResponse = {
  ok: boolean
  usuarios: UserSummary[]
  intervalos: IdleInterval[]
  monitoramentos: MonitorDetail[]
  error?: string
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

function intervalLabel(value: string) {
  if (value === "ANTES_PRIMEIRO_MONITORAMENTO") return "Antes do primeiro monitoramento"
  if (value === "ENTRE_MONITORAMENTOS") return "Entre monitoramentos"
  if (value === "APOS_ULTIMO_MONITORAMENTO") return "Após último monitoramento"
  if (value === "DIA_SEM_MONITORAMENTO") return "Dia sem monitoramento"
  return value
}

export default function DashboardAdministrativoDetalhesPage() {
  const params = useSearchParams()
  const { user, isReady } = useAuth()
  const usuarioId = params.get("usuarioId") || ""
  const inicio = params.get("inicio") || ""
  const fim = params.get("fim") || inicio
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<DashboardResponse | null>(null)

  const canAccess = useMemo(
    () => hasUserPermission(user as any, "DASHBOARD_ADMINISTRATIVO", "visualizar"),
    [user],
  )

  useEffect(() => {
    if (!isReady || !canAccess || !usuarioId || !inicio) return

    async function loadDetails() {
      try {
        setLoading(true)
        setError("")
        const search = new URLSearchParams({ usuarioId, inicio, fim })
        const response = await fetch(`/api/admin/dashboard-administrativo/ociosidade?${search.toString()}`, {
          method: "GET",
          cache: "no-store",
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || "Erro ao carregar detalhes.")
        }
        setData(json as DashboardResponse)
      } catch (err) {
        console.error("LOAD_DASHBOARD_ADMIN_DETAILS_ERROR", err)
        setError(err instanceof Error ? err.message : "Erro ao carregar detalhes.")
      } finally {
        setLoading(false)
      }
    }

    void loadDetails()
  }, [isReady, canAccess, usuarioId, inicio, fim])

  const usuario = data?.usuarios?.[0]
  const intervalos = data?.intervalos ?? []
  const monitoramentos = data?.monitoramentos ?? []

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
        <div>
          <Button asChild variant="ghost" className="mb-2 px-0">
            <Link href={`/admin/dashboard-administrativo?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            Detalhe de ociosidade
          </h1>
          <p className="text-sm text-muted-foreground">
            {usuario?.usuarioNome || usuarioId} • {inicio} até {fim}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monitoramentos</CardDescription>
            <CardTitle>{usuario?.quantidadeMonitoramentos ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tempo monitorando</CardDescription>
            <CardTitle>{formatMinutes(usuario?.minutosMonitorando)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tempo ocioso</CardDescription>
            <CardTitle>{formatMinutes(usuario?.minutosOciosidade)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Menor monitoramento</CardDescription>
            <CardTitle>{formatMinutes(usuario?.menorTempoMonitoramento)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Maior monitoramento</CardDescription>
            <CardTitle>{formatMinutes(usuario?.maiorTempoMonitoramento)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" /> Intervalos de ociosidade
          </CardTitle>
          <CardDescription>
            Cada linha mostra o motivo e o intervalo usado para compor o tempo ocioso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : intervalos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum intervalo de ociosidade encontrado.</p>
          ) : (
            intervalos.map((item, index) => (
              <div key={`${item.dataReferencia}-${item.inicioOciosidade}-${index}`} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge>{intervalLabel(item.tipoIntervalo)}</Badge>
                  <Badge variant="outline">{formatMinutes(item.minutosOciosidade)}</Badge>
                </div>
                <p className="text-sm font-medium">
                  {formatDateTime(item.inicioOciosidade)} → {formatDateTime(item.fimOciosidade)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{item.observacao}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Monitoramentos realizados
          </CardTitle>
          <CardDescription>
            Tempo gasto em cada ação de monitoramento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : monitoramentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum monitoramento finalizado encontrado.</p>
          ) : (
            monitoramentos.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Monitoramento {item.monitoramentoId}</Badge>
                  <Badge>{formatMinutes(item.minutosMonitoramento)}</Badge>
                </div>
                <p className="text-sm font-semibold">{item.pacienteNome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(item.iniciadoEm)} → {formatDateTime(item.finalizadoEm)}
                </p>
                {item.procedimento && (
                  <p className="mt-2 text-xs text-muted-foreground">Procedimento: {item.procedimento}</p>
                )}
                {item.cid && (
                  <p className="text-xs text-muted-foreground">CID: {item.cid}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
