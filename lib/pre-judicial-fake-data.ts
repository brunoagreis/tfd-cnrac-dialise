import type { Demanda, Paciente, Unidade, User } from "@/lib/types"
import type {
  PreJudicialAttachment,
  PreJudicialAuditEvent,
  PreJudicialCase,
  PreJudicialCid,
  PreJudicialMovement,
  PreJudicialProcedure,
} from "@/lib/pre-judicial-types"

function safeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function daysFromNow(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

const PROCEDURE_CATALOG = [
  { sigtapCode: "04.01.01.001-2", description: "Consulta em ortopedia" },
  { sigtapCode: "04.01.01.002-0", description: "Consulta em cardiologia" },
  { sigtapCode: "04.01.01.003-9", description: "Consulta em neurologia" },
  { sigtapCode: "04.09.05.001-0", description: "Ressonância magnética" },
  { sigtapCode: "04.07.03.012-8", description: "Cirurgia ortopédica" },
]

const CID_CATALOG = [
  { code: "M17", description: "Gonartrose" },
  { code: "I50", description: "Insuficiência cardíaca" },
  { code: "G40", description: "Epilepsia" },
  { code: "N18", description: "Doença renal crônica" },
]

export function getPreJudicialProcedureCatalog() {
  return PROCEDURE_CATALOG
}

export function getPreJudicialCidCatalog() {
  return CID_CATALOG
}

function makeAttachment(createdByName: string, createdById: string, name: string, category: PreJudicialAttachment["category"]): PreJudicialAttachment {
  return {
    id: safeId("pre_att"),
    name,
    category,
    createdAt: new Date().toISOString(),
    createdById,
    createdByName,
  }
}

function makeMovement(createdByName: string, createdById: string, type: PreJudicialMovement["type"], description: string, createdAt: string, extras?: Partial<PreJudicialMovement>): PreJudicialMovement {
  return {
    id: safeId("pre_mov"),
    type,
    description,
    createdAt,
    createdById,
    createdByName,
    attachments: [],
    ...extras,
  }
}

function warningLevel(deadlineAt: string): PreJudicialCase["deadlineWarningLevel"] {
  const diff = Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 86400000)
  if (diff < 0) return "overdue"
  if (diff <= 2) return "critical"
  if (diff <= 5) return "warning"
  return "ok"
}

function municipalityName(index: number, paciente: Paciente, unidades: Unidade[]) {
  return paciente.municipio || unidades[index % Math.max(1, unidades.length)]?.nome || "Município não informado"
}

export function buildInitialPreJudicialCases(pacientes: Paciente[], demandas: Demanda[], unidades: Unidade[], users: User[]): PreJudicialCase[] {
  const actor = users.find((u) => ["ADMIN", "OPERADOR", "REGULADOR", "MEDICO_SES"].includes(u.role))
  const createdByName = actor?.nome ?? "Sistema"
  const createdById = actor?.id ?? "system"

  return demandas.slice(3, 15).map((d, idx) => {
    const paciente = pacientes.find((p) => p.id === d.pacienteId) ?? pacientes[idx % Math.max(1, pacientes.length)]
    const procedure: PreJudicialProcedure = {
      id: safeId("pre_proc"),
      sigtapCode: d.codigoSigtap || PROCEDURE_CATALOG[idx % PROCEDURE_CATALOG.length].sigtapCode,
      description: d.descricaoSigtap || PROCEDURE_CATALOG[idx % PROCEDURE_CATALOG.length].description,
      active: true,
      createdAt: daysAgo(12 + idx),
      createdByName,
    }
    const cid: PreJudicialCid = {
      id: safeId("pre_cid"),
      code: d.cid10 || CID_CATALOG[idx % CID_CATALOG.length].code,
      description: CID_CATALOG[idx % CID_CATALOG.length].description,
      active: true,
      createdAt: daysAgo(12 + idx),
      createdByName,
    }
    const deadlineAt = idx % 4 === 0 ? daysFromNow(1) : idx % 4 === 1 ? daysFromNow(4) : idx % 4 === 2 ? daysAgo(1) : daysFromNow(8)
    const movements: PreJudicialMovement[] = [
      makeMovement(createdByName, createdById, "cadastro", "Demanda pré judicial cadastrada no módulo.", daysAgo(10 + idx)),
      makeMovement(createdByName, createdById, "notificacao_municipio", "Notificação inicial enviada ao município de residência.", daysAgo(9 + idx)),
    ]

    if (idx % 3 === 0) {
      movements.push(makeMovement(createdByName, createdById, "envio_agendamento_demanda", "Encaminhado para o Agendamento da Demanda com prazo de resposta.", daysAgo(2), { dueAt: deadlineAt }))
    }
    if (idx % 5 === 0) {
      movements.push(makeMovement(createdByName, createdById, "reserva_agendamento", "Setor informou reserva técnica da demanda.", daysAgo(1), { dueAt: daysFromNow(3) }))
    }

    return {
      id: safeId("pre_case"),
      patientId: paciente.id,
      patientName: paciente.nome,
      cpf: paciente.cpf,
      municipalityName: municipalityName(idx, paciente, unidades),
      originModule: idx % 2 === 0 ? "pre_judicial" : idx % 4 === 1 ? "tfd" : idx % 4 === 3 ? "cnrac" : "hemodialise",
      originProtocol: `PRJ-ORIG-${String(idx + 1).padStart(4, "0")}`,
      protocolNumber: `PREJ-${2026}${String(idx + 1).padStart(5, "0")}`,
      active: true,
      status: idx % 3 === 0 ? "enviado_agendamento" : idx % 5 === 0 ? "reservado" : warningLevel(deadlineAt) === "overdue" ? "nao_resolvido_setor" : "ativo",
      priority: 50 + (idx % 5) * 10,
      createdAt: daysAgo(12 + idx),
      updatedAt: daysAgo(idx % 2),
      deadlineAt,
      deadlineWarningLevel: warningLevel(deadlineAt),
      schedulingStatus: idx % 3 === 0 ? "pendente" : idx % 5 === 0 ? "reservado" : "fora_fila",
      schedulingRequestedAt: idx % 3 === 0 ? daysAgo(2) : undefined,
      schedulingReservedAt: idx % 5 === 0 ? daysAgo(1) : undefined,
      schedulingResponseDeadlineAt: idx % 3 === 0 || idx % 5 === 0 ? deadlineAt : undefined,
      appointmentDate: idx % 6 === 0 ? daysFromNow(5) : undefined,
      procedures: [procedure],
      cids: [cid],
      attachments: [makeAttachment(createdByName, createdById, `pre-judicial-${idx + 1}.pdf`, "documento")],
      movements,
    }
  })
}

export function buildInitialPreJudicialAudit(cases: PreJudicialCase[], users: User[]): PreJudicialAuditEvent[] {
  const actor = users.find((u) => ["ADMIN", "OPERADOR", "REGULADOR", "MEDICO_SES"].includes(u.role))
  const name = actor?.nome ?? "Sistema"
  const userId = actor?.id ?? "system"
  return cases.flatMap((item) => item.movements.map((mov) => ({
    id: safeId("pre_audit"),
    createdAt: mov.createdAt,
    userId,
    userName: name,
    caseId: item.id,
    action: mov.type,
    details: mov.description,
  })))
}
