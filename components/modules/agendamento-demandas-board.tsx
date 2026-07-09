"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  CalendarCheck,
  Download,
  Eye,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Send,
  Undo2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type AgendamentoQueueItem = {
  id: string
  modulo: string
  moduloLabel: string
  protocolo: string
  pacienteNome: string
  cpf: string
  municipio: string
  statusAgendamento: "pendente" | "reservado" | string
  statusAgendamentoLabel: string
  statusCaso: string
  solicitadoEm: string
  prazoResposta: string
  prazoLabel: string
  reservadoEm: string
  dataAgendamento: string
  procedimentoCodigo: string
  procedimentoDescricao: string
  cidCodigo: string
  cidDescricao: string
  atualizadoEm: string
  prioridade: number
  detalheHref: string
}

type AgendamentoStats = {
  total: number
  pendentes: number
  reservados: number
  vencidos: number
  preJudicial: number
}

const EMPTY_STATS: AgendamentoStats = {
  total: 0,
  pendentes: 0,
  reservados: 0,
  vencidos: 0,
  preJudicial: 0,
}

function formatDateTime(value: string | undefined) {
  if (!value) return "Não informado"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("pt-BR")
}

function formatDate(value: string | undefined) {
  if (!value) return "Não informado"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString("pt-BR")
}

function isOverdue(value: string | undefined) {
  if (!value) return false

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return false

  return date.getTime() < Date.now()
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "")
  const escaped = text.replaceAll('"', '""')

  return `"${escaped}"`
}

