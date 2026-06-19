"use client"

import Image from "next/image"
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
import {
  getUserPerfilCodigo,
  hasUserPermission,
  isAdminUser,
} from "@/lib/access-control"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  section?: string
  hideForUnit?: boolean
  adminOnly?: boolean
  permissionModule?: string
  permissionAction?: string
}

interface AppSidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
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

export function AppSidebar({
  collapsed = false,
  onToggleCollapse,
}: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  if (!user) return null

  const currentUser = user as any
  const isAdmin = isAdminUser(currentUser)
  const isUnit = isUnitUser(currentUser)

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
      permissionModule: "PACIENTES",
      permissionAction: "visualizar",
    },
    {
      label: "TFD",
      href: "/tfd",
      icon: FileText,
      section: "modulos",
      permissionModule: "TFD",
      permissionAction: "visualizar",
    },
    {
      label: "CNRAC",
      href: "/cnrac",
      icon: ClipboardList,
      section: "modulos",
      permissionModule: "CNRAC",
      permissionAction: "visualizar",
    },
    {
      label: "Hemodiálise",
      href: "/hemodialise",
      icon: Stethoscope,
      section: "modulos",
      permissionModule: "HEMODIALISE",
      permissionAction: "visualizar",
    },
    {
      label: "Judicial",
      href: "/judicial",
      icon: Scale,
      section: "modulos",
      permissionModule: "JUDICIAL",
      permissionAction: "visualizar",
    },
    {
      label: "Pré Judicial",
      href: "/pre-judicial",
      icon: Gavel,
      section: "modulos",
      permissionModule: "PRE_JUDICIAL",
      permissionAction: "visualizar",
    },
    {
      label: "Agendamento da Demanda",
      href: "/agendamento-demanda",
      icon: CalendarRange,
      section: "modulos",
      permissionModule: "AGENDAMENTO",
      permissionAction: "visualizar",
    },
    {
      label: "Relatórios",
      href: "/relatorios",
      icon: BarChart3,
      section: "modulos",
      permissionModule: "RELATORIOS",
      permissionAction: "visualizar",
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
      permissionModule: "ADMIN_JUDICIAL",
      permissionAction: "visualizar",
    },
    {
      label: "Dashboard Admin",
      href: "/admin/dashboard-administrativo",
      icon: BarChart3,
      section: "admin",
      permissionModule: "DASHBOARD_ADMINISTRATIVO",
      permissionAction: "visualizar",
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
    if (item.adminOnly && !isAdmin) return false

    if (item.permissionModule) {
      return hasUserPermission(
        currentUser,
        item.permissionModule,
        item.permissionAction || "visualizar",
      )
    }

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
        <div
          className={cn(
            "flex min-w-0 flex-col items-start justify-center",
            collapsed && "items-center",
          )}
        >
          <Image
            src="/larga-sigajus-branca.png"
            alt="SIGAJUS"
            width={collapsed ? 66 : 200}
            height={collapsed ? 28 : 60}
            className={cn(
              "h-auto object-contain",
              collapsed ? "h-auto w-auto max-w-[66px]" : "h-auto w-auto max-w-[200px]",
            )}
            priority
          />

          {!collapsed && (
            <p className="mt-1 text-[11px] text-sidebar-foreground/60">
              Painel interno
            </p>
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

      {isUnit && currentUser.unidadeNome && (
        <div className={cn("mt-3", collapsed ? "px-2" : "px-3")}>
          <div
            className={cn(
              "rounded-lg bg-sidebar-accent",
              collapsed ? "px-2 py-3 text-center" : "px-3 py-2",
            )}
            title={currentUser.unidadeNome}
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
                ? String(currentUser.unidadeNome).slice(0, 2).toUpperCase()
                : currentUser.unidadeNome}
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