"use client"

import { Settings } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { JudicialAdminPanel } from "@/components/modules/judicial-admin-panel"
import { JudicialEmailEditorCaretFix } from "@/components/modules/judicial-email-editor-caret-fix"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AtribuicaoManualPage from "@/app/(admin)/admin/judicial/atribuicao-manual/page"
import EmailsDisparoPage from "@/app/(admin)/admin/judicial/emails-disparo/page"
import EmailsEnviosPage from "@/app/(admin)/admin/judicial/emails-envios/page"
import MunicipiosAcessoPage from "@/app/(admin)/admin/judicial/municipios-acesso/page"
import HorariosPage from "@/app/(admin)/admin/dashboard-administrativo/horarios/page"

export function JudicialPriorityReportShortcuts() {
  return null
}

const adminTabs = [
  { value: "core", label: "Importações CORE" },
  { value: "municipios", label: "Municípios" },
  { value: "emails", label: "E-mails" },
  { value: "prioridade", label: "Prioridades" },
  { value: "bloqueio-sequestro", label: "Bloqueio / Sequestro" },
  { value: "sigtap-cadastro", label: "SIGTAP" },
  { value: "especialidade-sub", label: "Especialidade / Subespecialidade" },
  { value: "atribuicao", label: "Atribuição manual" },
  { value: "disparo", label: "Disparo de e-mails" },
  { value: "envios", label: "Envios de e-mail" },
  { value: "municipios-acesso", label: "Acesso municípios" },
  { value: "horarios", label: "Horários de trabalho" },
]

const internalAdminTabs = new Set([
  "core",
  "municipios",
  "emails",
  "prioridade",
  "bloqueio-sequestro",
  "sigtap-cadastro",
  "especialidade-sub",
])

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

      <Tabs defaultValue="core" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          {adminTabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>
          ))}
        </TabsList>

        {Array.from(internalAdminTabs).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-0">
            <JudicialAdminPanel forcedTab={tab} hideTabsList />
          </TabsContent>
        ))}

        <TabsContent value="atribuicao" className="mt-0"><AtribuicaoManualPage /></TabsContent>
        <TabsContent value="disparo" className="mt-0"><EmailsDisparoPage /></TabsContent>
        <TabsContent value="envios" className="mt-0"><EmailsEnviosPage /></TabsContent>
        <TabsContent value="municipios-acesso" className="mt-0"><MunicipiosAcessoPage /></TabsContent>
        <TabsContent value="horarios" className="mt-0"><HorariosPage /></TabsContent>
      </Tabs>
    </div>
  )
}
