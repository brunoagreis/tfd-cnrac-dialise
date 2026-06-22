import { JudicialPrioritiesPanelCombined } from "@/components/modules/judicial-priorities-panel-combined"

export default function JudicialPrioridadesV2Page() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prioridades do monitoramento</h1>
        <p className="text-sm text-muted-foreground">
          Configure prioridades combinadas usando CID e SIGTAP das tabelas oficiais.
        </p>
      </div>

      <JudicialPrioritiesPanelCombined />
    </div>
  )
}
