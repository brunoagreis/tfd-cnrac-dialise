import type { Demanda, Paciente, Unidade, User } from "@/lib/types"
import type {
  AgendaOffer,
  CoreHistoryEntry,
  CoreRow,
  EmailTemplate,
  JudicialAttachment,
  JudicialCase,
  JudicialCid,
  JudicialFicha,
  JudicialMovement,
  JudicialProcedure,
  MunicipalityContact,
  UiAuditEvent,
} from "@/lib/judicial-types"

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
  {
    sigtapCode: "04.01.01.001-2",
    description: "Consulta em ortopedia",
    specialty: "Ortopedia",
    subSpecialty: "Joelho",
  },
  {
    sigtapCode: "04.01.01.002-0",
    description: "Consulta em cardiologia",
    specialty: "Cardiologia",
    subSpecialty: "Clínica",
  },
  {
    sigtapCode: "04.01.01.003-9",
    description: "Consulta em neurologia",
    specialty: "Neurologia",
    subSpecialty: "Adulto",
  },
  {
    sigtapCode: "04.01.01.004-7",
    description: "Consulta em nefrologia",
    specialty: "Nefrologia",
    subSpecialty: "Doença renal crônica",
  },
  {
    sigtapCode: "04.09.05.001-0",
    description: "Ressonância magnética",
    specialty: "Diagnóstico por imagem",
    subSpecialty: "Ressonância",
  },
  {
    sigtapCode: "04.07.03.012-8",
    description: "Cirurgia ortopédica",
    specialty: "Ortopedia",
    subSpecialty: "Cirurgia de joelho",
  },
]

const CID_CATALOG = [
  { code: "M17", description: "Gonartrose" },
  { code: "I50", description: "Insuficiência cardíaca" },
  { code: "N18", description: "Doença renal crônica" },
  { code: "G40", description: "Epilepsia" },
  { code: "C50", description: "Neoplasia maligna da mama" },
]

export function getProcedureCatalog() {
  return PROCEDURE_CATALOG
}

export function getCidCatalog() {
  return CID_CATALOG
}

function makeAttachment(createdByName: string, createdById: string, name: string, category: JudicialAttachment["category"]): JudicialAttachment {
  return {
    id: safeId("att"),
    name,
    category,
    createdAt: new Date().toISOString(),
    createdById,
    createdByName,
    source: "processo",
  }
}

function makeMovement(createdByName: string, createdById: string, type: JudicialMovement["type"], description: string, createdAt: string, extras?: Partial<JudicialMovement>): JudicialMovement {
  return {
    id: safeId("mov"),
    type,
    description,
    createdAt,
    createdById,
    createdByName,
    attachments: [],
    ...extras,
  }
}

function pickMunicipality(index: number, paciente: Paciente, unidades: Unidade[]) {
  const unit = unidades[index % Math.max(1, unidades.length)]
  return paciente.municipio || unit?.nome || "Município não informado"
}

export function buildInitialContacts(pacientes: Paciente[], unidades: Unidade[]): MunicipalityContact[] {
  const unique = new Map<string, MunicipalityContact>()
  pacientes.slice(0, 12).forEach((p, idx) => {
    const municipalityName = pickMunicipality(idx, p, unidades)
    if (!unique.has(municipalityName)) {
      unique.set(municipalityName, {
        id: safeId("mun"),
        municipalityName,
        emails: [`saude.${municipalityName.toLowerCase().replace(/\s+/g, "")}@municipio.gov.br`],
        phones: ["(67) 99999-0000"],
        contacts: ["Coordenação Municipal de Regulação"],
        updatedAt: new Date().toISOString(),
      })
    }
  })
  return [...unique.values()]
}

