"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Upload } from "lucide-react"

import { CORE_TABLE_LABELS, CORE_TABLES, type CoreTable } from "@/lib/judicial-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JudicialBloqueioSequestroPanel } from "@/components/modules/judicial-bloqueio-sequestro-panel"
import { JudicialPrioritiesPanelCombined } from "@/components/modules/judicial-priorities-panel-combined"
import AtribuicaoManualPage from "@/app/(admin)/admin/judicial/atribuicao-manual/page"
import EmailsDisparoPage from "@/app/(admin)/admin/judicial/emails-disparo/page"
import EmailsEnviosPage from "@/app/(admin)/admin/judicial/emails-envios/page"
import MunicipiosAcessoPage from "@/app/(admin)/admin/judicial/municipios-acesso/page"
import HorariosPage from "@/app/(admin)/admin/dashboard-administrativo/horarios/page"

type Props = {
  forcedTab?: string
  hideTabsList?: boolean
}

export function JudicialAdminPanel({ forcedTab, hideTabsList = false }: Props = {}) {
  const [table, setTable] = useState<CoreTable>("core_ambulatorial_finalizados")
  const [uploadingCoreFile, setUploadingCoreFile] = useState(false)
  const [selectedCoreFile, setSelectedCoreFile] = useState<File | null>(null)
  const coreFileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleImportCore() {
    if (!selectedCoreFile) {
      toast.error("Selecione um arquivo Excel para importar.")
      return
    }
    try {
      setUploadingCoreFile(true)
      const formData = new FormData()
      formData.append("tipoImportacao", table)
      formData.append("file", selectedCoreFile)
      const response = await fetch("/api/admin/judicial/core-importacoes", { method: "POST", body: formData })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao importar arquivo CORE.")
        return
      }
      toast.success(`${CORE_TABLE_LABELS[table]} importado com sucesso.`)
      setSelectedCoreFile(null)
      if (coreFileInputRef.current) coreFileInputRef.current.value = ""
    } catch (error) {
      console.error("CORE_IMPORT_ERROR", error)
      toast.error("Erro ao importar arquivo CORE.")
    } finally {
      setUploadingCoreFile(false)
    }
  }

  const tabsProps = forcedTab ? { value: forcedTab } : { defaultValue: "core" }

  return (
    <Tabs {...tabsProps} className="space-y-4">
      {!hideTabsList ? (
        <TabsList className="flex w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="core">Importações CORE</TabsTrigger>
          <TabsTrigger value="municipios">Municípios</TabsTrigger>
          <TabsTrigger value="emails">E-mails</TabsTrigger>
          <TabsTrigger value="prioridade">Prioridades</TabsTrigger>
          <TabsTrigger value="bloqueio-sequestro">Bloqueio / Sequestro</TabsTrigger>
          <TabsTrigger value="sigtap-cadastro">SIGTAP</TabsTrigger>
          <TabsTrigger value="especialidade-sub">Especialidade / Subespecialidade</TabsTrigger>
          <TabsTrigger value="atribuicao-manual">Atribuição manual</TabsTrigger>
          <TabsTrigger value="disparo-emails">Disparo de e-mails</TabsTrigger>
          <TabsTrigger value="envios-email">Envios de e-mail</TabsTrigger>
          <TabsTrigger value="acesso-municipios">Acesso municípios</TabsTrigger>
          <TabsTrigger value="horarios-trabalho">Horários de trabalho</TabsTrigger>
        </TabsList>
      ) : null}

      <TabsContent value="core" className="mt-0 space-y-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Importações CORE</CardTitle>
            <CardDescription>Selecione o tipo de importação e envie o arquivo Excel correspondente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">Regras de atualização</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li><strong>CORE Ambulatorial Finalizados</strong>: apaga apenas os registros do lote finalizados e mantém os em atendimento.</li>
                <li><strong>CORE Ambulatorial Em Atendimento</strong>: apaga apenas os registros do lote em atendimento e mantém os finalizados.</li>
                <li><strong>CORE Leitos</strong>: apaga todos os dados de core_leitos e substitui pelo novo arquivo.</li>
              </ul>
            </div>
            <div className="grid gap-3 md:grid-cols-[340px_180px] md:items-end">
              <div>
                <Label className="mb-1 block text-xs">Tipo de importação</Label>
                <select value={table} onChange={(e) => setTable(e.target.value as CoreTable)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {CORE_TABLES.map((item) => <option key={item} value={item}>{CORE_TABLE_LABELS[item]}</option>)}
                </select>
              </div>
              <Button onClick={handleImportCore} disabled={uploadingCoreFile}>
                <Upload className="mr-2 h-4 w-4" /> {uploadingCoreFile ? "Importando..." : "Importar arquivo"}
              </Button>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Arquivo</Label>
              <input ref={coreFileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setSelectedCoreFile(e.target.files?.[0] || null)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="municipios" className="mt-0"><Card><CardHeader><CardTitle className="text-base">Municípios</CardTitle><CardDescription>Cadastro de contatos municipais permanece disponível pelo fluxo de administração judicial.</CardDescription></CardHeader></Card></TabsContent>
      <TabsContent value="emails" className="mt-0"><Card><CardHeader><CardTitle className="text-base">E-mails</CardTitle><CardDescription>Modelos de e-mail e integrações permanecem disponíveis nas subáreas específicas.</CardDescription></CardHeader></Card></TabsContent>
      <TabsContent value="prioridade" className="mt-0"><JudicialPrioritiesPanelCombined /></TabsContent>
      <TabsContent value="bloqueio-sequestro" className="mt-0"><JudicialBloqueioSequestroPanel /></TabsContent>
      <TabsContent value="sigtap-cadastro" className="mt-0"><Card><CardHeader><CardTitle className="text-base">SIGTAP</CardTitle><CardDescription>Cadastro de SIGTAP.</CardDescription></CardHeader></Card></TabsContent>
      <TabsContent value="especialidade-sub" className="mt-0"><Card><CardHeader><CardTitle className="text-base">Especialidade / Subespecialidade</CardTitle><CardDescription>Cadastro de especialidades e subespecialidades.</CardDescription></CardHeader></Card></TabsContent>
      <TabsContent value="atribuicao-manual" className="mt-0"><AtribuicaoManualPage /></TabsContent>
      <TabsContent value="disparo-emails" className="mt-0"><EmailsDisparoPage /></TabsContent>
      <TabsContent value="envios-email" className="mt-0"><EmailsEnviosPage /></TabsContent>
      <TabsContent value="acesso-municipios" className="mt-0"><MunicipiosAcessoPage /></TabsContent>
      <TabsContent value="horarios-trabalho" className="mt-0"><HorariosPage /></TabsContent>
    </Tabs>
  )
}
