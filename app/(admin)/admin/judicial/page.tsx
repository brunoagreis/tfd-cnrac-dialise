"use client"

import Link from "next/link"
import { BarChart3, Building2, CalendarClock, Inbox, KeyRound, ListChecks, Mail, MailCheck, Scale, Search, Settings, Settings2, ShieldAlert, Tags, Upload } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { JudicialEmailEditorCaretFix } from "@/components/modules/judicial-email-editor-caret-fix"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function JudicialPriorityReportShortcuts() {
  return null
}

const adminAreas = [
  { title: "Importações CORE", description: "Importar planilhas CORE ambulatorial e leitos.", href: "/admin/judicial/importacoes-core", icon: Upload },
  { title: "Municípios", description: "Cadastrar contatos municipais usados no fluxo judicial.", href: "/admin/judicial/municipios", icon: Building2 },
  { title: "E-mails", description: "Configurar modelos de e-mail do módulo judicial.", href: "/admin/judicial/emails", icon: Mail },
  { title: "Prioridades", description: "Configurar prioridades e critérios combinados.", href: "/admin/judicial/prioridades-v2", icon: Settings2 },
  { title: "Bloqueio / Sequestro", description: "Gerenciar registros de bloqueio e sequestro.", href: "/admin/judicial/bloqueio-sequestro", icon: ShieldAlert },
  { title: "SIGTAP", description: "Cadastrar e consultar procedimentos SIGTAP.", href: "/admin/judicial/sigtap", icon: Search },
  { title: "Especialidade / Subespecialidade", description: "Cadastrar especialidades e subespecialidades.", href: "/admin/judicial/especialidade-subespecialidade", icon: ListChecks },
  { title: "Grupos de palavras-chave", description: "Cadastrar palavras e responsáveis para triagem automática.", href: "/admin/judicial/email-grupos", icon: Tags },
  { title: "Atribuição manual", description: "Direcionar monitoramentos para responsáveis.", href: "/admin/judicial/atribuicao-manual", icon: Settings },
  { title: "Disparo de e-mails", description: "Enviar e-mails administrativos em lote.", href: "/admin/judicial/emails-disparo", icon: Mail },
  { title: "Envios de e-mail", description: "Acompanhar histórico de envios realizados.", href: "/admin/judicial/emails-envios", icon: MailCheck },
  { title: "Integração e-mail", description: "Ler caixa de entrada, triagem, OS e histórico.", href: "/admin/judicial/email-integracao", icon: Inbox },
  { title: "Acesso municípios", description: "Gerenciar acesso do portal municipal.", href: "/admin/judicial/municipios-acesso", icon: KeyRound },
  { title: "Horários de trabalho", description: "Cadastrar horários por usuário e dia da semana.", href: "/admin/judicial/horarios-trabalho", icon: CalendarClock },
  { title: "Dashboard administrativo", description: "Indicadores administrativos do módulo judicial.", href: "/admin/dashboard-administrativo", icon: BarChart3 },
]

export default function JudicialAdminPage() {
  const { user } = useAuth()

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar a administração judicial.</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <JudicialEmailEditorCaretFix />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Scale className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administrador Judicial</h1>
          <p className="text-sm text-muted-foreground">Painel de administração judicial. Cada área abre em uma página própria.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {adminAreas.map((area) => {
          const Icon = area.icon
          return (
            <Link key={area.href} href={area.href} className="group outline-none">
              <Card className="h-full border-border transition-colors group-hover:border-primary/60 group-hover:bg-muted/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                  <CardTitle className="text-base">{area.title}</CardTitle>
                  <CardDescription>{area.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0"><span className="text-sm font-medium text-primary">Abrir página</span></CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
