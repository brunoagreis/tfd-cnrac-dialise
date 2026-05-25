"use client"

import React from "react"
import Link from "next/link"
import {
  FileText,
  ClipboardList,
  Stethoscope,
  ShieldAlert,
  ArrowRight,
  Users,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Scale,
  CalendarRange,
  Settings,
  Gavel,
  BarChart3,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { usePermissions } from "@/lib/permissions"
import { useStore } from "@/lib/store-context"
import { useJudicial } from "@/lib/judicial-context"
import { usePreJudicial } from "@/lib/pre-judicial-context"
import {
  canAccessJudicialAdmin,
  canAccessJudicialModule,
  canAccessSchedulingModule,
} from "@/lib/judicial-access"
import { MODULES, MODULE_LABELS, type Module } from "@/lib/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const MODULE_ICONS: Record<
  Module,
  React.ComponentType<{ className?: string }>
> = {
  tfd: FileText,
  cnrac: ClipboardList,
  hemodialise: Stethoscope,
}

const MODULE_DESCRIPTIONS: Record<Module, string> = {
  tfd: "Tratamento Fora de Domicílio - gerencie solicitações e laudos de TFD.",
  cnrac: "Central Nacional de Regulação de Alta Complexidade.",
  hemodialise: "Gestão de pacientes e sessões de hemodiálise.",
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const store = useStore()
  const judicial = useJudicial()
  const preJudicial = usePreJudicial()

  if (!user) return null

  const isUnit = user.role === "UNIDADE_HOSPITALAR"
  const { stats } = store

  const filteredDemandas = isUnit
    ? store.demandas.filter(
        (d) => d.emailSolicitante.toLowerCase() === user.email.toLowerCase(),
      )
    : store.demandas

  const judicialQueue = isUnit
    ? judicial.getMunicipalityCases(user)
    : judicial.getDailyQueueForUser(user, 30)

  const preJudicialQueue = preJudicial.getDailyQueueForUser(user, 30)

  const canSeeJudicial = canAccessJudicialModule(user) || user.role === "ADMIN"
  const canSeeScheduling =
    canAccessSchedulingModule(user) || user.role === "ADMIN"
  const canSeeReports = true

  const schedulingQueue = canSeeScheduling
    ? [...judicial.getSchedulingQueue(), ...preJudicial.getSchedulingQueue()]
    : []

  const cards = [
    ...MODULES.filter((mod) => hasPermission(user.role, mod, "visualizar")).map(
      (mod) => ({
        label: MODULE_LABELS[mod],
        description: MODULE_DESCRIPTIONS[mod],
        href: `/${mod}`,
        icon: MODULE_ICONS[mod],
        badge: `${stats[mod].total} demanda(s)`,
      }),
    ),

    ...(canSeeJudicial
      ? [
          {
            label: "Judicial",
            description: "Monitoramento de ações judiciais.",
            href: "/judicial",
            icon: Scale,
            badge: `${judicialQueue.length} na fila`,
          },
        ]
      : []),

    ...(canSeeJudicial
      ? [
          {
            label: "Pré Judicial",
            description:
              "Prazos, interação e retorno automático da fila.",
            href: "/pre-judicial",
            icon: Gavel,
            badge: `${preJudicialQueue.length} na fila`,
          },
        ]
      : []),

    ...(canSeeScheduling
      ? [
          {
            label: "Agendamento da Demanda",
            description:
              "Reserva, agenda e devolução ao fluxo de origem.",
            href: "/agendamento-demanda",
            icon: CalendarRange,
            badge: `${schedulingQueue.length} em análise`,
          },
        ]
      : []),

    ...(canSeeReports
      ? [
          {
            label: "Relatórios",
            description:
              "Emissão de relatórios por módulo com filtros, Excel e PDF.",
            href: "/relatorios",
            icon: BarChart3,
            badge: "Excel / PDF",
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
          {"Bem-vindo, " + user.nome.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isUnit
            ? "Acompanhe suas solicitações e demandas."
            : "Selecione um módulo para começar a trabalhar."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {isUnit ? "Total Demandas" : "Pacientes"}
              </p>
              <p className="text-2xl font-bold text-card-foreground">
                {isUnit ? filteredDemandas.length : stats.totalPacientes}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold text-card-foreground">
                {isUnit
                  ? filteredDemandas.filter((d) => d.status === "pendente")
                      .length
                  : stats.tfd.pendente +
                    stats.cnrac.pendente +
                    stats.hemodialise.pendente +
                    judicialQueue.length +
                    preJudicialQueue.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resolvidas</p>
              <p className="text-2xl font-bold text-card-foreground">
                {isUnit
                  ? filteredDemandas.filter((d) => d.status === "resolvido")
                      .length
                  : store.demandas.filter((d) => d.status === "resolvido")
                      .length +
                    judicial.cases.filter((c) => c.status === "cumprido")
                      .length +
                    preJudicial.cases.filter((c) => c.status === "resolvido")
                      .length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <RotateCcw className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Risco / prazo</p>
              <p className="text-2xl font-bold text-card-foreground">
                {judicial.cases.filter((c) =>
                  ["descumprido", "inercia_municipio"].includes(c.status),
                ).length +
                  preJudicial.cases.filter((c) =>
                    ["nao_resolvido_setor"].includes(c.status),
                  ).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <Card
              key={card.href}
              className="group relative overflow-hidden border-border transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="outline">{card.badge}</Badge>
                </div>

                <CardTitle className="mt-3 text-base text-card-foreground">
                  {card.label}
                </CardTitle>

                <CardDescription className="text-sm">
                  {card.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Acessar módulo
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-card-foreground">
            Acesso Rápido
          </CardTitle>
          <CardDescription>
            Ações frequentes para agilizar seu trabalho.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-3">
            {!isUnit && (
              <>
                <Link
                  href="/pacientes"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
                >
                  <Users className="h-4 w-4 text-primary" />
                  Cadastrar Paciente
                </Link>

                <Link
                  href="/judicial"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
                >
                  <Scale className="h-4 w-4 text-primary" />
                  Fila Judicial
                </Link>

                <Link
                  href="/pre-judicial"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
                >
                  <Gavel className="h-4 w-4 text-primary" />
                  Fila Pré Judicial
                </Link>
              </>
            )}

            {canSeeScheduling && (
              <Link
                href="/agendamento-demanda"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <CalendarRange className="h-4 w-4 text-primary" />
                Agendamento da Demanda
              </Link>
            )}

            {canSeeReports && (
              <Link
                href="/relatorios"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <BarChart3 className="h-4 w-4 text-primary" />
                Relatórios
              </Link>
            )}

            {canAccessJudicialAdmin(user) && (
              <Link
                href="/admin/judicial"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <Settings className="h-4 w-4 text-primary" />
                Admin Judicial
              </Link>
            )}

            {user.role === "ADMIN" && (
              <Link
                href="/admin/usuarios"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <ShieldAlert className="h-4 w-4 text-primary" />
                Gerenciar Usuários
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}