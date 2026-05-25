"use client"

import { ClipboardList } from "lucide-react"
import { PermissionGate } from "@/components/permission-gate"
import { DemandListing } from "@/components/modules/demand-listing"
import { useAuth } from "@/lib/auth-context"

export default function CnracPage() {
  const { user } = useAuth()
  const emailFilter = user?.role === "UNIDADE_HOSPITALAR" ? user.email : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">CNRAC</h1>
          <p className="text-sm text-muted-foreground">Central Nacional de Regulacao de Alta Complexidade</p>
        </div>
      </div>

      <PermissionGate module="cnrac">
        <DemandListing modulo="cnrac" filterByEmail={emailFilter} />
      </PermissionGate>
    </div>
  )
}
