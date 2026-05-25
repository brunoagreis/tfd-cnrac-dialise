
"use client"

import { Scale, BriefcaseMedical, Ambulance, Droplets, HeartPulse } from "lucide-react"
import { Button } from "@/components/ui/button"

export type DemandModuleChoice = "judicial" | "pre_judicial" | "tfd" | "cnrac" | "hemodialise"

const ITEMS: Array<{ value: DemandModuleChoice; label: string; icon: any; hint: string }> = [
  { value: "judicial", label: "Judicial", icon: Scale, hint: "Cadastro completo de ação judicial." },
  { value: "pre_judicial", label: "Pré Judicial", icon: BriefcaseMedical, hint: "Cadastro pré judicial com prazo e controle." },
  { value: "tfd", label: "TFD", icon: Ambulance, hint: "Fluxo padrão de Tratamento Fora de Domicílio." },
  { value: "cnrac", label: "CNRAC", icon: HeartPulse, hint: "Fluxo padrão de alta complexidade." },
  { value: "hemodialise", label: "Hemodiálise", icon: Droplets, hint: "Fluxo padrão de hemodiálise." },
]

export function ModuleChooser({ onChoose }: { onChoose: (module: DemandModuleChoice) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <Button
            key={item.value}
            type="button"
            variant="outline"
            className="h-auto justify-start rounded-2xl border-border bg-transparent p-4 text-left"
            onClick={() => onChoose(item.value)}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </div>
            </div>
          </Button>
        )
      })}
    </div>
  )
}
