"use client"

import Link from "next/link"
import { ArrowLeft, Settings2 } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { Button } from "@/components/ui/button"
import { JudicialPrioritiesPanel } from "@/components/modules/judicial-priorities-panel"

export default function JudicialPrioridadesPage() {
  const { user } = useAuth()

  if (!canAccessJudicialAdmin(user)) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Somente administradores podem acessar as prioridades judiciais.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Prioridades do monitoramento</h1>
            <p className="text-sm text-muted-foreground">
              Configure a prioridade combinada, procedimentos SIGTAP e CIDs usando as tabelas oficiais do sistema.
            </p>
          </div>
        </div>

        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/judicial">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <JudicialPrioritiesPanel />
    </div>
  )
}
