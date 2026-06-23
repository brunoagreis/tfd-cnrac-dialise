"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gavel,
  RefreshCcw,
  Scale,
  Settings,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  getUserPerfilCodigo,
  hasUserPermission,
  isAdminUser,
} from "@/lib/access-control"
import { MODULES, MODULE_LABELS, type Module } from "@/lib/types"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type DashboardModuleSummary = {
  total: number
  pendentes: number
  resolvidas: number
  fila: number
}

type DashboardSummary = {
  pacientes: number
  pendentes: number
  resolvidas: number
  riscoPrazo: number
  agendamento: number
  modules: Record<string, DashboardModuleSummary>
}

type DashboardCard = {
  label: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge: string
}

const EMPTY_MODULE: DashboardModuleSummary = {
  total: 0,
  pendentes: 0,
  resolvidas: 0,
  fila: 0,
}

const MODULE_ICONS: Record<Module, React.ComponentType<{ className?: string }>> = {
  tfd: FileText,
  cnrac: ClipboardList,
  hemodialise: Stethoscope,
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

function firstName(user: any) {
  const name = String(user?.nome ?? user?.name ?? "Usuário").trim()
  return name.split(" ")[0] || "Usuário"
}

function numberLabel(value: unknown) {
  if (value === null || value === undefined) return "-"
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return "0"
  return String(parsed)
}

function moduleSummary(summary: DashboardSummary | null, module: string) {
  return summary?.modules?.[module] ?? EMPTY_MODULE
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSummary() {
      try {
        setLoadingSummary(true)
        const response = await fetch("/api/dashboard/summary", { cache: "no-store" })
        const json = await response.json().catch(() => ({}))
        if (active && response.ok && json?.ok && json?.summary) {
          setSummary(json.summary)
        }
      } catch (error) {
        console.error("DASHBOARD_SUMMARY_LOAD_ERROR", error)
      } finally {
        if (active) setLoadingSummary(false)
      }
    }

    void loadSummary()

    return () => {
      active = false
    }
  }, [])

  const cards = useMemo(() => {
    if (!user) return []

    const currentUser = user as any
    const canSeeJudicial = hasUserPermission(currentUser, "JUDICIAL", "visualizar")
    const canSeePreJudicial = hasUserPermission(currentUser, "PRE_JUDICIAL", "visualizar")
    const canSeeScheduling = hasUserPermission(currentUser, "AGENDAMENTO", "visualizar")
    const canSeeRelatorios = hasUserPermission(currentUser, "RELATORIOS", "visualizar")

    const moduleCards: DashboardCard[] = MODULES.filter((mod) =>
      hasUserPermission(currentUser, mod, "visualizar"),
    ).map((mod) => {
      const module = moduleSummary(summary, mod)
      return {
        label: MODULE_LABELS[mod],
        description: MODULE_DESCRIPTIONS[mod],
        href: `/${mod}`,
        icon: MODULE_ICONS[mod],
        badge: `${module.total} demanda(s)`,
      }
    })

    return [
      ...moduleCards,
      ...(canSeeJudicial
        ? [
            {
              label: "Judicial",
              description: "Monitoramento de ações judiciais.",
              href: "/judicial",
              icon: Scale,
              badge: `${moduleSummary(summary, "judicial").fila || moduleSummary(summary, "judicial").pendentes} na fila`,
            },
          ]
        : []),
      ...(canSeePreJudicial
        ? [
            {
              label: "Pré Judicial",
              description: "Prazos, interação e retorno automático da fila.",
              href: "/pre-judicial",
              icon: Gavel,
              badge: `${moduleSummary(summary, "pre_judicial").fila || moduleSummary(summary, "pre_judicial").pendentes} na fila`,
            },
          ]
        : []),
      ...(canSeeScheduling
        ? [
            {
              label: "Agendamento da Demanda",
              description: "Reserva, agenda e devolução ao fluxo de origem.",
              href: "/agendamento-demanda",
              icon: CalendarDays,
              badge: `${summary?.agendamento ?? 0} em análise`,
            },
          ]
        : []),
      ...(canSeeRelatorios
        ? [
            {
              label: "Relatórios",
              description: "Emissão de relatórios por módulo com filtros, Excel e PDF.",
              href: "/relatorios",
              icon: BarChart3,
              badge: "Excel / PDF",
            },
          ]
        : []),
    ]
  }, [summary, user])

  if (!user) return null

  const currentUser = user as any
  const isAdmin = isAdminUser(currentUser)
  const isUnit = isUnitUser(currentUser)

  const canSeePacientes = hasUserPermission(currentUser, "PACIENTES", "visualizar")
  const canSeeJudicial = hasUserPermission(currentUser, "JUDICIAL", "visualizar")
  const canSeePreJudicial = hasUserPermission(currentUser, "PRE_JUDICIAL", "visualizar")
  const canSeeScheduling = hasUserPermission(currentUser, "AGENDAMENTO", "visualizar")
  const canSeeRelatorios = hasUserPermission(currentUser, "RELATORIOS", "visualizar")
  const canSeeAdminJudicial = hasUserPermission(currentUser, "ADMIN_JUDICIAL", "visualizar")

  const topCards = [
    {
      label: isUnit ? "Total Demandas" : "Pacientes",
      value: numberLabel(summary?.pacientes),
      icon: Users,
      iconClassName: "text-primary",
      bgClassName: "bg-primary/10",
    },
    {
      label: "Pendentes",
      value: numberLabel(summary?.pendentes),
      icon: AlertTriangle,
      iconClassName: "text-amber-600",
      bgClassName: "bg-amber-500/10",
    },
    {
      label: "Resolvidas",
      value: numberLabel(summary?.resolvidas),
      icon: CheckCircle2,
      iconClassName: "text-emerald-600",
      bgClassName: "bg-emerald-500/10",
    },
    {
      label: "Risco / prazo",
      value: numberLabel(summary?.riscoPrazo),
      icon: RefreshCcw,
      iconClassName: "text-destructive",
      bgClassName: "bg-destructive/10",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
          {"Bem-vindo, " + firstName(user)}
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          {isUnit
            ? "Acompanhe suas solicitações e demandas."
            : "Selecione um módulo para começar a trabalhar."}
          {loadingSummary ? " Atualizando indicadores..." : null}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {topCards.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} className="border-border">
              <CardContent className="flex items-center gap-3 pt-6">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.bgClassName}`}>
                  <Icon className={`h-5 w-5 ${item.iconClassName}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-bold text-card-foreground">{item.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
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
          <CardTitle className="text-base text-card-foreground">Acesso Rápido</CardTitle>
          <CardDescription>Ações frequentes para agilizar seu trabalho.</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-3">
            {!isUnit && canSeePacientes && (
              <QuickLink href="/pacientes" icon={Users} label="Cadastrar Paciente" />
            )}
            {!isUnit && canSeeJudicial && (
              <QuickLink href="/judicial" icon={Scale} label="Fila Judicial" />
            )}
            {!isUnit && canSeePreJudicial && (
              <QuickLink href="/pre-judicial" icon={Gavel} label="Fila Pré Judicial" />
            )}
            {canSeeScheduling && (
              <QuickLink href="/agendamento-demanda" icon={CalendarDays} label="Agendamento da Demanda" />
            )}
            {canSeeRelatorios && (
              <QuickLink href="/relatorios" icon={BarChart3} label="Relatórios" />
            )}
            {canSeeAdminJudicial && (
              <QuickLink href="/admin/judicial" icon={Settings} label="Admin Judicial" />
            )}
            {isAdmin && (
              <QuickLink href="/admin/usuarios" icon={ShieldAlert} label="Gerenciar Usuários" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
    >
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </Link>
  )
}
