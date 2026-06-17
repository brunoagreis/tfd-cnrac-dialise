"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CalendarClock, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { hasUserPermission } from "@/lib/access-control"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Usuario = {
  id: string
  nome: string
  email: string
  role: string
  perfilCodigo: string
  ativo: boolean
}

type Horario = {
  id: string
  idUsuario: string
  usuarioNome: string
  usuarioEmail: string
  diaSemana: number
  horaEntrada: string
  horaEntradaAlmoco: string
  horaRetornoAlmoco: string
  horaSaida: string
  ativo: boolean
  createdAt: string | null
  updatedAt: string | null
}

type ApiResponse = {
  ok: boolean
  usuarios: Usuario[]
  horarios: Horario[]
  error?: string
}

const WEEKDAYS = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
]

function weekdayLabel(value: number) {
  return WEEKDAYS.find((item) => item.value === value)?.label ?? `Dia ${value}`
}

export default function HorariosTrabalhoPage() {
  const { user, isReady } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [idUsuario, setIdUsuario] = useState("")
  const [diaSemana, setDiaSemana] = useState("1")
  const [horaEntrada, setHoraEntrada] = useState("07:30")
  const [horaEntradaAlmoco, setHoraEntradaAlmoco] = useState("11:30")
  const [horaRetornoAlmoco, setHoraRetornoAlmoco] = useState("12:30")
  const [horaSaida, setHoraSaida] = useState("16:30")

  const canAccess = useMemo(
    () => hasUserPermission(user as any, "DASHBOARD_ADMINISTRATIVO", "visualizar"),
    [user],
  )

  async function loadData() {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/dashboard-administrativo/horarios", {
        method: "GET",
        cache: "no-store",
      })
      const json = await response.json().catch(() => ({})) as Partial<ApiResponse>
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar horários.")
      }
      setUsuarios(Array.isArray(json.usuarios) ? json.usuarios : [])
      setHorarios(Array.isArray(json.horarios) ? json.horarios : [])
    } catch (error) {
      console.error("LOAD_WORK_SCHEDULES_PAGE_ERROR", error)
      toast.error(error instanceof Error ? error.message : "Erro ao carregar horários.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isReady && canAccess) void loadData()
  }, [isReady, canAccess])

  async function saveSchedule() {
    const usuario = usuarios.find((item) => item.id === idUsuario)
    if (!usuario) {
      toast.error("Selecione o usuário.")
      return
    }

    try {
      setSaving(true)
      const response = await fetch("/api/admin/dashboard-administrativo/horarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idUsuario: usuario.id,
          usuarioNome: usuario.nome,
          usuarioEmail: usuario.email,
          diaSemana: Number(diaSemana),
          horaEntrada,
          horaEntradaAlmoco,
          horaRetornoAlmoco,
          horaSaida,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao salvar horário.")
      }
      toast.success("Horário salvo. O horário anterior do mesmo dia foi inativado.")
      await loadData()
    } catch (error) {
      console.error("SAVE_WORK_SCHEDULE_PAGE_ERROR", error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar horário.")
    } finally {
      setSaving(false)
    }
  }

  async function setActive(id: string, ativo: boolean) {
    try {
      const response = await fetch("/api/admin/dashboard-administrativo/horarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ativo }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar horário.")
      }
      toast.success(ativo ? "Horário ativado." : "Horário inativado.")
      await loadData()
    } catch (error) {
      console.error("ACTIVE_WORK_SCHEDULE_PAGE_ERROR", error)
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar horário.")
    }
  }

  if (!isReady) return null

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Você não tem permissão para acessar os horários de trabalho.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" className="mb-2 px-0">
          <Link href="/admin/dashboard-administrativo">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Horários de trabalho</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre entrada, almoço, retorno e saída por usuário e dia da semana.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo horário</CardTitle>
          <CardDescription>
            Ao salvar, o horário ativo anterior do mesmo usuário/dia será inativado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Usuário</Label>
              <select
                value={idUsuario}
                onChange={(event) => setIdUsuario(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nome || usuario.email || usuario.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Dia da semana</Label>
              <select
                value={diaSemana}
                onChange={(event) => setDiaSemana(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {WEEKDAYS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs">Entrada</Label>
              <Input type="time" value={horaEntrada} onChange={(event) => setHoraEntrada(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Saída almoço</Label>
              <Input type="time" value={horaEntradaAlmoco} onChange={(event) => setHoraEntradaAlmoco(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Retorno almoço</Label>
              <Input type="time" value={horaRetornoAlmoco} onChange={(event) => setHoraRetornoAlmoco(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Saída</Label>
              <Input type="time" value={horaSaida} onChange={(event) => setHoraSaida(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveSchedule} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar horário"}
            </Button>
            <Button variant="outline" className="bg-transparent" onClick={loadData} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar lista
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horários cadastrados</CardTitle>
          <CardDescription>
            Os horários ativos são usados no cálculo da ociosidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : horarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum horário cadastrado.</p>
          ) : (
            horarios.map((horario) => (
              <div key={horario.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant={horario.ativo ? "default" : "secondary"}>
                        {horario.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline">{weekdayLabel(horario.diaSemana)}</Badge>
                    </div>
                    <p className="font-semibold">{horario.usuarioNome || horario.usuarioEmail || horario.idUsuario}</p>
                    <p className="text-sm text-muted-foreground">
                      {horario.horaEntrada} - {horario.horaEntradaAlmoco} / {horario.horaRetornoAlmoco} - {horario.horaSaida}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-transparent"
                    onClick={() => setActive(horario.id, !horario.ativo)}
                  >
                    {horario.ativo ? "Inativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
