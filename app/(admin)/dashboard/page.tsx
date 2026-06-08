// @ts-nocheck
"use client"

import React from "react"
import Link from "next/link"

import { useAuth } from "@/lib/auth-context"
import {
  getUserPerfilCodigo,
  hasUserPermission,
  isAdminUser,
} from "@/lib/access-control"
import { useStore } from "@/lib/store-context"
import { useJudicial } from "@/lib/judicial-context"
import { usePreJudicial } from "@/lib/pre-judicial-context"
import { MODULES, MODULE_LABELS, type Module } from "@/lib/types"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function IconBase({
  className,
  children,
}: {
  className?: string
  children: any
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </IconBase>
  )
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
      <path d="M8 12h8" />
      <path d="M8 16h6" />
    </IconBase>
  )
}

function StethoscopeIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M6 3v5a6 6 0 0 0 12 0V3" />
      <path d="M6 3H4" />
      <path d="M18 3h2" />
      <path d="M12 14v2a4 4 0 0 0 8 0v-1" />
      <circle cx="20" cy="15" r="2" />
    </IconBase>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconBase>
  )
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconBase>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  )
}

function RotateIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M21 12a9 9 0 0 1-15.5 6.3" />
      <path d="M3 12A9 9 0 0 1 18.5 5.7" />
      <path d="M18 2v5h-5" />
      <path d="M6 22v-5h5" />
    </IconBase>
  )
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 3v18" />
      <path d="M5 6h14" />
      <path d="M6 6 3 14h6L6 6Z" />
      <path d="M18 6 15 14h6l-3-8Z" />
    </IconBase>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </IconBase>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 20 7.1l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </IconBase>
  )
}

function GavelIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="m14 13-7 7" />
      <path d="m8 8 8 8" />
      <path d="m12 4 8 8" />
      <path d="m4 12 8-8" />
      <path d="m2 22 6-6" />
    </IconBase>
  )
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M3 3v18h18" />
      <path d="M7 16v-5" />
      <path d="M12 16V7" />
      <path d="M17 16v-8" />
    </IconBase>
  )
}

function ShieldAlertIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
    </IconBase>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </IconBase>
  )
}

const MODULE_ICONS: Record<
  Module,
  React.ComponentType<{ className?: string }>
> = {
  tfd: FileTextIcon,
  cnrac: ClipboardIcon,
  hemodialise: StethoscopeIcon,
}

const MODULE_DESCRIPTIONS: Record<Module, string> = {
  tfd: "Tratamento Fora de Domicílio - gerencie solicitações e laudos de TFD.",
  cnrac: "Central Nacional de Regulação de Alta Complexidade.",
  hemodialise: "Gestão de pacientes e sessões de hemodiálise.",
}

