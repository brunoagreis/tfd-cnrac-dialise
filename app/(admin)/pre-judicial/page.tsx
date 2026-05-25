import { PreJudicialBoard } from "@/components/modules/pre-judicial-board"

export default function PreJudicialPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pré Judicial</h1>
        <p className="text-sm text-muted-foreground">Cadastro, prazo, interação, anexos, envio ao Agendamento da Demanda e retorno automático da fila.</p>
      </div>
      <PreJudicialBoard />
    </div>
  )
}