export function buildInitialTemplates(): EmailTemplate[] {
  const now = new Date().toISOString()
  return [
    {
      id: safeId("tpl"),
      type: "demanda_judicial_cadastrada",
      title: "Demanda judicial cadastrada",
      subject: "Demanda judicial cadastrada - $nome_paciente - $numero_processo",
      body: "Prezados, foi cadastrada demanda judicial para $nome_paciente (CPF $cpf), processo $numero_processo, ficha CORE $ficha_core. Protocolo interno: $protocolo_judicial.",
      updatedAt: now,
    },
    {
      id: safeId("tpl"),
      type: "solicitar_inclusao_ficha",
      title: "Solicitar inclusão da observação judicial",
      subject: "Solicitação de inclusão judicial em ficha CORE - $nome_paciente",
      body: "Solicitamos incluir a observação judicial na ficha $ficha_core do paciente $nome_paciente, CPF $cpf, processo $numero_processo.",
      updatedAt: now,
    },
    {
      id: safeId("tpl"),
      type: "reiteracao_municipio",
      title: "Reiteração ao município",
      subject: "Reiteração - processo judicial $numero_processo",
      body: "Reiteramos a solicitação referente ao paciente $nome_paciente, ficha $ficha_core, processo $numero_processo.",
      updatedAt: now,
    },
    {
      id: safeId("tpl"),
      type: "agendamento_informado",
      title: "Agendamento informado",
      subject: "Agendamento informado - $nome_paciente - $data_agendamento",
      body: "Informamos que a demanda judicial do paciente $nome_paciente foi agendada para $data_agendamento. Protocolo $protocolo_judicial.",
      updatedAt: now,
    },
    {
      id: safeId("tpl"),
      type: "inercia_municipio",
      title: "Inércia do município",
      subject: "Inércia do município - processo $numero_processo",
      body: "Após reiterações sem resposta, registramos inércia do município no processo $numero_processo de $nome_paciente.",
      updatedAt: now,
    },
    {
      id: safeId("tpl"),
      type: "demanda_prejudicial_cadastrada",
      title: "Demanda pré judicial cadastrada",
      subject: "Demanda pré judicial cadastrada - $nome_paciente - $protocolo_prejudicial",
      body: "Foi cadastrada demanda pré judicial para $nome_paciente (CPF $cpf), protocolo $protocolo_prejudicial, com ciência ao município.",
      updatedAt: now,
    },
    {
      id: safeId("tpl"),
      type: "prazo_prejudicial_vencendo",
      title: "Prazo do pré judicial vencendo",
      subject: "Prazo próximo do fim - $nome_paciente - $protocolo_prejudicial",
      body: "A demanda pré judicial de $nome_paciente, protocolo $protocolo_prejudicial, está próxima do vencimento do prazo de resposta.",
      updatedAt: now,
    },
    {
      id: safeId("tpl"),
      type: "prazo_prejudicial_vencido",
      title: "Prazo do pré judicial vencido",
      subject: "Prazo vencido - $nome_paciente - $protocolo_prejudicial",
      body: "A demanda pré judicial de $nome_paciente, protocolo $protocolo_prejudicial, foi marcada como não resolvida por falta de interação do setor responsável.",
      updatedAt: now,
    },
  ]
}

