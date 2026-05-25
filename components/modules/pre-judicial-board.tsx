"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, Search } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { usePreJudicial } from "@/lib/pre-judicial-context"
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

export function PreJudicialBoard() {
  const { user } = useAuth()
  const pre = usePreJudicial()
  const [search, setSearch] = useState("")
  const [reason, setReason] = useState("todos")
  const [status, setStatus] = useState("todos")

  const all = pre.getDailyQueueForUser(user, 30)

  const filtered = useMemo(
    () =>
      all.filter((item) => {
        if (reason !== "todos" && item.queueReason !== reason) return false
        if (status !== "todos" && item.status !== status) return false

        if (search.trim()) {
          const q = search.toLowerCase()
          const hay =
            `${item.patientName} ${item.cpf} ${item.protocolNumber} ${item.originProtocol} ${item.municipalityName}`.toLowerCase()

          if (!hay.includes(q)) return false
        }

        return true
      }),
    [all, reason, search, status],
  )

  const stats = {
    total: all.length,
    criticos: all.filter((item) =>
      [
        "prazo_critico",
        "prazo_hoje",
        "prazo_vencido",
        "retorno_automatico",
      ].includes(item.queueReason),
    ).length,
    scheduling: pre.getSchedulingQueue().length,
    resolvidos: pre.cases.filter((item) => item.status === "resolvido").length,
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
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 pl-9"
                  placeholder="Buscar por paciente, CPF, protocolo ou município..."
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

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhuma demanda encontrada com os filtros atuais.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((item) => {
                const resposta =
                  item.schedulingStatus === "fora_fila"
                    ? "Fila interna"
                    : item.schedulingStatus === "reservado"
                      ? "Reserva"
                      : "Agendamento"

                const criticidade =
                  item.deadlineWarningLevel === "overdue"
                    ? "Vencido"
                    : item.deadlineWarningLevel === "critical"
                      ? "Crítico"
                      : item.deadlineWarningLevel === "warning"
                        ? "Atenção"
                        : "Regular"

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
                            {PREJUDICIAL_QUEUE_REASON_LABELS[item.queueReason]}
                          </Badge>

                          <Badge variant="outline" className="text-xs">
                            {PREJUDICIAL_STATUS_LABELS[item.status]}
                          </Badge>

                          <Badge variant="outline" className="text-xs">
                            {item.originModule.toUpperCase()}
                          </Badge>
                        </div>

                        <p className="mt-1 text-lg font-semibold leading-tight text-foreground">
                          {item.patientName}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">CPF:</span>{" "}
                          {item.cpf}
                          {" | "}
                          <span className="font-medium text-foreground">
                            Protocolo:
                          </span>{" "}
                          {item.protocolNumber}
                          {" | "}
                          <span className="font-medium text-foreground">
                            Origem:
                          </span>{" "}
                          {item.originProtocol}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Município:
                          </span>{" "}
                          {item.municipalityName}
                        </p>

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
                            {resposta}
                          </span>

                          <span>
                            <span className="font-medium text-foreground">
                              Criticidade:
                            </span>{" "}
                            {criticidade}
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
        </CardContent>
      </Card>
    </div>
  )
}