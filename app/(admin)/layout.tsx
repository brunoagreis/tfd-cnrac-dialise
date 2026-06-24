"use client"

import { useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { cn } from "@/lib/utils"

const SIDEBAR_STORAGE_KEY = "sis-regulacao:sidebar-collapsed"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isReady } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (!isReady) return
    if (!isAuthenticated) {
      router.replace("/login")
    }
  }, [isReady, isAuthenticated, router])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    setSidebarCollapsed(stored === "1")
  }, [])

  function handleToggleSidebarCollapse() {
    setSidebarCollapsed((current) => {
      const next = !current
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0")
      }
      return next
    })
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
        >
          <span className="sr-only">Carregando...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
        >
          <span className="sr-only">Redirecionando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSidebarOpen(false)
          }}
          role="button"
          tabIndex={0}
          aria-label="Fechar menu"
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 shrink-0 transform transition-transform duration-200 ease-in-out lg:relative lg:z-auto lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed && "lg:w-20",
        )}
      >
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
          isSidebarCollapsed={sidebarCollapsed}
        />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
