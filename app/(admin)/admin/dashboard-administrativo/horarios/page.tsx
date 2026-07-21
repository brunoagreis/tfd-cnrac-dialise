"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CalendarClock, RefreshCw, Save, Search, X } from "lucide-react"
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

type CadastroModo = "fixo" | "diferente"

type DayTimeState = {
  horaEntrada: string
  horaEntradaAlmoco: string
  horaRetornoAlmoco: string
  horaSaida: string
}

const WEEKDAYS = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
]

const DEFAULT_DAYS = WEEKDAYS.map((day) => day.value)

const DEFAULT_TIMES: DayTimeState = {
  horaEntrada: "07:30",
  horaEntradaAlmoco: "11:30",
  horaRetornoAlmoco: "12:30",
  horaSaida: "16:30",
}

function createDefaultDayTimes(): Record<number, DayTimeState> {
  return WEEKDAYS.reduce<Record<number, DayTimeState>>((acc, day) => {
    acc[day.value] = { ...DEFAULT_TIMES }
    return acc
  }, {})
}

function weekdayLabel(value: number) {
  return WEEKDAYS.find((item) => item.value === value)?.label ?? `Dia ${value}`
}

function timeRange(horario: Horario) {
  return `${horario.horaEntrada} - ${horario.horaEntradaAlmoco} / ${horario.horaRetornoAlmoco} - ${horario.horaSaida}`
}

