import { Badge } from "@/components/ui/badge"

export function formatJudicialReturnDate(value: string) {
  if (!value) return "Não programado"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Não programado"

  return date.toLocaleDateString("pt-BR")
}

export function isJudicialReturnDue(value: string) {
  if (!value) return false

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  return date.getTime() <= today.getTime()
}

export function judicialReturnReasonLabel(value: string, days?: number | null) {
  const key = String(value || "").trim().toUpperCase()

  const labels: Record<string, string> = {
    AGUARDANDO_AGENDAMENTO_DA_DEMANDA: "Enviado ao Agendamento da Demanda: aguardando retorno",
    RETORNO_ENVIO_AGENDAMENTO_5_DIAS: "Enviado ao Agendamento da Demanda: aguardando retorno",
    RETORNO_3_DIAS_APOS_COMUNICADO_AGENDAMENTO: "Comunicado Agendamento: retorna 3 dias após o atendimento",
    RETORNO_7_DIAS_APOS_AGENDAMENTO: "Agendamento: retorna 7 dias após a data registrada",
    RETORNO_3_DIAS_APOS_SOLICITACAO_INCLUSAO: "Solicitação de inclusão: retorna 3 dias após a solicitação",
    RETORNO_MONITORAMENTO_20_DIAS: "Monitoramento 20/20 dias",
    RETORNO_PENDENTE_SES_5_DIAS: "Pendente SES: retorna em 5 dias",
    RETORNO_PENDENTE_CORE_5_DIAS: "Pendente CORE: retorna em 5 dias",
    RETORNO_PENDENTE_MUNICIPIO_10_DIAS: "Pendente Município: retorna em 10 dias",
    RETORNO_FINALIZACAO_NAO_TERMINAL_20_DIAS: "Finalização não terminal: retorna em 20 dias",
  }

  if (labels[key]) return labels[key]
  if (days) return `Retorno programado em ${days} dia(s)`
  return value || "Retorno programado"
}

export function JudicialReturnBadge({
  nextAt,
  reason,
  days,
  active = true,
}: {
  nextAt?: string
  reason?: string
  days?: number | null
  active?: boolean
}) {
  if (!nextAt || !active) return null

  const due = isJudicialReturnDue(nextAt)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <Badge variant={due ? "destructive" : "secondary"}>
        {due ? "Retorno vencido" : "Retorno programado"}
      </Badge>
      <span>
        <span className="font-medium text-foreground">Próximo monitoramento:</span>{" "}
        {formatJudicialReturnDate(nextAt)} • {judicialReturnReasonLabel(reason || "", days)}
      </span>
    </div>
  )
}
