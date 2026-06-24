"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JudicialAdminPanel as JudicialAdminPanelReal } from "@/components/modules/judicial-admin-panel-original"
import AtribuicaoManualPage from "@/app/(admin)/admin/judicial/atribuicao-manual/page"
import EmailsDisparoPage from "@/app/(admin)/admin/judicial/emails-disparo/page"
import EmailsEnviosPage from "@/app/(admin)/admin/judicial/emails-envios/page"
import MunicipiosAcessoPage from "@/app/(admin)/admin/judicial/municipios-acesso/page"
import HorariosPage from "@/app/(admin)/admin/dashboard-administrativo/horarios/page"

const REAL_TABS = [
  { value: "core", label: "Importações CORE", innerLabel: "Importações CORE" },
  { value: "municipios", label: "Municípios", innerLabel: "Municípios" },
  { value: "emails", label: "E-mails", innerLabel: "E-mails" },
  { value: "prioridade", label: "Prioridades", innerLabel: "Prioridades" },
  { value: "bloqueio-sequestro", label: "Bloqueio / Sequestro", innerLabel: "Bloqueio / Sequestro" },
  { value: "sigtap-cadastro", label: "SIGTAP", innerLabel: "SIGTAP" },
  { value: "especialidade-sub", label: "Especialidade / Subespecialidade", innerLabel: "Especialidade / Subespecialidade" },
]

const EXTRA_TABS = [
  { value: "atribuicao-manual", label: "Atribuição manual" },
  { value: "disparo-emails", label: "Disparo de e-mails" },
  { value: "envios-email", label: "Envios de e-mail" },
  { value: "acesso-municipios", label: "Acesso municípios" },
  { value: "horarios-trabalho", label: "Horários de trabalho" },
]

const ALL_TABS = [...REAL_TABS, ...EXTRA_TABS]

function triggerInnerTab(root: HTMLDivElement | null, label: string) {
  if (!root) return

  const tabLists = Array.from(root.querySelectorAll<HTMLElement>('[role="tablist"]'))
  const firstTabList = tabLists[0]
  if (firstTabList) {
    firstTabList.style.position = "absolute"
    firstTabList.style.width = "1px"
    firstTabList.style.height = "1px"
    firstTabList.style.overflow = "hidden"
    firstTabList.style.clipPath = "inset(50%)"
    firstTabList.style.whiteSpace = "nowrap"
  }

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const button = tabs.find((tab) => tab.textContent?.trim() === label)
  button?.click()
}

export function JudicialAdminPanel() {
  const [activeTab, setActiveTab] = useState("core")
  const realTab = useMemo(() => REAL_TABS.find((item) => item.value === activeTab), [activeTab])
  const realPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!realTab) return
    const timer = window.setTimeout(() => triggerInnerTab(realPanelRef.current, realTab.innerLabel), 50)
    return () => window.clearTimeout(timer)
  }, [realTab])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
        {ALL_TABS.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {REAL_TABS.map((item) => (
        <TabsContent key={item.value} value={item.value} className="mt-0">
          <div ref={item.value === activeTab ? realPanelRef : undefined}>
            {item.value === activeTab ? <JudicialAdminPanelReal /> : null}
          </div>
        </TabsContent>
      ))}

      <TabsContent value="atribuicao-manual" className="mt-0">
        <AtribuicaoManualPage />
      </TabsContent>
      <TabsContent value="disparo-emails" className="mt-0">
        <EmailsDisparoPage />
      </TabsContent>
      <TabsContent value="envios-email" className="mt-0">
        <EmailsEnviosPage />
      </TabsContent>
      <TabsContent value="acesso-municipios" className="mt-0">
        <MunicipiosAcessoPage />
      </TabsContent>
      <TabsContent value="horarios-trabalho" className="mt-0">
        <HorariosPage />
      </TabsContent>
    </Tabs>
  )
}
