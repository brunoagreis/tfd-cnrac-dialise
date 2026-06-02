"use client"

import {
  Scale,
  BriefcaseMedical,
  Ambulance,
  Droplets,
  HeartPulse,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"

export type DemandModuleChoice =
  | "judicial"
  | "pre_judicial"
  | "tfd"
  | "cnrac"
  | "hemodialise"

type ModuleChooserItem = {
  value: DemandModuleChoice
  label: string
  icon: LucideIcon
  hint: string
}

const ITEMS: ModuleChooserItem[] = [
  {
    value: "judicial",
    label: "Judicial",
    icon: Scale,
    hint: "Cadastro completo de ação judicial.",
  },
  {
    value: "pre_judicial",
    label: "Pré Judicial",
    icon: BriefcaseMedical,
    hint: "Cadastro pré judicial com prazo e controle.",
  },
  {
    value: "tfd",
    label: "TFD",
    icon: Ambulance,
    hint: "Fluxo padrão de Tratamento Fora de Domicílio.",
  },
  {
    value: "cnrac",
    label: "CNRAC",
    icon: HeartPulse,
    hint: "Fluxo padrão de alta complexidade.",
  },
  {
    value: "hemodialise",
    label: "Hemodiálise",
    icon: Droplets,
    hint: "Fluxo padrão de hemodiálise.",
  },
]

export function ModuleChooser({
  onChoose,
}: {
  onChoose: (module: DemandModuleChoice) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {ITEMS.map((item) => {
        const Icon = item.icon

        return (
          <Button
            key={item.value}
            type="button"
            variant="outline"
            className="h-auto min-h-[76px] w-full justify-start rounded-2xl border-border bg-transparent p-4 text-left whitespace-normal"
            onClick={() => onChoose(item.value)}
          >
            <div className="flex min-w-0 w-full items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-sm font-semibold leading-tight text-foreground">
                  {item.label}
                </p>
                <p className="mt-1 whitespace-normal break-words text-xs leading-snug text-muted-foreground">
                  {item.hint}
                </p>
              </div>
            </div>
          </Button>
        )
      })}
    </div>
  )
}