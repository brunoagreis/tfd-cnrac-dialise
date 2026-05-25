"use client"

import { Scale } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialModule } from "@/lib/judicial-access"
import { JudicialMonitoringBoard } from "@/components/modules/judicial-monitoring-board"

export default function JudicialPage() {
  const { user } = useAuth()
  if (!canAccessJudicialModule(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Você não possui acesso ao módulo Judicial.</div>
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Scale className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold tracking-tight">Judicial</h1><p className="text-sm text-muted-foreground">Monitoramento de ações judiciais da saúde com fila diária, histórico e reiterações.</p></div></div>
      <JudicialMonitoringBoard />
    </div>
  )
}
