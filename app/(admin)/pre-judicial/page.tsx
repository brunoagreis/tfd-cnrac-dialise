"use client"

import { Gavel } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { hasUserPermission } from "@/lib/access-control"
import { PreJudicialBoard } from "@/components/modules/pre-judicial-board"

export default function PreJudicialPage() {
  const { user } = useAuth()

  if (!user) return null

  if (!hasUserPermission(user, "PRE_JUDICIAL", "visualizar")) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Você não possui permissão para acessar o módulo Pré Judicial.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Gavel className="h-5 w-5 text-primary" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pré Judicial</h1>
          <p className="text-sm text-muted-foreground">
            Prazos, interação e retorno automático da fila.
          </p>
        </div>
      </div>

      <PreJudicialBoard />
    </div>
  )
}