function downloadTextFile(filename: string, content: string, type: string) {
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

export function AgendamentoDemandasBoard() {
  const [supportMaterialFormOpen, setSupportMaterialFormOpen] = useState(false)
  const [supportMaterialListOpen, setSupportMaterialListOpen] = useState(false)
  const [supportMaterialName, setSupportMaterialName] = useState("")
  const [selectedSupportMaterialFile, setSelectedSupportMaterialFile] = useState<File | null>(null)
  const [supportMaterials, setSupportMaterials] = useState<any[]>([])
  const [loadingSupportMaterials, setLoadingSupportMaterials] = useState(false)
  const [savingSupportMaterial, setSavingSupportMaterial] = useState(false)
  const [supportMaterialMessage, setSupportMaterialMessage] = useState("")

  async function loadSupportMaterials() {
    try {
      setLoadingSupportMaterials(true)
      const response = await fetch("/api/agendamento/material-apoio", { cache: "no-store" })
      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao carregar materiais de apoio.")
      }

      setSupportMaterials(Array.isArray(data.materiais) ? data.materiais : [])
    } catch (error) {
      console.error("[AgendamentoDemandasBoard] erro ao carregar material de apoio:", error)
      setSupportMaterialMessage(error instanceof Error ? error.message : "Não foi possível carregar os materiais de apoio.")
    } finally {
      setLoadingSupportMaterials(false)
    }
  }

  useEffect(() => {
    void loadSupportMaterials()
  }, [])

  async function handleSaveSupportMaterial() {
    const nome = supportMaterialName.trim()

    if (!nome) {
      setSupportMaterialMessage("Informe o nome do material de apoio.")
      return
    }

    if (!selectedSupportMaterialFile) {
      setSupportMaterialMessage("Selecione o arquivo do material de apoio.")
      return
    }

    try {
      setSavingSupportMaterial(true)
      setSupportMaterialMessage("")

      const formData = new FormData()
      formData.append("nome", nome)
      formData.append("arquivo", selectedSupportMaterialFile)

      const response = await fetch("/api/agendamento/material-apoio", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao salvar material de apoio.")
      }

      setSupportMaterialName("")
      setSelectedSupportMaterialFile(null)
      setSupportMaterialFormOpen(false)
      setSupportMaterialListOpen(true)
      setSupportMaterialMessage("Material de apoio cadastrado com sucesso.")
      await loadSupportMaterials()
    } catch (error) {
      console.error("[AgendamentoDemandasBoard] erro ao salvar material de apoio:", error)
      setSupportMaterialMessage(error instanceof Error ? error.message : "Não foi possível salvar o material de apoio.")
    } finally {
      setSavingSupportMaterial(false)
    }
  }

  const { user } = useAuth()

  const [items, setItems] = useState<AgendamentoQueueItem[]>([])
  const [stats, setStats] = useState<AgendamentoStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("todos")
  const [origem, setOrigem] = useState("todos")

  const [selectedItem, setSelectedItem] = useState<AgendamentoQueueItem | null>(
    null,
  )
  const [reserveOpen, setReserveOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)

  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleDescription, setScheduleDescription] = useState("")
  const [returnDescription, setReturnDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true)
      setError("")

      const params = new URLSearchParams()

      if (search.trim()) params.set("search", search.trim())
      if (status !== "todos") params.set("status", status)
      if (origem !== "todos") params.set("origem", origem)

      const response = await fetch(
        `/api/agendamento-demanda/fila${
          params.toString() ? `?${params.toString()}` : ""
        }`,
        {
          cache: "no-store",
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Erro ao carregar fila do Agendamento da Demanda.",
        )
      }

      setItems((data.items ?? []) as AgendamentoQueueItem[])
      setStats((data.stats ?? EMPTY_STATS) as AgendamentoStats)
    } catch (err) {
      console.error("[AgendamentoDemandasBoard] erro ao carregar:", err)

      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar fila do Agendamento da Demanda.",
      )
    } finally {
      setLoading(false)
    }
  }, [origem, search, status])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const filteredItems = useMemo(() => {
    return items
  }, [items])

  function getUserPayload() {
    if (!user) {
      return {
        id: "sistema",
        nome: "Sistema",
        email: "",
      }
    }

    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
    }
  }

  async function postPreJudicialMovement(
    item: AgendamentoQueueItem,
    body: Record<string, unknown>,
  ) {
    const response = await fetch(
      `/api/pre-judicial/casos/${encodeURIComponent(item.id)}/movimentacoes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...body,
          user: getUserPayload(),
        }),
      },
    )

    const data = await response.json()

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Erro ao atualizar agendamento.")
    }

    return data
  }

  function openReserve(item: AgendamentoQueueItem) {
    setSelectedItem(item)
    setReserveOpen(true)
  }

  function openSchedule(item: AgendamentoQueueItem) {
    setSelectedItem(item)
    setScheduleDate("")
    setScheduleDescription(
      `Demanda agendada pelo módulo Agendamento da Demanda.`,
    )
    setScheduleOpen(true)
  }

  function openReturn(item: AgendamentoQueueItem) {
    setSelectedItem(item)
    setReturnDescription("")
    setReturnOpen(true)
  }

  async function handleReserve() {
    if (!selectedItem) return

    try {
      setSaving(true)

      await postPreJudicialMovement(selectedItem, {
        type: "reserva_agendamento",
        description: "Demanda reservada pelo Agendamento da Demanda.",
      })

      toast.success("Demanda reservada com sucesso.")
      setReserveOpen(false)
      setSelectedItem(null)
      await loadQueue()
    } catch (err) {
      console.error("[AgendamentoDemandasBoard] erro ao reservar:", err)

      toast.error(
        err instanceof Error ? err.message : "Erro ao reservar demanda.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSchedule() {
    if (!selectedItem) return

    if (!scheduleDate) {
      toast.error("Informe a data do agendamento.")
      return
    }

    if (!scheduleDescription.trim()) {
      toast.error("Informe a descrição do agendamento.")
      return
    }

    try {
      setSaving(true)

      await postPreJudicialMovement(selectedItem, {
        type: "agendado",
        description: scheduleDescription.trim(),
        appointmentDate: scheduleDate,
      })

      toast.success("Agendamento registrado com sucesso.")
      setScheduleOpen(false)
      setSelectedItem(null)
      setScheduleDate("")
      setScheduleDescription("")
      await loadQueue()
    } catch (err) {
      console.error("[AgendamentoDemandasBoard] erro ao agendar:", err)

      toast.error(
        err instanceof Error ? err.message : "Erro ao registrar agendamento.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleReturn() {
    if (!selectedItem) return

    if (!returnDescription.trim()) {
      toast.error("Informe o motivo da devolução.")
      return
    }

    try {
      setSaving(true)

      await postPreJudicialMovement(selectedItem, {
        type: "retorno_fila",
        description: returnDescription.trim(),
      })

      toast.success("Demanda devolvida ao Pré Judicial.")
      setReturnOpen(false)
      setSelectedItem(null)
      setReturnDescription("")
      await loadQueue()
    } catch (err) {
      console.error("[AgendamentoDemandasBoard] erro ao devolver:", err)

      toast.error(
        err instanceof Error ? err.message : "Erro ao devolver demanda.",
      )
    } finally {
      setSaving(false)
    }
  }

  function handleExportCsv() {
    const header = [
      "Modulo",
      "Protocolo",
      "Paciente",
      "CPF",
      "Municipio",
      "Status agendamento",
      "Status caso",
      "Solicitado em",
      "Prazo resposta",
      "Prazo label",
      "Reservado em",
      "Data agendamento",
      "Procedimento",
      "CID",
    ]

    const rows = filteredItems.map((item) => [
      item.moduloLabel,
      item.protocolo,
      item.pacienteNome,
      item.cpf,
      item.municipio,
      item.statusAgendamentoLabel,
      item.statusCaso,
      item.solicitadoEm,
      item.prazoResposta,
      item.prazoLabel,
      item.reservadoEm,
      item.dataAgendamento,
      `${item.procedimentoCodigo} - ${item.procedimentoDescricao}`.trim(),
      `${item.cidCodigo} - ${item.cidDescricao}`.trim(),
    ])

    const csv = [
      header.map(escapeCsv).join(";"),
      ...rows.map((row) => row.map(escapeCsv).join(";")),
    ].join("\n")

    downloadTextFile(
      `fila-agendamento-demanda-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,
      `\uFEFF${csv}`,
      "text/csv;charset=utf-8",
    )
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">
                Fila do agendamento
              </p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-3xl font-bold text-amber-600">
                {stats.pendentes}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Reservados</p>
              <p className="text-3xl font-bold text-sky-600">
                {stats.reservados}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Prazos vencidos</p>
              <p className="text-3xl font-bold text-destructive">
                {stats.vencidos}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <CardTitle>Fila ativa do agendamento</CardTitle>
                <CardDescription>
                  Demandas enviadas pelo Judicial e Pré Judicial para reserva,
                  agendamento e devolução ao monitoramento.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-transparent"
                  onClick={loadQueue}
                  disabled={loading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="bg-transparent"
                  onClick={handleExportCsv}
                  disabled={filteredItems.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px] lg:items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Buscar</Label>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") loadQueue()
                    }}
                    className="h-10 pl-9"
                    placeholder="Buscar por paciente, município, procedimento, CPF ou protocolo..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Status
                </Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="reservado">Reservado</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Origem
                </Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={origem}
                  onChange={(event) => setOrigem(event.target.value)}
                >
                  <option value="todos">Todas</option>
                  <option value="pre_judicial">Pré Judicial</option>
                  <option value="judicial">Judicial</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Carregando fila real do Agendamento da Demanda...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-dashed border-destructive/40 p-10 text-center text-sm text-destructive">
                {error}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Nenhuma demanda disponível para agendamento.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const overdue = isOverdue(item.prazoResposta)

                  return (
                    <div
                      key={`${item.modulo}-${item.id}`}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold">
                              {item.protocolo}
                            </span>

                            <Badge variant="outline">{item.moduloLabel}</Badge>

                            <Badge
                              variant={
                                item.statusAgendamento === "pendente"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {item.statusAgendamentoLabel}
                            </Badge>

                            {overdue ? (
                              <Badge variant="destructive">
                                Prazo vencido
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {item.prazoLabel}
                              </Badge>
                            )}
                          </div>

                          <p className="text-lg font-bold leading-tight text-foreground">
                            {item.pacienteNome}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              CPF:
                            </span>{" "}
                            {item.cpf || "Não informado"}
                            {" | "}
                            <span className="font-medium text-foreground">
                              Município:
                            </span>{" "}
                            {item.municipio || "Não informado"}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              Procedimento:
                            </span>{" "}
                            {item.procedimentoCodigo
                              ? `${item.procedimentoCodigo} - ${item.procedimentoDescricao}`
                              : "Não informado"}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              CID:
                            </span>{" "}
                            {item.cidCodigo
                              ? `${item.cidCodigo} - ${item.cidDescricao}`
                              : "Não informado"}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              <span className="font-medium text-foreground">
                                Solicitado:
                              </span>{" "}
                              {formatDateTime(item.solicitadoEm)}
                            </span>

                            <span>
                              <span className="font-medium text-foreground">
                                Prazo:
                              </span>{" "}
                              {formatDateTime(item.prazoResposta)}
                            </span>

                            {item.reservadoEm && (
                              <span>
                                <span className="font-medium text-foreground">
                                  Reservado:
                                </span>{" "}
                                {formatDateTime(item.reservadoEm)}
                              </span>
                            )}

                            {item.dataAgendamento && (
                              <span>
                                <span className="font-medium text-foreground">
                                  Agendado:
                                </span>{" "}
                                {formatDateTime(item.dataAgendamento)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                            onClick={() => openReserve(item)}
                            disabled={item.statusAgendamento === "reservado"}
                          >
                            <CalendarCheck className="mr-2 h-4 w-4" />
                            Reservar
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openSchedule(item)}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Agendar
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                            onClick={() => openReturn(item)}
                          >
                            <Undo2 className="mr-2 h-4 w-4" />
                            Devolver
                          </Button>

                          <Button
                            asChild
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                          >
                            <Link href={item.detalheHref}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver origem
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Resumo do setor</CardTitle>
            <CardDescription>
              Dados carregados diretamente do banco de dados.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pré Judicial</span>
              <Badge variant="outline">{stats.preJudicial}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pendentes</span>
              <Badge variant="secondary">{stats.pendentes}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reservados</span>
              <Badge variant="outline">{stats.reservados}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vencidos</span>
              <Badge variant={stats.vencidos > 0 ? "destructive" : "outline"}>
                {stats.vencidos}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Integração ativa</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              Quando o Pré Judicial registra{" "}
              <span className="font-medium text-foreground">
                Envio ao Agendamento da Demanda
              </span>
              , a demanda entra automaticamente nesta fila.
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              Reservar, Agendar e Devolver gravam movimentação no caso de origem
              e atualizam o status no banco.
            </div>

            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-foreground">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                MATERIAL DE APOIO
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Arquivos de orientação usados pelo setor de Agendamento da Demanda.
              </p>

              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={() => setSupportMaterialFormOpen((value) => !value)}
                >
                  Cadastrar material
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => setSupportMaterialListOpen((value) => !value)}
                >
                  Visualizar materiais
                </Button>
              </div>

              {supportMaterialFormOpen ? (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-2">
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                    placeholder="Nome do material"
                    value={supportMaterialName}
                    onChange={(event) => setSupportMaterialName(event.target.value)}
                  />

                  <input
                    type="file"
                    className="flex w-full rounded-md border border-input bg-background px-2 py-2 text-xs"
                    onChange={(event) => setSelectedSupportMaterialFile(event.target.files?.[0] || null)}
                  />

                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={savingSupportMaterial}
                    onClick={handleSaveSupportMaterial}
                  >
                    {savingSupportMaterial ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              ) : null}

              {supportMaterialMessage ? (
                <p className="mt-2 rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
                  {supportMaterialMessage}
                </p>
              ) : null}

              {supportMaterialListOpen ? (
                <div className="mt-3 space-y-2">
                  {loadingSupportMaterials ? (
                    <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">Carregando...</p>
                  ) : supportMaterials.length === 0 ? (
                    <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">Nenhum material cadastrado.</p>
                  ) : (
                    supportMaterials.map((material: any) => (
                      <div key={material.id} className="rounded-md border border-border bg-background p-2">
                        <p className="text-xs font-medium text-foreground">{material.nome || "Material de apoio"}</p>
                        <p className="text-xs text-muted-foreground">{material.arquivoNome || "Arquivo"}</p>
                        <Button asChild type="button" size="sm" variant="outline" className="mt-2 w-full bg-transparent">
                          <a href={String(material.url || "#")} target="_blank" rel="noreferrer">Visualizar arquivo</a>
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full bg-transparent"
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar fila
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservar demanda</DialogTitle>
            <DialogDescription>
              A demanda será marcada como reservada no banco e continuará
              disponível no Agendamento da Demanda como reserva.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">{selectedItem?.pacienteNome}</p>
            <p className="text-muted-foreground">
              {selectedItem?.protocolo} • {selectedItem?.moduloLabel}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="bg-transparent"
              onClick={() => setReserveOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button type="button" onClick={handleReserve} disabled={saving}>
              {saving ? "Salvando..." : "Confirmar reserva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar agendamento</DialogTitle>
            <DialogDescription>
              Ao confirmar, a demanda sai da fila do Agendamento da Demanda e
              retorna ao caso de origem com movimentação registrada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs">
                Data e hora do agendamento
              </Label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">Descrição</Label>
              <Textarea
                rows={4}
                value={scheduleDescription}
                onChange={(event) =>
                  setScheduleDescription(event.target.value)
                }
                placeholder="Descreva o agendamento realizado."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="bg-transparent"
              onClick={() => setScheduleOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button type="button" onClick={handleSchedule} disabled={saving}>
              {saving ? "Salvando..." : "Salvar agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver demanda</DialogTitle>
            <DialogDescription>
              A demanda será retirada da fila do Agendamento da Demanda e
              devolvida ao Pré Judicial com justificativa.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label className="mb-1 block text-xs">Motivo da devolução</Label>
            <Textarea
              rows={5}
              value={returnDescription}
              onChange={(event) => setReturnDescription(event.target.value)}
              placeholder="Informe o motivo da devolução."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="bg-transparent"
              onClick={() => setReturnOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button type="button" onClick={handleReturn} disabled={saving}>
              {saving ? "Salvando..." : "Devolver ao Pré Judicial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}