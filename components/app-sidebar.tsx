"use client"

import React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Stethoscope,
  ShieldCheck,
  User,
  Users,
  UserPlus,
  Building2,
  LogOut,
  Scale,
  CalendarRange,
  Settings,
  Gavel,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  BarChart3,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { usePermissions } from "@/lib/permissions"
import {
  canAccessJudicialAdmin,
  canAccessJudicialModule,
  canAccessSchedulingModule,
} from "@/lib/judicial-access"
import type { Module } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  module?: Module
  adminOnly?: boolean
  section?: string
  hideForUnit?: boolean
  predicate?: () => boolean
}

interface AppSidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function AppSidebar({
  collapsed = false,
  onToggleCollapse,
}: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { hasPermission } = usePermissions()

  if (!user) return null

  const isUnit = user.role === "UNIDADE_HOSPITALAR"

  const NAV_ITEMS: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      section: "principal",
    },
    {
      label: "Pacientes",
      href: "/pacientes",
      icon: Users,
      section: "principal",
      hideForUnit: true,
    },
    {
      label: "TFD",
      href: "/tfd",
      icon: FileText,
      module: "tfd",
      section: "modulos",
    },
    {
      label: "CNRAC",
      href: "/cnrac",
      icon: ClipboardList,
      module: "cnrac",
      section: "modulos",
    },
    {
      label: "Hemodiálise",
      href: "/hemodialise",
      icon: Stethoscope,
      module: "hemodialise",
      section: "modulos",
    },
    {
      label: "Judicial",
      href: "/judicial",
      icon: Scale,
      section: "modulos",
      predicate: () => canAccessJudicialModule(user) || user.role === "ADMIN",
    },
    {
      label: "Pré Judicial",
      href: "/pre-judicial",
      icon: Gavel,
      section: "modulos",
      predicate: () => canAccessJudicialModule(user) || user.role === "ADMIN",
    },
    {
      label: "Agendamento da Demanda",
      href: "/agendamento-demanda",
      icon: CalendarRange,
      section: "modulos",
      predicate: () => canAccessSchedulingModule(user) || user.role === "ADMIN",
    },
    {
      label: "Relatórios",
      href: "/relatorios",
      icon: BarChart3,
      section: "modulos",
      predicate: () => true,
    },
    {
      label: "Usuários",
      href: "/admin/usuarios",
      icon: UserPlus,
      adminOnly: true,
      section: "admin",
    },
    {
      label: "Unidades",
      href: "/admin/unidades",
      icon: Building2,
      adminOnly: true,
      section: "admin",
    },
    {
      label: "Permissões",
      href: "/admin/permissoes",
      icon: ShieldCheck,
      adminOnly: true,
      section: "admin",
    },
    {
      label: "Admin Judicial",
      href: "/admin/judicial",
      icon: Settings,
      section: "admin",
      predicate: () => canAccessJudicialAdmin(user),
    },
    {
      label: "Meu Perfil",
      href: "/perfil",
      icon: User,
      section: "conta",
    },
  ]

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.hideForUnit && isUnit) return false
    if (item.adminOnly && user.role !== "ADMIN") return false
    if (item.module && !hasPermission(user.role, item.module, "visualizar")) {
      return false
    }
    if (item.predicate && !item.predicate()) return false
    return true
  })

  const sections = visibleItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section ?? "principal"
    if (!acc[section]) acc[section] = []
    acc[section].push(item)
    return acc
  }, {})

  const SECTION_LABELS: Record<string, string> = {
    principal: "Principal",
    modulos: "Módulos",
    admin: "Administração",
    conta: "Conta",
  }

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "justify-between gap-3 px-4",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <ShieldCheck className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-wide text-sidebar-primary-foreground">
                SIS Regulação
              </p>
              <p className="text-[11px] text-sidebar-foreground/60">
                Painel interno
              </p>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:inline-flex"
          aria-label={collapsed ? "Expandir menu lateral" : "Retrair menu lateral"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isUnit && user.unidadeNome && (
        <div className={cn("mt-3", collapsed ? "px-2" : "px-3")}>
          <div
            className={cn(
              "rounded-lg bg-sidebar-accent",
              collapsed ? "px-2 py-3 text-center" : "px-3 py-2",
            )}
            title={user.unidadeNome}
          >
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                Unidade
              </p>
            )}

            <p
              className={cn(
                "font-medium text-sidebar-accent-foreground",
                collapsed ? "truncate text-[11px]" : "truncate text-xs",
              )}
            >
              {collapsed
                ? user.unidadeNome.slice(0, 2).toUpperCase()
                : user.unidadeNome}
            </p>
          </div>
        </div>
      )}

      <nav
        className={cn("flex-1 overflow-hidden py-4", collapsed ? "px-2" : "px-3")}
        aria-label="Menu principal"
      >
        {Object.entries(sections).map(([sectionKey, items]) => (
          <div key={sectionKey} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {SECTION_LABELS[sectionKey] ?? sectionKey}
              </p>
            )}

            <ul className="flex flex-col gap-1" role="list">
              {items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/")

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "group flex items-center rounded-lg text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />

                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                        </>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border p-3", collapsed && "px-2")}>
        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          className={cn(
            "flex w-full items-center rounded-lg text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}