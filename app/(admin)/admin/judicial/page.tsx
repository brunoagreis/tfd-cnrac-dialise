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

      <Tabs defaultValue="principal" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="principal">Admin Judicial</TabsTrigger>
          <TabsTrigger value="atribuicao">Atribuição manual</TabsTrigger>
          <TabsTrigger value="disparo">Disparo de e-mails</TabsTrigger>
          <TabsTrigger value="envios">Envios de e-mail</TabsTrigger>
          <TabsTrigger value="municipios-acesso">Acesso municípios</TabsTrigger>
          <TabsTrigger value="horarios">Horários de trabalho</TabsTrigger>
        </TabsList>

        <TabsContent value="principal" className="mt-0">
          <JudicialAdminPanel />
        </TabsContent>

        <TabsContent value="atribuicao" className="mt-0">
          <AtribuicaoManualPage />
        </TabsContent>

        <TabsContent value="disparo" className="mt-0">
          <EmailsDisparoPage />
        </TabsContent>

        <TabsContent value="envios" className="mt-0">
          <EmailsEnviosPage />
        </TabsContent>

        <TabsContent value="municipios-acesso" className="mt-0">
          <MunicipiosAcessoPage />
        </TabsContent>

        <TabsContent value="horarios" className="mt-0">
          <HorariosPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
