"use client"

import { Settings } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { JudicialAdminPanel } from "@/components/modules/judicial-admin-panel"

export default function JudicialAdminPage() {
  const { user } = useAuth()
  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar a administração judicial.</div>
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Settings className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold tracking-tight">Administrador Judicial</h1><p className="text-sm text-muted-foreground">Modelos de e-mail, contatos municipais, importação CORE, prioridades e relatórios.</p></div></div>
      <JudicialAdminPanel />
    </div>
  )
}