function isUnitUser(user: any) {
  const perfilCodigo = getUserPerfilCodigo(user)
  const role = String(user?.role ?? "").trim().toUpperCase()

  return (
    perfilCodigo === "UNIDADE" ||
    perfilCodigo === "UNIDADE_HOSPITALAR" ||
    role === "UNIDADE" ||
    role === "UNIDADE_HOSPITALAR"
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const store = useStore()
  const judicial = useJudicial()
  const preJudicial = usePreJudicial()

  if (!user) return null

  const currentUser = user as any
  const isAdmin = isAdminUser(currentUser)
  const isUnit = isUnitUser(currentUser)
  const { stats } = store

  const canSeePacientes = hasUserPermission(currentUser, "PACIENTES", "visualizar")
  const canSeeJudicial = hasUserPermission(currentUser, "JUDICIAL", "visualizar")
  const canSeePreJudicial = hasUserPermission(
    currentUser,
    "PRE_JUDICIAL",
    "visualizar",
  )
  const canSeeScheduling = hasUserPermission(
    currentUser,
    "AGENDAMENTO",
    "visualizar",
  )
  const canSeeRelatorios = hasUserPermission(
    currentUser,
    "RELATORIOS",
    "visualizar",
  )
  const canSeeAdminJudicial = hasUserPermission(
    currentUser,
    "ADMIN_JUDICIAL",
    "visualizar",
  )

  const filteredDemandas = isUnit
    ? store.demandas.filter(
        (d) => d.emailSolicitante.toLowerCase() === user.email.toLowerCase(),
      )
    : store.demandas

  const judicialQueue = canSeeJudicial
    ? isUnit
      ? judicial.getMunicipalityCases(user)
      : judicial.getDailyQueueForUser(user, 30)
    : []

  const preJudicialQueue = canSeePreJudicial
    ? preJudicial.getDailyQueueForUser(user, 30)
    : []

  const schedulingQueue = canSeeScheduling
    ? [
        ...(canSeeJudicial ? judicial.getSchedulingQueue() : []),
        ...(canSeePreJudicial ? preJudicial.getSchedulingQueue() : []),
      ]
    : []

  const moduleCards = MODULES.filter((mod) =>
    hasUserPermission(currentUser, mod, "visualizar"),
  ).map((mod) => ({
    label: MODULE_LABELS[mod],
    description: MODULE_DESCRIPTIONS[mod],
    href: `/${mod}`,
    icon: MODULE_ICONS[mod],
    badge: `${stats[mod].total} demanda(s)`,
  }))

  const cards = [
    ...moduleCards,

    ...(canSeeJudicial
      ? [
          {
            label: "Judicial",
            description: "Monitoramento de ações judiciais.",
            href: "/judicial",
            icon: ScaleIcon,
            badge: `${judicialQueue.length} na fila`,
          },
        ]
      : []),

    ...(canSeePreJudicial
      ? [
          {
            label: "Pré Judicial",
            description: "Prazos, interação e retorno automático da fila.",
            href: "/pre-judicial",
            icon: GavelIcon,
            badge: `${preJudicialQueue.length} na fila`,
          },
        ]
      : []),

    ...(canSeeScheduling
      ? [
          {
            label: "Agendamento da Demanda",
            description: "Reserva, agenda e devolução ao fluxo de origem.",
            href: "/agendamento-demanda",
            icon: CalendarIcon,
            badge: `${schedulingQueue.length} em análise`,
          },
        ]
      : []),

    ...(canSeeRelatorios
      ? [
          {
            label: "Relatórios",
            description:
              "Emissão de relatórios por módulo com filtros, Excel e PDF.",
            href: "/relatorios",
            icon: BarChartIcon,
            badge: "Excel / PDF",
          },
        ]
      : []),
  ]

  const pendingTotal = isUnit
    ? filteredDemandas.filter((d) => d.status === "pendente").length
    : stats.tfd.pendente +
      stats.cnrac.pendente +
      stats.hemodialise.pendente +
      judicialQueue.length +
      preJudicialQueue.length

  const resolvedTotal = isUnit
    ? filteredDemandas.filter((d) => d.status === "resolvido").length
    : store.demandas.filter((d) => d.status === "resolvido").length +
      (canSeeJudicial
        ? judicial.cases.filter((c) => c.status === "cumprido").length
        : 0) +
      (canSeePreJudicial
        ? preJudicial.cases.filter((c) => c.status === "resolvido").length
        : 0)

  const riskTotal =
    (canSeeJudicial
      ? judicial.cases.filter((c) =>
          ["descumprido", "inercia_municipio"].includes(c.status),
        ).length
      : 0) +
    (canSeePreJudicial
      ? preJudicial.cases.filter((c) =>
          ["nao_resolvido_setor"].includes(c.status),
        ).length
      : 0)

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
              <UsersIcon className="h-5 w-5 text-primary" />
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
              <AlertIcon className="h-5 w-5 text-amber-600" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold text-card-foreground">
                {pendingTotal}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckIcon className="h-5 w-5 text-emerald-600" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Resolvidas</p>
              <p className="text-2xl font-bold text-card-foreground">
                {resolvedTotal}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <RotateIcon className="h-5 w-5 text-destructive" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Risco / prazo</p>
              <p className="text-2xl font-bold text-card-foreground">
                {riskTotal}
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
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
            {!isUnit && canSeePacientes && (
              <Link
                href="/pacientes"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <UsersIcon className="h-4 w-4 text-primary" />
                Cadastrar Paciente
              </Link>
            )}

            {!isUnit && canSeeJudicial && (
              <Link
                href="/judicial"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <ScaleIcon className="h-4 w-4 text-primary" />
                Fila Judicial
              </Link>
            )}

            {!isUnit && canSeePreJudicial && (
              <Link
                href="/pre-judicial"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <GavelIcon className="h-4 w-4 text-primary" />
                Fila Pré Judicial
              </Link>
            )}

            {canSeeScheduling && (
              <Link
                href="/agendamento-demanda"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <CalendarIcon className="h-4 w-4 text-primary" />
                Agendamento da Demanda
              </Link>
            )}

            {canSeeRelatorios && (
              <Link
                href="/relatorios"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <BarChartIcon className="h-4 w-4 text-primary" />
                Relatórios
              </Link>
            )}

            {canSeeAdminJudicial && (
              <Link
                href="/admin/judicial"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <SettingsIcon className="h-4 w-4 text-primary" />
                Admin Judicial
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin/usuarios"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <ShieldAlertIcon className="h-4 w-4 text-primary" />
                Gerenciar Usuários
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}