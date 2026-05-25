"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu, Bell, ChevronDown, UserCircle2, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useAuth, getInitials } from "@/lib/auth-context"
import { useStore } from "@/lib/store-context"
import { ROLE_LABELS } from "@/lib/types"
import type { Notificacao } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface AppTopbarProps {
  onToggleSidebar?: () => void
  onToggleSidebarCollapse?: () => void
  isSidebarCollapsed?: boolean
}

export function AppTopbar({
  onToggleSidebar,
  onToggleSidebarCollapse,
  isSidebarCollapsed = false,
}: AppTopbarProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const store = useStore()
  const [bellOpen, setBellOpen] = useState(false)

  const notifications = user ? store.getNotificacoesForUser(user.id) : []
  const unreadCount = user ? store.getUnreadCount(user.id) : 0

  function handleMarkAllRead() {
    if (user) {
      store.markAllNotificacoesRead(user.id)
    }
  }

  function handleNotifClick(n: Notificacao) {
    store.markNotificacaoRead(n.id)
    setBellOpen(false)
  }

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "agora"
    if (diffMin < 60) return `${diffMin}min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h`
    const diffD = Math.floor(diffH / 24)
    return `${diffD}d`
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onToggleSidebar}
          aria-label="Abrir menu lateral"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={onToggleSidebarCollapse}
          aria-label={isSidebarCollapsed ? "Expandir menu lateral" : "Retrair menu lateral"}
        >
          {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>

        <h2 className="text-sm font-medium text-muted-foreground">Painel Administrativo</h2>
      </div>

      {user && (
        <div className="flex items-center gap-2">
          <Popover open={bellOpen} onOpenChange={setBellOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notificacoes">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-popover-foreground">Notificacoes</h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <ScrollArea className="max-h-80">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">Nenhuma notificacao</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {notifications.slice(0, 30).map((n) => (
                      <Link
                        key={n.id}
                        href={`/protocolo/${n.protocolo}`}
                        onClick={() => handleNotifClick(n)}
                        className={cn(
                          "flex flex-col gap-1 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50",
                          !n.lida && "bg-primary/5",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {!n.lida && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                            {n.modulo.toUpperCase()}
                          </Badge>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {formatTime(n.criadoEm)}
                          </span>
                        </div>
                        <p className="leading-snug text-xs text-popover-foreground">{n.mensagem}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {n.pacienteNome} - {n.protocolo}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
                <div className="hidden flex-col items-end sm:flex">
                  <span className="text-sm font-medium text-card-foreground">{user.nome}</span>
                  <Badge variant="secondary" className="text-xs">
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </div>
                <Avatar className="h-9 w-9 bg-primary text-primary-foreground">
                  {user.fotoUrl ? <AvatarImage src={user.fotoUrl} alt={user.nome} /> : null}
                  <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                    {getInitials(user.nome)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{user.nome}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/perfil" className="cursor-pointer">
                  <UserCircle2 className="h-4 w-4" />
                  Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  )
}