export default function HorariosTrabalhoPage() {
  const { user, isReady } = useAuth()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [search, setSearch] = useState("")

  const [selectedUserId, setSelectedUserId] = useState("")
  const [editingHorarioId, setEditingHorarioId] = useState("")
  const [cadastroModo, setCadastroModo] = useState<CadastroModo>("fixo")
  const [selectedDays, setSelectedDays] = useState<number[]>(DEFAULT_DAYS)
  const [diaSemana, setDiaSemana] = useState("1")
  const [dayTimes, setDayTimes] = useState<Record<number, DayTimeState>>(() => createDefaultDayTimes())

  const [horaEntrada, setHoraEntrada] = useState(DEFAULT_TIMES.horaEntrada)
  const [horaEntradaAlmoco, setHoraEntradaAlmoco] = useState(DEFAULT_TIMES.horaEntradaAlmoco)
  const [horaRetornoAlmoco, setHoraRetornoAlmoco] = useState(DEFAULT_TIMES.horaRetornoAlmoco)
  const [horaSaida, setHoraSaida] = useState(DEFAULT_TIMES.horaSaida)

  const canAccess = useMemo(
    () => hasUserPermission(user as any, "DASHBOARD_ADMINISTRATIVO", "visualizar"),
    [user],
  )

  const grupos = useMemo(() => {
    return usuarios
      .map((usuario) => {
        const userSchedules = horarios
          .filter((horario) => horario.idUsuario === usuario.id)
          .sort((a, b) => {
            if (a.diaSemana !== b.diaSemana) return a.diaSemana - b.diaSemana
            if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
            return Number(b.id) - Number(a.id)
          })

        return {
          usuario,
          horarios: userSchedules,
        }
      })
      .sort((a, b) =>
        (a.usuario.nome || a.usuario.email || a.usuario.id).localeCompare(
          b.usuario.nome || b.usuario.email || b.usuario.id,
          "pt-BR",
        ),
      )
  }, [usuarios, horarios])

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return grupos

    return grupos.filter((group) => {
      const haystack = [
        group.usuario.nome,
        group.usuario.email,
        group.usuario.role,
        group.usuario.perfilCodigo,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [grupos, search])

  const selectedUsuario = useMemo(
    () => usuarios.find((usuario) => usuario.id === selectedUserId) || null,
    [usuarios, selectedUserId],
  )

  const selectedHorarios = useMemo(
    () =>
      horarios
        .filter((horario) => horario.idUsuario === selectedUserId)
        .sort((a, b) => {
          if (a.diaSemana !== b.diaSemana) return a.diaSemana - b.diaSemana
          if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
          return Number(b.id) - Number(a.id)
        }),
    [horarios, selectedUserId],
  )

  async function loadData() {
    try {
      setLoading(true)

      const response = await fetch("/api/admin/dashboard-administrativo/horarios", {
        method: "GET",
        cache: "no-store",
      })

      const json = (await response.json().catch(() => ({}))) as Partial<ApiResponse>

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar horários.")
      }

      setUsuarios(Array.isArray(json.usuarios) ? json.usuarios : [])
      setHorarios(Array.isArray(json.horarios) ? json.horarios : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar horários.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isReady && canAccess) void loadData()
  }, [isReady, canAccess])

  function resetForm() {
    setEditingHorarioId("")
    setCadastroModo("fixo")
    setSelectedDays(DEFAULT_DAYS)
    setDiaSemana("1")
    setDayTimes(createDefaultDayTimes())
    setHoraEntrada(DEFAULT_TIMES.horaEntrada)
    setHoraEntradaAlmoco(DEFAULT_TIMES.horaEntradaAlmoco)
    setHoraRetornoAlmoco(DEFAULT_TIMES.horaRetornoAlmoco)
    setHoraSaida(DEFAULT_TIMES.horaSaida)
  }

  function openUser(usuarioId: string) {
    setSelectedUserId(usuarioId)
    resetForm()
  }

  function closeModal() {
    setSelectedUserId("")
    resetForm()
  }

  function editHorario(horario: Horario) {
    setEditingHorarioId(horario.id)
    setCadastroModo("fixo")
    setSelectedDays([horario.diaSemana])
    setHoraEntrada(horario.horaEntrada)
    setHoraEntradaAlmoco(horario.horaEntradaAlmoco)
    setHoraRetornoAlmoco(horario.horaRetornoAlmoco)
    setHoraSaida(horario.horaSaida)
  }

  function toggleDay(day: number) {
    setSelectedDays((current) => {
      if (current.includes(day)) {
        return current.filter((item) => item !== day)
      }

      return [...current, day].sort((a, b) => a - b)
    })
  }

  function updateDayTime(day: number, field: keyof DayTimeState, value: string) {
    setDayTimes((current) => ({
      ...current,
      [day]: {
        ...(current[day] || DEFAULT_TIMES),
        [field]: value,
      },
    }))
  }

  function buildScheduleItems() {
    if (editingHorarioId) {
      return [
        {
          diaSemana: Number(diaSemana),
          horaEntrada,
          horaEntradaAlmoco,
          horaRetornoAlmoco,
          horaSaida,
        },
      ]
    }

    if (selectedDays.length === 0) {
      throw new Error("Selecione ao menos um dia.")
    }

    if (cadastroModo === "fixo") {
      return selectedDays.map((day) => ({
        diaSemana: day,
        horaEntrada,
        horaEntradaAlmoco,
        horaRetornoAlmoco,
        horaSaida,
      }))
    }

    return selectedDays.map((day) => ({
      diaSemana: day,
      horaEntrada: dayTimes[day]?.horaEntrada || DEFAULT_TIMES.horaEntrada,
      horaEntradaAlmoco: dayTimes[day]?.horaEntradaAlmoco || DEFAULT_TIMES.horaEntradaAlmoco,
      horaRetornoAlmoco: dayTimes[day]?.horaRetornoAlmoco || DEFAULT_TIMES.horaRetornoAlmoco,
      horaSaida: dayTimes[day]?.horaSaida || DEFAULT_TIMES.horaSaida,
    }))
  }

  async function saveSchedule() {
    if (!selectedUsuario) {
      toast.error("Selecione o usuário.")
      return
    }

    let items: ReturnType<typeof buildScheduleItems>

    try {
      items = buildScheduleItems()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Informe os horários.")
      return
    }

    try {
      setSaving(true)

      if (editingHorarioId) {
        await setActive(editingHorarioId, false, false)
      }

      const response = await fetch("/api/admin/dashboard-administrativo/horarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idUsuario: selectedUsuario.id,
          items,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao salvar horário.")
      }

      toast.success(
        editingHorarioId
          ? "Horário editado."
          : items.length === 1
            ? "Horário salvo."
            : `${items.length} horários salvos.`,
      )

      resetForm()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar horário.")
    } finally {
      setSaving(false)
    }
  }

  async function setActive(id: string, ativo: boolean, reload = true) {
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

      if (reload) {
        toast.success(ativo ? "Horário ativado." : "Horário excluído.")
        await loadData()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar horário.")
    }
  }

  if (!isReady) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
  }

  if (!canAccess) {
    return <div className="p-6 text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</div>
  }

  const selectedCount = editingHorarioId ? 1 : selectedDays.length

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Horários de trabalho</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre horários para todos os usuários ativos do sistema.
            </p>
          </div>
        </div>

        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/judicial">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Admin Judicial
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Horários cadastrados</CardTitle>
          <CardDescription>
            Todos os usuários ativos aparecem nesta lista, inclusive os que ainda não possuem horário.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-md">
              <Label>Pesquisar usuário</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Digite nome, e-mail, perfil ou função"
                  className="pl-9"
                />
              </div>
            </div>

            <Button variant="outline" className="bg-transparent" onClick={loadData} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar lista
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário ativo encontrado.</p>
          ) : filteredGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado para a pesquisa.</p>
          ) : (
            <div className="grid gap-3">
              {filteredGroups.map((group) => {
                const ativos = group.horarios.filter((horario) => horario.ativo)
                const nome = group.usuario.nome || group.usuario.email || group.usuario.id

                return (
                  <div key={group.usuario.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div>
                          <p className="font-semibold text-foreground">{nome}</p>
                          <p className="text-sm text-muted-foreground">{group.usuario.email || "E-mail não informado"}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">Perfil: {group.usuario.perfilCodigo || "Não informado"}</Badge>
                          <Badge variant="secondary">Função: {group.usuario.role || "Não informada"}</Badge>
                          <Badge variant={ativos.length > 0 ? "default" : "secondary"}>
                            {ativos.length} ativo(s) / {group.horarios.length} total
                          </Badge>
                        </div>

                        {group.horarios.length === 0 ? (
                          <p className="text-xs text-amber-600">Usuário ativo sem horário cadastrado.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {ativos.slice(0, 5).map((horario) => (
                              <Badge key={horario.id} variant="outline">
                                {weekdayLabel(horario.diaSemana)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button onClick={() => openUser(group.usuario.id)}>
                        Cadastrar / Ver horários
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUsuario ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  Horários de {selectedUsuario.nome || selectedUsuario.email}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cadastre horário fixo para vários dias ou horários diferentes por dia.
                </p>
              </div>

              <Button variant="ghost" size="icon" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Card className="mb-4">
              <CardHeader>
                <CardTitle>{editingHorarioId ? "Editar horário" : "Novo cadastro de horários"}</CardTitle>
                <CardDescription>
                  {editingHorarioId
                    ? "A edição altera apenas o horário selecionado."
                    : "Escolha horário fixo para vários dias ou personalize cada dia."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {!editingHorarioId ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setCadastroModo("fixo")}
                        className={`rounded-xl border p-4 text-left transition ${
                          cadastroModo === "fixo" ? "border-primary bg-primary/10" : "border-border"
                        }`}
                      >
                        <p className="font-semibold">Horário fixo para os dias selecionados</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Exemplo: segunda a sexta das 07:30 às 11:30 e das 12:30 às 16:30.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCadastroModo("diferente")}
                        className={`rounded-xl border p-4 text-left transition ${
                          cadastroModo === "diferente" ? "border-primary bg-primary/10" : "border-border"
                        }`}
                      >
                        <p className="font-semibold">Horário diferente por dia</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Permite cadastrar horários diferentes para cada dia da semana.
                        </p>
                      </button>
                    </div>

                    <div>
                      <Label>Dias a cadastrar</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {WEEKDAYS.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDay(day.value)}
                            className={`rounded-full border px-3 py-1 text-sm ${
                              selectedDays.includes(day.value)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background"
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {editingHorarioId || cadastroModo === "fixo" ? (
                  <div className="grid gap-3 md:grid-cols-5">
                    <div>
                      <Label>Dia</Label>
                      <select
                        value={diaSemana}
                        onChange={(event) => setDiaSemana(event.target.value)}
                        disabled={!editingHorarioId}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                      >
                        {WEEKDAYS.map((day) => (
                          <option key={day.value} value={day.value}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                      {!editingHorarioId ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          No modo fixo, este campo é aplicado aos dias selecionados acima.
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <Label>Entrada</Label>
                      <Input type="time" value={horaEntrada} onChange={(event) => setHoraEntrada(event.target.value)} />
                    </div>

                    <div>
                      <Label>Saída almoço</Label>
                      <Input
                        type="time"
                        value={horaEntradaAlmoco}
                        onChange={(event) => setHoraEntradaAlmoco(event.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Retorno almoço</Label>
                      <Input
                        type="time"
                        value={horaRetornoAlmoco}
                        onChange={(event) => setHoraRetornoAlmoco(event.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Saída</Label>
                      <Input type="time" value={horaSaida} onChange={(event) => setHoraSaida(event.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {WEEKDAYS.map((day) => {
                      const enabled = selectedDays.includes(day.value)
                      const times = dayTimes[day.value] || DEFAULT_TIMES

                      return (
                        <div key={day.value} className={`rounded-xl border p-3 ${enabled ? "bg-background" : "opacity-60"}`}>
                          <div className="mb-3 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => toggleDay(day.value)}
                              className="h-4 w-4"
                            />
                            <p className="font-medium">{day.label}</p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-4">
                            <div>
                              <Label>Entrada</Label>
                              <Input
                                type="time"
                                value={times.horaEntrada}
                                disabled={!enabled}
                                onChange={(event) => updateDayTime(day.value, "horaEntrada", event.target.value)}
                              />
                            </div>

                            <div>
                              <Label>Saída almoço</Label>
                              <Input
                                type="time"
                                value={times.horaEntradaAlmoco}
                                disabled={!enabled}
                                onChange={(event) => updateDayTime(day.value, "horaEntradaAlmoco", event.target.value)}
                              />
                            </div>

                            <div>
                              <Label>Retorno almoço</Label>
                              <Input
                                type="time"
                                value={times.horaRetornoAlmoco}
                                disabled={!enabled}
                                onChange={(event) => updateDayTime(day.value, "horaRetornoAlmoco", event.target.value)}
                              />
                            </div>

                            <div>
                              <Label>Saída</Label>
                              <Input
                                type="time"
                                value={times.horaSaida}
                                disabled={!enabled}
                                onChange={(event) => updateDayTime(day.value, "horaSaida", event.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveSchedule} disabled={saving || selectedCount === 0}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving
                      ? "Salvando..."
                      : editingHorarioId
                        ? "Salvar edição"
                        : cadastroModo === "fixo"
                          ? `Salvar ${selectedCount} dia(s) com horário fixo`
                          : `Salvar ${selectedCount} dia(s) com horários diferentes`}
                  </Button>

                  {editingHorarioId ? (
                    <Button variant="outline" className="bg-transparent" onClick={resetForm}>
                      Cancelar edição
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {selectedHorarios.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Este usuário ainda não possui horários cadastrados.
                </p>
              ) : (
                selectedHorarios.map((horario) => (
                  <div key={horario.id} className="rounded-xl border p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="mb-1 flex flex-wrap gap-2">
                          <Badge variant={horario.ativo ? "default" : "secondary"}>
                            {horario.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge variant="outline">{weekdayLabel(horario.diaSemana)}</Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">{timeRange(horario)}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="bg-transparent" onClick={() => editHorario(horario)}>
                          Editar
                        </Button>

                        <Button variant="destructive" onClick={() => setActive(horario.id, false)}>
                          Excluir
                        </Button>

                        {!horario.ativo ? (
                          <Button variant="outline" className="bg-transparent" onClick={() => setActive(horario.id, true)}>
                            Ativar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
