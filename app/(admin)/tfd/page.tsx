"use client"

import { FileText } from "lucide-react"
import { PermissionGate } from "@/components/permission-gate"
import { DemandListing } from "@/components/modules/demand-listing"
import { useAuth } from "@/lib/auth-context"

export default function TfdPage() {
  const { user } = useAuth()
  const emailFilter = user?.role === "UNIDADE_HOSPITALAR" ? user.email : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">TFD</h1>
          <p className="text-sm text-muted-foreground">Tratamento Fora de Domicilio</p>
        </div>
      </div>

      <PermissionGate module="tfd">
        <DemandListing modulo="tfd" filterByEmail={emailFilter} />
      </PermissionGate>
    </div>
  )
}
