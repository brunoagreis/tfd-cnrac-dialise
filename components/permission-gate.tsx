"use client"

import type { ReactNode } from "react"
import { ShieldAlert } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { usePermissions } from "@/lib/permissions"
import type { AccessModule, Action } from "@/lib/types"

interface PermissionGateProps {
  module: AccessModule
  action?: Action
  children: ReactNode
  fallback?: ReactNode
}

function DefaultFallback() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-12 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-7 w-7 text-destructive" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-card-foreground">Sem permissao</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Voce nao possui acesso a este recurso. Contate o administrador do sistema.
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
  const { hasPermission } = usePermissions()

  if (!user) return fallback ?? <DefaultFallback />
  if (!hasPermission(user.role, module, action)) return fallback ?? <DefaultFallback />

  return <>{children}</>
}
