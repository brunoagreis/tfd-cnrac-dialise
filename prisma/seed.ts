import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function upsertFluxos() {
  const itens = [
    { codigo: "JUDICIAL", nome: "Judicialização", ordem: 1, descricao: "Fluxo de judicialização" },
    { codigo: "PRE_JUDICIAL", nome: "Pré-Judicial", ordem: 2, descricao: "Fluxo pré-judicial" },
    { codigo: "CNRAC", nome: "CNRAC", ordem: 3, descricao: "Fluxo CNRAC" },
    { codigo: "HEMODIALISE", nome: "Hemodiálise", ordem: 4, descricao: "Fluxo de hemodiálise" },
    { codigo: "TFD", nome: "TFD", ordem: 5, descricao: "Tratamento Fora de Domicílio" },
    { codigo: "AGENDAMENTO", nome: "Agendamento da Demanda", ordem: 6, descricao: "Fluxo de agendamento" },
  ]

  for (const item of itens) {
    await prisma.tipoFluxo.upsert({
      where: { codigo: item.codigo },
      update: item,
      create: item,
    })
  }
}

async function upsertStatus() {
  const itens = [
    { codigo: "ABERTA", nome: "Aberta", ordem: 1, cor: "#2563eb", descricao: "Demanda aberta e recebida no sistema" },
    { codigo: "EM_ANALISE", nome: "Em análise", ordem: 2, cor: "#f59e0b", descricao: "Demanda em análise técnica/administrativa" },
    { codigo: "AGUARDANDO_MANIFESTACAO", nome: "Aguardando manifestação", ordem: 3, cor: "#8b5cf6", descricao: "Aguardando resposta ou manifestação" },
    { codigo: "ENCAMINHADA", nome: "Encaminhada", ordem: 4, cor: "#0ea5e9", descricao: "Demanda encaminhada para outro setor ou unidade" },
    { codigo: "AGENDADA", nome: "Agendada", ordem: 5, cor: "#10b981", descricao: "Demanda com agendamento realizado" },
    { codigo: "CONCLUIDA", nome: "Concluída", ordem: 6, cor: "#16a34a", descricao: "Demanda concluída com sucesso" },
    { codigo: "INDEFERIDA", nome: "Indeferida", ordem: 7, cor: "#dc2626", descricao: "Demanda indeferida" },
    { codigo: "ENCERRADA", nome: "Encerrada", ordem: 8, cor: "#6b7280", descricao: "Demanda encerrada administrativamente" },
  ]

  for (const item of itens) {
    await prisma.statusDemanda.upsert({
      where: { codigo: item.codigo },
      update: item,
      create: item,
    })
  }
}

async function upsertPrioridades() {
  const itens = [
    { codigo: "NORMAL", nome: "Normal", ordem: 1, descricao: "Prioridade normal" },
    { codigo: "URGENTE", nome: "Urgente", ordem: 2, descricao: "Prioridade urgente" },
    { codigo: "MUITO_URGENTE", nome: "Muito urgente", ordem: 3, descricao: "Prioridade muito urgente" },
  ]

  for (const item of itens) {
    await prisma.prioridadeDemanda.upsert({
      where: { codigo: item.codigo },
      update: item,
      create: item,
    })
  }
}

async function upsertTiposMovimentacao() {
  const itens = [
    { codigo: "CADASTRO", nome: "Cadastro", ordem: 1, descricao: "Cadastro inicial da demanda" },
    { codigo: "ENCAMINHAMENTO", nome: "Encaminhamento", ordem: 2, descricao: "Encaminhamento para setor, unidade ou fluxo" },
    { codigo: "DEVOLUCAO", nome: "Devolução", ordem: 3, descricao: "Devolução para ajuste ou reanálise" },
    { codigo: "MANIFESTACAO", nome: "Manifestação", ordem: 4, descricao: "Registro de manifestação no processo" },
    { codigo: "MONITORAMENTO", nome: "Monitoramento", ordem: 5, descricao: "Registro de monitoramento/acompanhamento" },
    { codigo: "AGENDAMENTO", nome: "Agendamento", ordem: 6, descricao: "Registro de agendamento" },
    { codigo: "ENCERRAMENTO", nome: "Encerramento", ordem: 7, descricao: "Encerramento da demanda" },
    { codigo: "REABERTURA", nome: "Reabertura", ordem: 8, descricao: "Reabertura da demanda" },
  ]

  for (const item of itens) {
    await prisma.tipoMovimentacao.upsert({
      where: { codigo: item.codigo },
      update: item,
      create: item,
    })
  }
}

async function upsertTiposManifestacao() {
  const itens = [
    { codigo: "PARECER_TECNICO", nome: "Parecer técnico", ordem: 1, descricao: "Parecer técnico interno" },
    { codigo: "RESPOSTA_HOSPITALAR", nome: "Resposta hospitalar", ordem: 2, descricao: "Manifestação da unidade hospitalar" },
    { codigo: "DESPACHO_INTERNO", nome: "Despacho interno", ordem: 3, descricao: "Despacho interno administrativo" },
    { codigo: "OBSERVACAO", nome: "Observação", ordem: 4, descricao: "Observação complementar" },
  ]

  for (const item of itens) {
    await prisma.tipoManifestacao.upsert({
      where: { codigo: item.codigo },
      update: item,
      create: item,
    })
  }
}

async function upsertMotivosEncerramento() {
  const itens = [
    { codigo: "ATENDIDA", nome: "Demanda atendida", descricao: "Encerrada por atendimento da demanda" },
    { codigo: "DESISTENCIA", nome: "Desistência", descricao: "Encerrada por desistência do interessado" },
    { codigo: "INDEFERIMENTO", nome: "Indeferimento", descricao: "Encerrada por indeferimento" },
    { codigo: "DUPLICIDADE", nome: "Duplicidade", descricao: "Encerrada por duplicidade" },
    { codigo: "OUTROS", nome: "Outros", descricao: "Outros motivos de encerramento" },
  ]

  for (const item of itens) {
    await prisma.motivoEncerramento.upsert({
      where: { codigo: item.codigo },
      update: item,
      create: item,
    })
  }
}

async function main() {
  await upsertFluxos()
  await upsertStatus()
  await upsertPrioridades()
  await upsertTiposMovimentacao()
  await upsertTiposManifestacao()
  await upsertMotivosEncerramento()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })