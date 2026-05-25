# Regramento consolidado — Judicial + Pré Judicial + Agendamento da Demanda

## 1. Judicial
- fila diária automática para monitoramento
- distribuição mínima por usuário monitorador
- prioridade por prazo, descumprimento, reiteração, inércia, paciente agendado e monitoramento CORE automático
- movimentações obrigatórias com auditoria
- controle de ficha CORE / SISREG / Outro
- envio ao município com modelos editáveis
- envio ao Agendamento da Demanda
- retorno ao monitoramento conforme regras do fluxo

## 2. Pré Judicial
- cadastro de demanda, procedimento e CID nos mesmos moldes operacionais dos demais módulos
- anexos, interações e trilha de movimentações
- notificação ao município
- envio para o Agendamento da Demanda com **prazo obrigatório de resposta**
- sinalização visual por criticidade de prazo
- quando o prazo expira sem resposta do setor responsável, o sistema registra automaticamente a manifestação de não resolvido por falta de interação e devolve o caso para a fila do módulo
- casos vencidos retornam como prioritários

## 3. Agendamento da Demanda
- recebe casos ativos vindos do Judicial e do Pré Judicial
- pode importar agenda fake
- pode registrar: agendado, reservado ou não agendado
- ao responder, devolve o caso ao fluxo correto de origem
- controla alertas de prazo para Judicial e Pré Judicial

## 4. Administrativo
- contatos dos municípios
- modelos de e-mail com placeholders
- prioridade por CID/procedimento
- upload fake das bases CORE
- agenda fake compartilhada para o Agendamento da Demanda

## 5. Prisma futuro
O schema entregue já inclui entidades para:
- Judicial
- Pré Judicial
- Agendamento da Demanda
- auditoria
- contatos do município
- modelos de e-mail
- importação CORE
- ofertas de agenda
