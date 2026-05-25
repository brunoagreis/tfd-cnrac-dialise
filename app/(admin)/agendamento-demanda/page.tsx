"use client"

import { CalendarRange } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { canAccessSchedulingModule } from "@/lib/judicial-access"
import { AgendamentoDemandasBoard } from "@/components/modules/agendamento-demandas-board"

export default function AgendamentoDemandaPage() {
  const { user } = useAuth()
  if (!canAccessSchedulingModule(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Você não possui acesso ao módulo Agendamento da Demanda.</div>
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><CalendarRange className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold tracking-tight">Agendamento da Demanda</h1><p className="text-sm text-muted-foreground">Gestão da oferta, reserva, agendamento e devolução ao monitoramento.</p></div></div>
      <AgendamentoDemandasBoard />
    </div>
  )
}
