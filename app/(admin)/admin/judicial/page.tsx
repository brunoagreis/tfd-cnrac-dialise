"use client"

import Link from "next/link"
import { Settings } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { JudicialAdminPanel } from "@/components/modules/judicial-admin-panel"
import { JudicialEmailEditorCaretFix } from "@/components/modules/judicial-email-editor-caret-fix"

const adminLinks = [
  { href: "/admin/judicial", label: "Importações CORE" },
  { href: "/admin/judicial/municipios-acesso", label: "Acesso municípios" },
  { href: "/admin/judicial/email-integracao", label: "Integração e-mail" },
  { href: "/admin/judicial/emails-disparo", label: "Disparo de e-mails" },
  { href: "/admin/judicial/emails-envios", label: "Envios de e-mail" },
  { href: "/admin/judicial/atribuicao-manual", label: "Atribuição manual" },
  { href: "/admin/dashboard-administrativo/horarios", label: "Horários de trabalho" },
  { href: "/admin/judicial/prioridades-v2", label: "Prioridades" },
  { href: "/admin/dashboard-administrativo", label: "Dashboard administrativo" },
]

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
    <div className="flex flex-col gap-6">
      <JudicialEmailEditorCaretFix />

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

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {adminLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${item.href === "/admin/judicial" ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <JudicialAdminPanel />
    </div>
  )
}