export function buildInitialCases(pacientes: Paciente[], demandas: Demanda[], unidades: Unidade[], users: User[]): JudicialCase[] {
  const monitorUser = users.find((u) => ["OPERADOR", "REGULADOR", "MEDICO_SES"].includes(u.role))
  const createdByName = monitorUser?.nome ?? "Sistema"
  const createdById = monitorUser?.id ?? "system"

  const baseDemandas = demandas.slice(0, 18)
  return baseDemandas.map((d, idx) => {
    const paciente = pacientes.find((p) => p.id === d.pacienteId) ?? pacientes[idx % Math.max(1, pacientes.length)]
    const procedure: JudicialProcedure = {
      id: safeId("proc"),
      sigtapCode: d.codigoSigtap || PROCEDURE_CATALOG[idx % PROCEDURE_CATALOG.length].sigtapCode,
      description: d.descricaoSigtap || PROCEDURE_CATALOG[idx % PROCEDURE_CATALOG.length].description,
      active: true,
      createdAt: daysAgo(35 + idx),
      createdByName,
    }

    const cid: JudicialCid = {
      id: safeId("cid"),
      code: d.cid10 || CID_CATALOG[idx % CID_CATALOG.length].code,
      description: CID_CATALOG[idx % CID_CATALOG.length].description,
      active: true,
      createdAt: daysAgo(35 + idx),
      createdByName,
    }

    const withCore = idx % 4 !== 0
    const ficha: JudicialFicha[] = withCore
      ? [{
          id: safeId("ficha"),
          system: "CORE",
          number: `CORE-${2026}${String(idx + 1).padStart(5, "0")}`,
          includedAt: daysAgo(20 + idx),
          requestedInclusion: idx % 5 === 0,
          hasJudicialMark: idx % 3 !== 0,
          attachmentName: `ficha-core-${idx + 1}.pdf`,
          notes: "Ficha importada para monitoramento judicial.",
        }]
      : [{
          id: safeId("ficha"),
          system: "OUTRO",
          includedAt: daysAgo(18 + idx),
          requestedInclusion: false,
          hasJudicialMark: false,
          attachmentName: `oficio-solicitacao-${idx + 1}.pdf`,
          notes: "Paciente ainda sem ficha CORE no cadastro local.",
        }]

    const movements: JudicialMovement[] = [
      makeMovement(
        createdByName,
        createdById,
        "monitoramento",
        "Cadastro inicial da ação judicial no módulo.",
        daysAgo(40 + idx),
      ),
      ...(idx % 3 === 0
        ? [makeMovement(
            createdByName,
            createdById,
            "solicitacao_inclusao",
            "Solicitada inclusão/ajuste de ficha ao município.",
            daysAgo(8 + idx % 4),
            { responseRequestedAt: daysAgo(8 + idx % 4) },
          )]
        : []),
      ...(idx % 5 === 0
        ? [makeMovement(
            createdByName,
            createdById,
            "descumprimento",
            "Registrado possível descumprimento da obrigação judicial.",
            daysAgo(12),
          )]
        : []),
      ...(idx % 6 === 0
        ? [makeMovement(
            createdByName,
            createdById,
            "envio_agendamento_demanda",
            "Encaminhado para análise do Agendamento da Demanda.",
            daysAgo(4),
          )]
        : []),
      ...(idx % 6 === 1
        ? [makeMovement(
            createdByName,
            createdById,
            "agendamento",
            "Paciente com agendamento informado.",
            daysAgo(1),
            { appointmentDate: daysFromNow(1) },
          )]
        : []),
    ]

    const appointmentMovement = movements.find((m) => m.type === "agendamento")
    const municipalityManifestations = idx % 4 === 0
      ? []
      : [{
          id: safeId("man"),
          createdAt: daysAgo(2 + idx % 3),
          createdByName: "Município",
          description: "Município informa acompanhamento do caso e diligências em andamento.",
          attachments: [],
        }]

    const coreHistory: CoreHistoryEntry[] = withCore
      ? [{
          id: safeId("coreh"),
          table: idx % 2 === 0 ? "core_ambulatorial" : "core_leito",
          fichaNumber: ficha[0].number!,
          patientName: paciente?.nome ?? d.protocolo,
          appointmentDate: idx % 6 === 1 ? daysFromNow(1) : undefined,
          procedureCode: procedure.sigtapCode,
          procedureDescription: procedure.description,
          statusText: idx % 6 === 1 ? "Agendado na base CORE" : "Sem agendamento localizado",
          importedAt: daysAgo(1),
        }]
      : []

    return {
      id: safeId("case"),
      patientId: paciente?.id ?? safeId("p"),
      patientName: paciente?.nome ?? `Paciente ${idx + 1}`,
      cpf: paciente?.cpf ?? "000.000.000-00",
      municipalityName: pickMunicipality(idx, paciente!, unidades),
      originModule: d.modulo,
      originProtocol: d.protocolo,
      processNumber: `0800.${2026}.${String(idx + 1).padStart(6, "0")}`,
      active: idx % 7 !== 0,
      status: idx % 7 === 0 ? "encerrado" : idx % 6 === 1 ? "agendado" : "ativo",
      priority: 50 + (idx % 10),
      lastMonitoredAt: daysAgo(31 + idx % 11),
      lastMovementAt: movements[movements.length - 1]?.createdAt ?? daysAgo(1),
      monitoringMode: withCore ? "automatic_core" : "humano",
      monitoringModeReason: withCore ? "Paciente possui ficha CORE registrada." : "Paciente depende de acompanhamento humano por ausência de ficha CORE.",
      schedulingStatus: idx % 6 === 0 ? "pendente" : idx % 6 === 2 ? "reservado" : "fora_fila",
      schedulingRequestedAt: idx % 6 === 0 ? daysAgo(4) : idx % 6 === 2 ? daysAgo(7) : undefined,
      schedulingReservedAt: idx % 6 === 2 ? daysAgo(11) : undefined,
      appointmentDate: appointmentMovement?.appointmentDate,
      appointmentConfirmedAt: appointmentMovement?.createdAt,
      procedures: [procedure],
      cids: [cid],
      fichas: ficha,
      attachments: [
        makeAttachment(createdByName, createdById, `resumo-processo-${idx + 1}.pdf`, "monitoramento"),
        makeAttachment(createdByName, createdById, `laudo-${idx + 1}.pdf`, "outros"),
      ],
      movements,
      municipalityManifestations,
      coreHistory,
    }
  })
}

