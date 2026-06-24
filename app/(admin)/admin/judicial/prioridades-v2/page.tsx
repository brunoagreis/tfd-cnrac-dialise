import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { JudicialPrioritiesPanelCombined } from "@/components/modules/judicial-priorities-panel-combined"
import { Button } from "@/components/ui/button"

export default function JudicialPrioridadesV2Page() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prioridades do monitoramento</h1>
          <p className="text-sm text-muted-foreground">
            Configure prioridades combinadas usando CID e SIGTAP das tabelas oficiais.
          </p>
        </div>
        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin Judicial</Link>
        </Button>
      </div>

      <JudicialPrioritiesPanelCombined />
    </div>
  )
}
