"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FileText, ClipboardList, Stethoscope, ShieldCheck, User, Users, UserPlus, Building2, LogOut, Scale, CalendarRange, Settings, Gavel } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { usePermissions } from "@/lib/permissions"
import { canAccessJudicialAdmin, canAccessJudicialModule, canAccessSchedulingModule } from "@/lib/judicial-access"
import type { Module } from "@/lib/types"
import { cn } from "@/lib/utils"

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

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { canAccessModule } = usePermissions()
  if (!user) return null

  const isUnit = user.role === "UNIDADE_HOSPITALAR"

  const NAV_ITEMS: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "principal" },
    { label: "Pacientes", href: "/pacientes", icon: Users, section: "principal", hideForUnit: true },
    { label: "TFD", href: "/tfd", icon: FileText, module: "tfd", section: "modulos" },
    { label: "CNRAC", href: "/cnrac", icon: ClipboardList, module: "cnrac", section: "modulos" },
    { label: "Hemodialise", href: "/hemodialise", icon: Stethoscope, module: "hemodialise", section: "modulos" },
    { label: "Judicial", href: "/judicial", icon: Scale, section: "modulos", predicate: () => canAccessJudicialModule(user) },
    { label: "Pré Judicial", href: "/pre-judicial", icon: Gavel, section: "modulos", predicate: () => canAccessJudicialModule(user) },
    { label: "Agendamento da Demanda", href: "/agendamento-demanda", icon: CalendarRange, section: "modulos", predicate: () => canAccessSchedulingModule(user) },
    { label: "Usuarios", href: "/admin/usuarios", icon: UserPlus, adminOnly: true, section: "admin" },
    { label: "Unidades", href: "/admin/unidades", icon: Building2, adminOnly: true, section: "admin" },
    { label: "Permissoes", href: "/admin/permissoes", icon: ShieldCheck, adminOnly: true, section: "admin" },
    { label: "Admin Judicial", href: "/admin/judicial", icon: Settings, section: "admin", predicate: () => canAccessJudicialAdmin(user) },
    { label: "Meu Perfil", href: "/perfil", icon: User, section: "conta" },
  ]

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.hideForUnit && isUnit) return false
    if (item.adminOnly && user.role !== "ADMIN") return false
    if (item.module && !canAccessModule(user.role, item.module)) return false
    if (item.predicate && !item.predicate()) return false
    return true
  })

  const sections = visibleItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const s = item.section ?? "principal"
    if (!acc[s]) acc[s] = []
    acc[s].push(item)
    return acc
  }, {})

  const SECTION_LABELS: Record<string, string> = {
    principal: "Principal",
    modulos: "Modulos",
    admin: "Administracao",
    conta: "Conta",
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary"><ShieldCheck className="h-4 w-4 text-sidebar-primary-foreground" /></div><span className="text-sm font-bold tracking-wide text-sidebar-primary-foreground">SIS Regulacao</span></div>
      {isUnit && user.unidadeNome && <div className="mx-3 mt-3 rounded-lg bg-sidebar-accent px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Unidade</p><p className="truncate text-xs font-medium text-sidebar-accent-foreground">{user.unidadeNome}</p></div>}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu principal">{Object.entries(sections).map(([sectionKey, items]) => (<div key={sectionKey} className="mb-4"><p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{SECTION_LABELS[sectionKey] ?? sectionKey}</p><ul className="flex flex-col gap-0.5" role="list">{items.map((item) => {const isActive = pathname === item.href || pathname.startsWith(item.href + "/"); return (<li key={item.href}><Link href={item.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground")} aria-current={isActive ? "page" : undefined}><item.icon className="h-4 w-4 shrink-0" />{item.label}</Link></li>)})}</ul></div>))}</nav>
      <div className="border-t border-sidebar-border p-3"><button type="button" onClick={() => { logout(); window.location.href = "/login" }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"><LogOut className="h-4 w-4 shrink-0" />Sair</button></div>
    </aside>
  )
}