export function buildInitialCoreRows(cases: JudicialCase[]): CoreRow[] {
  return cases
    .filter((c) => c.fichas.some((f) => f.system === "CORE" && f.number))
    .slice(0, 12)
    .map((c, idx) => ({
      id: safeId("cr"),
      table: idx % 2 === 0 ? "core_ambulatorial" : idx % 3 === 0 ? "core_urgencia" : "core_leito",
      fichaNumber: c.fichas.find((f) => f.system === "CORE" && f.number)?.number ?? "",
      patientName: c.patientName,
      cpf: c.cpf,
      appointmentDate: idx % 4 === 0 ? daysFromNow(2) : undefined,
      procedureCode: c.procedures[0]?.sigtapCode,
      procedureDescription: c.procedures[0]?.description,
      statusText: idx % 4 === 0 ? "Agendado" : "Sem agendamento",
      importedAt: new Date().toISOString(),
    }))
}

export function buildInitialAgendaOffers(): AgendaOffer[] {
  return [
    {
      id: safeId("ag"),
      specialty: "Ortopedia",
      subSpecialty: "Joelho",
      procedureCode: "04.01.01.001-2",
      procedureDescription: "Consulta em ortopedia",
      date: daysFromNow(3),
      seats: 8,
      importedAt: new Date().toISOString(),
    },
    {
      id: safeId("ag"),
      specialty: "Cardiologia",
      procedureCode: "04.01.01.002-0",
      procedureDescription: "Consulta em cardiologia",
      cidCode: "I50",
      date: daysFromNow(5),
      seats: 6,
      importedAt: new Date().toISOString(),
    },
  ]
}

export function buildInitialAudit(users: User[]): UiAuditEvent[] {
  const user = users.find((u) => ["OPERADOR", "REGULADOR"].includes(u.role)) ?? users[0]
  if (!user) return []
  return [
    {
      id: safeId("audit"),
      createdAt: new Date().toISOString(),
      userId: user.id,
      userName: user.nome,
      action: "login_monitoramento",
      details: "Usuário acessou o módulo judicial.",
    },
  ]
}
