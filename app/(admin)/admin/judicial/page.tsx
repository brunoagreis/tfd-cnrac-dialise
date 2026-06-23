"use client"

import Link from "next/link"
import { BarChart3, CalendarClock, Mail, Settings, Settings2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { JudicialAdminPanel } from "@/components/modules/judicial-admin-panel"
import { JudicialEmailPlaceholdersStyle } from "@/components/modules/judicial-email-placeholders-style"
import { Button } from "@/components/ui/button"

export default function JudicialAdminPage() {
  const { user } = useAuth()

  if (!canAccessJudicialAdmin(user)) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Somente administradores podem acessar a administração judicial.
      </div>
    )
  }

  return (
    <div className="admin-judicial-page flex flex-col gap-6">
      <JudicialEmailPlaceholdersStyle />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Administrador Judicial</h1>
            <p className="text-sm text-muted-foreground">
              Modelos de e-mail, contatos municipais, importação CORE, prioridades e relatórios.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="bg-transparent">
            <Link href="/admin/judicial/atribuicao-manual">
              <Settings2 className="mr-2 h-4 w-4" />
              Atribuição manual
            </Link>
          </Button>

          <Button asChild variant="outline" className="bg-transparent">
            <Link href="/admin/judicial/emails-disparo">
              <Mail className="mr-2 h-4 w-4" />
              Disparo de e-mails
            </Link>
          </Button>

          <Button asChild variant="outline" className="bg-transparent">
            <Link href="/admin/judicial/prioridades-v2">
              <Settings2 className="mr-2 h-4 w-4" />
              Prioridades
            </Link>
          </Button>

          <Button asChild variant="outline" className="bg-transparent">
            <Link href="/admin/dashboard-administrativo">
              <BarChart3 className="mr-2 h-4 w-4" />
              Dashboard administrativo
            </Link>
          </Button>

          <Button asChild variant="outline" className="bg-transparent">
            <Link href="/admin/dashboard-administrativo/horarios">
              <CalendarClock className="mr-2 h-4 w-4" />
              Horários de trabalho
            </Link>
          </Button>
        </div>
      </div>

      <JudicialAdminPanel />
    </div>
  )
}
