"use client"

import type { ReactNode } from "react"

import { useAuth } from "@/lib/auth-context"
import { hasUserPermission } from "@/lib/access-control"
import type { AccessModule, Action } from "@/lib/types"

interface PermissionGateProps {
  module: AccessModule | string
  action?: Action | string
  children?: ReactNode
  fallback?: ReactNode
}

function ShieldAlertIcon({ className }: { className?: string }) {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function DefaultFallback() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-12 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlertIcon className="h-7 w-7 text-destructive" />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-card-foreground">
          Sem permissão
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Você não possui acesso a este recurso. Contate o administrador do sistema.
        </p>
      </div>
    </div>
  )
}

export function PermissionGate({
  module,
  action = "visualizar",
  children,
  fallback,
}: PermissionGateProps) {
  const { user } = useAuth()

  if (!user) {
    return fallback ?? <DefaultFallback />
  }

  if (!hasUserPermission(user, module, action)) {
    return fallback ?? <DefaultFallback />
  }

  return <>{children}</>
}