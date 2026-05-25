"use client"

import { useState, useCallback, useMemo } from "react"
import type {
  Paciente,
  Demanda,
  Anexo,
  Interacao,
  Module,
  DemandaStatus,
  CategoriaAnexo,
  User,
  Unidade,
  Notificacao,
  ResetToken,
} from "@/lib/types"

// ── ID gen ─────────────────────────────────────────────
let _c = 500
function uid(prefix = "id") {
  _c++
  return `${prefix}_${_c}_${Date.now().toString(36)}`
}

// ── Protocol number gen ────────────────────────────────
const _protocolCounters: Record<string, number> = { tfd: 4, cnrac: 3, hemodialise: 3 }
export function generateProtocol(modulo: Module): string {
  _protocolCounters[modulo] = (_protocolCounters[modulo] || 0) + 1
  const num = String(_protocolCounters[modulo]).padStart(5, "0")
  return `${modulo.toUpperCase()}-2026-${num}`
}

// ── Seed Users ─────────────────────────────────────────
export const SEED_USERS: (User & { senha: string })[] = [
  { id: "1", nome: "Carlos Alberto", cpf: "123.456.789-00", email: "admin@saude.gov.br", telefone: "(92) 99999-0001", role: "ADMIN", ativo: true, senha: "admin123" },
  { id: "2", nome: "Dra. Ana Beatriz", cpf: "987.654.321-00", email: "medico@saude.gov.br", telefone: "(92) 99999-0002", role: "MEDICO_SES", ativo: true, assinaturaMedicoUrl: "", senha: "medico123" },
  { id: "3", nome: "Jose da Silva", cpf: "456.789.123-00", email: "operador@saude.gov.br", telefone: "(92) 99999-0003", role: "OPERADOR", ativo: true, senha: "operador123" },
  { id: "4", nome: "Maria Fernanda", cpf: "321.654.987-00", email: "regulador@saude.gov.br", telefone: "(92) 99999-0004", role: "REGULADOR", ativo: true, senha: "regulador1" },
  { id: "5", nome: "Pedro Henrique", cpf: "654.321.987-00", email: "visualizador@saude.gov.br", telefone: "(92) 99999-0005", role: "VISUALIZADOR", ativo: true, senha: "visual123" },
  { id: "6", nome: "UBS Cidade Nova", cpf: "000.000.000-00", email: "ubs.cidadenova@saude.am.gov.br", telefone: "(92) 3234-1111", role: "UNIDADE_HOSPITALAR", ativo: true, unidadeNome: "UBS Cidade Nova", senha: "unidade123" },
  { id: "7", nome: "Hospital Regional de Parintins", cpf: "000.000.000-01", email: "hrp@saude.am.gov.br", telefone: "(92) 3533-2222", role: "UNIDADE_HOSPITALAR", ativo: true, unidadeNome: "Hospital Regional de Parintins", senha: "unidade123" },
]

// ── Seed Unidades ──────────────────────────────────────
const SEED_UNIDADES: Unidade[] = [
  { id: "un1", nome: "UBS Cidade Nova", email: "ubs.cidadenova@saude.am.gov.br", telefone: "(92) 3234-1111", endereco: "Rua das Palmeiras, 100 - Cidade Nova, Manaus/AM", ativo: true, criadoEm: "2025-01-01T00:00:00Z" },
  { id: "un2", nome: "Hospital Regional de Parintins", email: "hrp@saude.am.gov.br", telefone: "(92) 3533-2222", endereco: "Av. Amazonas, 500 - Centro, Parintins/AM", ativo: true, criadoEm: "2025-01-01T00:00:00Z" },
  { id: "un3", nome: "Policlinica Codajas", email: "policlinica.codajas@saude.am.gov.br", telefone: "(92) 3214-5555", endereco: "Rua Codajas, 25 - Cachoeirinha, Manaus/AM", ativo: true, criadoEm: "2025-02-01T00:00:00Z" },
  { id: "un4", nome: "HUGV", email: "hugv@saude.am.gov.br", telefone: "(92) 3305-4444", endereco: "Av. Apurina, 4 - Praca 14, Manaus/AM", ativo: true, criadoEm: "2025-02-01T00:00:00Z" },
  { id: "un5", nome: "Hospital Regional de Itacoatiara", email: "hri@saude.am.gov.br", telefone: "(92) 3521-3333", endereco: "Rua Paranaiba, 120 - Centro, Itacoatiara/AM", ativo: true, criadoEm: "2025-03-01T00:00:00Z" },
]

// ── Seed Pacientes ─────────────────────────────────────
const SEED_PACIENTES: Paciente[] = [
  {
    id: "p1", cpf: "111.222.333-44", cartaoSus: "700100200300400",
    nome: "Joao Pedro de Souza", dataNascimento: "1985-03-15",
    telefones: ["(92) 98765-4321", "(92) 3232-4545"], email: "joao.souza@email.com",
    municipio: "Manaus", endereco: "Rua das Flores, 123 - Centro, Manaus/AM",
    criadoEm: "2025-11-01T10:00:00Z", atualizadoEm: "2025-11-01T10:00:00Z",
  },
  {
    id: "p2", cpf: "555.666.777-88", cartaoSus: "700200300400500",
    nome: "Maria Aparecida Lima", dataNascimento: "1972-07-22",
    telefones: ["(92) 91234-5678"], email: "maria.lima@email.com",
    municipio: "Manaus", endereco: "Av. Brasil, 456 - Adrianopolis, Manaus/AM",
    criadoEm: "2025-11-05T14:30:00Z", atualizadoEm: "2025-11-05T14:30:00Z",
  },
  {
    id: "p3", cpf: "222.333.444-55", cartaoSus: "700300400500600",
    nome: "Francisco Alves Ribeiro", dataNascimento: "1960-01-10",
    telefones: ["(92) 99876-5432"], email: "",
    municipio: "Parintins", endereco: "Rua Amazonas, 789 - Centro, Parintins/AM",
    criadoEm: "2025-10-20T09:15:00Z", atualizadoEm: "2025-10-20T09:15:00Z",
  },
  {
    id: "p4", cpf: "888.999.000-11", cartaoSus: "700400500600700",
    nome: "Ana Carolina Santos", dataNascimento: "1990-11-30",
    telefones: ["(92) 93456-7890", "(92) 3234-0000"], email: "ana.santos@email.com",
    municipio: "Manaus", endereco: "Rua Solimoes, 321 - Compensa, Manaus/AM",
    criadoEm: "2025-10-25T11:00:00Z", atualizadoEm: "2025-10-25T11:00:00Z",
  },
  {
    id: "p5", cpf: "333.444.555-66", cartaoSus: "700500600700800",
    nome: "Carlos Eduardo Mendes", dataNascimento: "1955-05-18",
    telefones: ["(92) 92345-6789"], email: "carlos.mendes@email.com",
    municipio: "Itacoatiara", endereco: "Trav. Rio Negro, 654 - Centro, Itacoatiara/AM",
    criadoEm: "2025-09-15T08:00:00Z", atualizadoEm: "2025-09-15T08:00:00Z",
  },
]

// ── Seed Demandas ──────────────────────────────────────
const SEED_DEMANDAS: Demanda[] = [
  {
    id: "d1", protocolo: "TFD-2026-00001", pacienteId: "p1", modulo: "tfd",
    localSolicitante: "UBS Cidade Nova", telefoneSolicitante: ["(92) 3234-1111"], emailSolicitante: "ubs.cidadenova@saude.am.gov.br",
    codigoSigtap: "0211060011", descricaoSigtap: "Consulta em Cardiologia", cid10: "I49.9", especialidade: "Cardiologia", subespecialidade: "Arritmologia",
    peso: "78", altura: "1.72", tipoSanguineo: "O+", observacoesUnidade: "Paciente com arritmia cardiaca complexa",
    tipoSolicitacao: "transito", localSolicitado: "InCor - Sao Paulo/SP", acaoJudicial: false,
    status: "pendente",
    anexos: [
      { id: "a1", nome: "laudo_medico.pdf", tipo: "application/pdf", tamanho: 245000, categoria: "laudo", descricao: "Laudo medico cardiologico", url: "#", criadoEm: "2025-11-01T10:30:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva" },
      { id: "a2", nome: "ecg_resultado.pdf", tipo: "application/pdf", tamanho: 180000, categoria: "laudo", descricao: "Resultado do ECG", url: "#", criadoEm: "2025-11-01T10:31:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva" },
      { id: "a3", nome: "rg_paciente.pdf", tipo: "application/pdf", tamanho: 95000, categoria: "doc_pessoal", descricao: "RG do paciente", url: "#", criadoEm: "2025-11-01T10:32:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva" },
    ],
    interacoes: [
      { id: "i1", demandaId: "d1", texto: "Demanda criada e encaminhada para analise da regulacao.", anexos: [], criadoEm: "2025-11-02T08:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva", criadoPorCpf: "456.789.123-00" },
      { id: "i2", demandaId: "d1", texto: "Laudo analisado. Procedimento autorizado, aguardando agendamento no destino.", pendencia: "pendente_unidade_referencia", anexos: [], criadoEm: "2025-11-05T14:00:00Z", criadoPor: "2", criadoPorNome: "Dra. Ana Beatriz", criadoPorCpf: "987.654.321-00", assinaturaUrl: "" },
    ],
    criadoEm: "2025-11-02T08:00:00Z", atualizadoEm: "2025-11-05T14:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva",
  },
  {
    id: "d2", protocolo: "TFD-2026-00002", pacienteId: "p1", modulo: "tfd",
    localSolicitante: "UBS Cidade Nova", telefoneSolicitante: ["(92) 3234-1111"], emailSolicitante: "ubs.cidadenova@saude.am.gov.br",
    codigoSigtap: "0403010024", descricaoSigtap: "Cirurgia Ortopedica de Joelho", cid10: "M17.1", especialidade: "Ortopedia", subespecialidade: "Joelho",
    peso: "78", altura: "1.72", tipoSanguineo: "O+", observacoesUnidade: "Artrose no joelho direito",
    tipoSolicitacao: "transito", localSolicitado: "Hospital das Clinicas - SP", acaoJudicial: false,
    status: "pendente",
    anexos: [{ id: "a4", nome: "raio_x_joelho.jpg", tipo: "image/jpeg", tamanho: 520000, categoria: "laudo", descricao: "Raio-X do joelho D", url: "#", criadoEm: "2025-12-01T10:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva" }],
    interacoes: [],
    criadoEm: "2025-12-01T09:00:00Z", atualizadoEm: "2025-12-01T09:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva",
  },
  {
    id: "d3", protocolo: "TFD-2026-00003", pacienteId: "p2", modulo: "tfd",
    localSolicitante: "Policlinica Codajas", telefoneSolicitante: ["(92) 3214-5555"], emailSolicitante: "policlinica.codajas@saude.am.gov.br",
    codigoSigtap: "0403010032", descricaoSigtap: "Substituicao Total de Quadril", cid10: "M16.0", especialidade: "Ortopedia", subespecialidade: "Quadril",
    peso: "65", altura: "1.60", tipoSanguineo: "A+", observacoesUnidade: "Paciente com coxartrose bilateral",
    tipoSolicitacao: "transito", localSolicitado: "", acaoJudicial: false,
    status: "resolvido",
    anexos: [],
    interacoes: [
      { id: "i3", demandaId: "d3", texto: "Cirurgia realizada com sucesso. Alta hospitalar concedida.", anexos: [], criadoEm: "2026-01-15T10:00:00Z", criadoPor: "2", criadoPorNome: "Dra. Ana Beatriz", criadoPorCpf: "987.654.321-00", assinaturaUrl: "" },
    ],
    criadoEm: "2025-11-06T09:00:00Z", atualizadoEm: "2026-01-15T10:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva",
  },
  {
    id: "d4", protocolo: "CNRAC-2026-00001", pacienteId: "p3", modulo: "cnrac",
    localSolicitante: "Hospital Regional de Parintins", telefoneSolicitante: ["(92) 3533-2222"], emailSolicitante: "hrp@saude.am.gov.br",
    codigoSigtap: "0406010030", descricaoSigtap: "Revascularizacao do Miocardio", cid10: "I25.1", especialidade: "Cirurgia Cardiovascular", subespecialidade: "",
    peso: "82", altura: "1.68", tipoSanguineo: "B+", observacoesUnidade: "Paciente em lista de espera, 3 vasos comprometidos",
    tipoSolicitacao: "definitiva", localSolicitado: "FCECON - Manaus/AM", acaoJudicial: false,
    status: "pendente",
    anexos: [],
    interacoes: [
      { id: "i4", demandaId: "d4", texto: "Solicitacao inserida no CNRAC. Aguardando vaga.", pendencia: "pendente_ses", anexos: [], criadoEm: "2025-10-22T10:00:00Z", criadoPor: "4", criadoPorNome: "Maria Fernanda", criadoPorCpf: "321.654.987-00" },
    ],
    criadoEm: "2025-10-22T10:00:00Z", atualizadoEm: "2025-11-15T16:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva",
  },
  {
    id: "d5", protocolo: "CNRAC-2026-00002", pacienteId: "p4", modulo: "cnrac",
    localSolicitante: "HUGV", telefoneSolicitante: ["(92) 3305-4444"], emailSolicitante: "hugv@saude.am.gov.br",
    codigoSigtap: "0504010014", descricaoSigtap: "Transplante Renal", cid10: "N18.5", especialidade: "Nefrologia", subespecialidade: "Transplante",
    peso: "58", altura: "1.65", tipoSanguineo: "AB-", observacoesUnidade: "",
    tipoSolicitacao: "definitiva", localSolicitado: "", acaoJudicial: true,
    status: "pendente",
    anexos: [],
    interacoes: [],
    criadoEm: "2025-12-10T11:00:00Z", atualizadoEm: "2025-12-10T11:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva",
  },
  {
    id: "d6", protocolo: "HEMODIALISE-2026-00001", pacienteId: "p5", modulo: "hemodialise",
    localSolicitante: "Hospital Regional de Itacoatiara", telefoneSolicitante: ["(92) 3521-3333"], emailSolicitante: "hri@saude.am.gov.br",
    codigoSigtap: "0305010107", descricaoSigtap: "Hemodialise (maximo 3 sessoes por semana)", cid10: "N18.5", especialidade: "Nefrologia", subespecialidade: "Dialise",
    peso: "75", altura: "1.70", tipoSanguineo: "A-", observacoesUnidade: "Fistula AV confeccionada, paciente estavel",
    tipoSolicitacao: "definitiva", localSolicitado: "Clinica Renal Manaus", acaoJudicial: false,
    status: "pendente",
    anexos: [
      { id: "a5", nome: "exames_laboratoriais.pdf", tipo: "application/pdf", tamanho: 310000, categoria: "laudo", descricao: "Exames laboratoriais recentes", url: "#", criadoEm: "2025-09-15T09:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva" },
    ],
    interacoes: [
      { id: "i5", demandaId: "d6", texto: "Paciente cadastrado para sessoes regulares 3x/semana. APAC emitida.", anexos: [], criadoEm: "2025-09-16T08:00:00Z", criadoPor: "2", criadoPorNome: "Dra. Ana Beatriz", criadoPorCpf: "987.654.321-00", assinaturaUrl: "" },
    ],
    criadoEm: "2025-09-16T08:00:00Z", atualizadoEm: "2025-09-20T10:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva",
  },
  {
    id: "d7", protocolo: "HEMODIALISE-2026-00002", pacienteId: "p5", modulo: "hemodialise",
    localSolicitante: "Hospital Regional de Itacoatiara", telefoneSolicitante: ["(92) 3521-3333"], emailSolicitante: "hri@saude.am.gov.br",
    codigoSigtap: "0305010107", descricaoSigtap: "Renovacao de APAC", cid10: "N18.5", especialidade: "Nefrologia", subespecialidade: "Dialise",
    peso: "75", altura: "1.70", tipoSanguineo: "A-", observacoesUnidade: "Renovacao trimestral",
    tipoSolicitacao: "definitiva", localSolicitado: "Clinica Renal Manaus", acaoJudicial: false,
    status: "devolvida",
    anexos: [],
    interacoes: [
      { id: "i6", demandaId: "d7", texto: "Devolvida por falta de exames atualizados.", pendencia: "pendente_unidade_origem", anexos: [], criadoEm: "2026-01-10T09:00:00Z", criadoPor: "4", criadoPorNome: "Maria Fernanda", criadoPorCpf: "321.654.987-00" },
    ],
    criadoEm: "2026-01-05T10:00:00Z", atualizadoEm: "2026-01-10T09:00:00Z", criadoPor: "3", criadoPorNome: "Jose da Silva",
  },
]

// ═══════════════════════════════════════════════════════
// Global store hook
// ═══════════════════════════════════════════════════════
export function useGlobalStore() {
  const [users, setUsers] = useState<(User & { senha: string })[]>(SEED_USERS)
  const [pacientes, setPacientes] = useState<Paciente[]>(SEED_PACIENTES)
  const [demandas, setDemandas] = useState<Demanda[]>(SEED_DEMANDAS)
  const [unidades, setUnidades] = useState<Unidade[]>(SEED_UNIDADES)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [resetTokens, setResetTokens] = useState<ResetToken[]>([])

  // ── Users CRUD ───────────────────────────────────────
  const addUser = useCallback((data: Omit<User, "id" | "ativo"> & { senha: string }) => {
    const novo = { ...data, id: uid("u"), ativo: true }
    setUsers((prev) => [novo, ...prev])
    return novo
  }, [])

  const updateUserInStore = useCallback((id: string, data: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)))
  }, [])

  const toggleUserActive = useCallback((id: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ativo: !u.ativo } : u)))
  }, [])

  const changePassword = useCallback((userId: string, novaSenha: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, senha: novaSenha } : u)))
  }, [])

  const verifyPassword = useCallback((userId: string, senha: string): boolean => {
    const user = users.find((u) => u.id === userId)
    return user?.senha === senha
  }, [users])

  // ── Password reset ───────────────────────────────────
  const createResetToken = useCallback((email: string): string | null => {
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.ativo)
    if (!user) return null
    const token = uid("rst") + "_" + Math.random().toString(36).slice(2, 10)
    setResetTokens((prev) => [...prev, { token, email: user.email, criadoEm: new Date().toISOString(), usado: false }])
    return token
  }, [users])

  const validateResetToken = useCallback((token: string): ResetToken | null => {
    const rt = resetTokens.find((t) => t.token === token && !t.usado)
    if (!rt) return null
    const created = new Date(rt.criadoEm).getTime()
    if (Date.now() - created > 3600000) return null // 1 hour expiry
    return rt
  }, [resetTokens])

  const useResetToken = useCallback((token: string, novaSenha: string): boolean => {
    const rt = resetTokens.find((t) => t.token === token && !t.usado)
    if (!rt) return false
    const user = users.find((u) => u.email.toLowerCase() === rt.email.toLowerCase())
    if (!user) return false
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, senha: novaSenha } : u)))
    setResetTokens((prev) => prev.map((t) => (t.token === token ? { ...t, usado: true } : t)))
    return true
  }, [resetTokens, users])

  // ── Unidades CRUD ────────────────────────────────────
  const addUnidade = useCallback((data: Omit<Unidade, "id" | "ativo" | "criadoEm">) => {
    const nova: Unidade = { ...data, id: uid("un"), ativo: true, criadoEm: new Date().toISOString() }
    setUnidades((prev) => [nova, ...prev])
    // Auto-create a UNIDADE_HOSPITALAR user for login
    const userEntry = {
      nome: data.nome,
      cpf: "000.000.000-00",
      email: data.email,
      telefone: data.telefone,
      role: "UNIDADE_HOSPITALAR" as const,
      ativo: true,
      unidadeNome: data.nome,
      senha: "unidade123", // default password
    }
    const novoUser = { ...userEntry, id: uid("u") }
    setUsers((prev) => [novoUser, ...prev])
    return nova
  }, [])

  const updateUnidade = useCallback((id: string, data: Partial<Omit<Unidade, "id" | "criadoEm">>) => {
    setUnidades((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)))
  }, [])

  const toggleUnidadeActive = useCallback((id: string) => {
    setUnidades((prev) => prev.map((u) => (u.id === id ? { ...u, ativo: !u.ativo } : u)))
  }, [])

  // ── Notificacoes ─────────────────────────────────────
  const addNotificacao = useCallback((data: Omit<Notificacao, "id" | "lida" | "criadoEm">) => {
    const nova: Notificacao = { ...data, id: uid("n"), lida: false, criadoEm: new Date().toISOString() }
    setNotificacoes((prev) => [nova, ...prev])
    return nova
  }, [])

  const markNotificacaoRead = useCallback((id: string) => {
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
  }, [])

  const markAllNotificacoesRead = useCallback((userId: string) => {
    setNotificacoes((prev) => prev.map((n) => (n.destinatarioId === userId || n.destinatarioId === "all" ? { ...n, lida: true } : n)))
  }, [])

  const getNotificacoesForUser = useCallback((userId: string) => {
    return notificacoes.filter((n) => n.destinatarioId === userId || n.destinatarioId === "all")
  }, [notificacoes])

  const getUnreadCount = useCallback((userId: string) => {
    return notificacoes.filter((n) => (n.destinatarioId === userId || n.destinatarioId === "all") && !n.lida).length
  }, [notificacoes])

  // ── Paciente CRUD ────────────────────────────────────
  const findPacienteByCpfOrCns = useCallback(
    (query: string) => {
      const q = query.replace(/\D/g, "")
      return pacientes.find(
        (p) => p.cpf.replace(/\D/g, "") === q || p.cartaoSus === q,
      ) ?? null
    },
    [pacientes],
  )

  const addPaciente = useCallback(
    (data: Omit<Paciente, "id" | "criadoEm" | "atualizadoEm">) => {
      const now = new Date().toISOString()
      const novo: Paciente = { ...data, id: uid("p"), criadoEm: now, atualizadoEm: now }
      setPacientes((prev) => [novo, ...prev])
      return novo
    },
    [],
  )

  const updatePaciente = useCallback(
    (id: string, data: Partial<Omit<Paciente, "id" | "criadoEm">>) => {
      setPacientes((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, ...data, atualizadoEm: new Date().toISOString() } : p,
        ),
      )
    },
    [],
  )

  // ── Demanda CRUD ─────────────────────────────────────
  const demandasByModule = useCallback(
    (modulo: Module) => demandas.filter((d) => d.modulo === modulo),
    [demandas],
  )

  const demandasByPaciente = useCallback(
    (pacienteId: string) => demandas.filter((d) => d.pacienteId === pacienteId),
    [demandas],
  )

  const demandasByEmail = useCallback(
    (email: string) => demandas.filter((d) => d.emailSolicitante.toLowerCase() === email.toLowerCase()),
    [demandas],
  )

  const getDemandaByProtocol = useCallback(
    (protocolo: string) => demandas.find((d) => d.protocolo === protocolo) ?? null,
    [demandas],
  )

  const getDemandaById = useCallback(
    (id: string) => demandas.find((d) => d.id === id) ?? null,
    [demandas],
  )

  const addDemanda = useCallback(
    (data: Omit<Demanda, "id" | "protocolo" | "status" | "anexos" | "interacoes" | "criadoEm" | "atualizadoEm">) => {
      const now = new Date().toISOString()
      const nova: Demanda = {
        ...data,
        id: uid("d"),
        protocolo: generateProtocol(data.modulo),
        status: "pendente",
        anexos: [],
        interacoes: [],
        criadoEm: now,
        atualizadoEm: now,
      }
      setDemandas((prev) => [nova, ...prev])
      return nova
    },
    [],
  )

  const updateDemandaStatus = useCallback((id: string, status: DemandaStatus) => {
    setDemandas((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status, atualizadoEm: new Date().toISOString() } : d,
      ),
    )
  }, [])

  // ── Anexos ───────────────────────────────────────────
  const addAnexoToDemanda = useCallback(
    (demandaId: string, file: { nome: string; tipo: string; tamanho: number; categoria: CategoriaAnexo; descricao: string; criadoPor: string; criadoPorNome: string }) => {
      const anexo: Anexo = { ...file, id: uid("a"), url: "#", criadoEm: new Date().toISOString() }
      setDemandas((prev) =>
        prev.map((d) =>
          d.id === demandaId
            ? { ...d, anexos: [...d.anexos, anexo], atualizadoEm: new Date().toISOString() }
            : d,
        ),
      )
      return anexo
    },
    [],
  )

  const removeAnexoFromDemanda = useCallback((demandaId: string, anexoId: string) => {
    setDemandas((prev) =>
      prev.map((d) =>
        d.id === demandaId
          ? { ...d, anexos: d.anexos.filter((a) => a.id !== anexoId), atualizadoEm: new Date().toISOString() }
          : d,
      ),
    )
  }, [])

  // ── Interacoes ───────────────────────────────────────
  const addInteracao = useCallback(
    (demandaId: string, data: Omit<Interacao, "id" | "demandaId" | "criadoEm" | "anexos"> & { anexos?: Anexo[] }) => {
      const interacao: Interacao = {
        ...data,
        id: uid("int"),
        demandaId,
        anexos: data.anexos ?? [],
        criadoEm: new Date().toISOString(),
      }
      setDemandas((prev) =>
        prev.map((d) =>
          d.id === demandaId
            ? { ...d, interacoes: [...d.interacoes, interacao], atualizadoEm: new Date().toISOString() }
            : d,
        ),
      )
      return interacao
    },
    [],
  )

  const addAnexoToInteracao = useCallback(
    (demandaId: string, interacaoId: string, file: { nome: string; tipo: string; tamanho: number; categoria: CategoriaAnexo; descricao: string; criadoPor: string; criadoPorNome: string }) => {
      const anexo: Anexo = { ...file, id: uid("a"), url: "#", criadoEm: new Date().toISOString() }
      setDemandas((prev) =>
        prev.map((d) =>
          d.id === demandaId
            ? {
                ...d,
                interacoes: d.interacoes.map((i) =>
                  i.id === interacaoId ? { ...i, anexos: [...i.anexos, anexo] } : i,
                ),
              }
            : d,
        ),
      )
      return anexo
    },
    [],
  )

  // ── Stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    const byMod = (m: Module) => demandas.filter((d) => d.modulo === m)
    return {
      totalPacientes: pacientes.length,
      totalDemandas: demandas.length,
      totalUnidades: unidades.length,
      tfd: { total: byMod("tfd").length, pendente: byMod("tfd").filter((d) => d.status === "pendente").length },
      cnrac: { total: byMod("cnrac").length, pendente: byMod("cnrac").filter((d) => d.status === "pendente").length },
      hemodialise: { total: byMod("hemodialise").length, pendente: byMod("hemodialise").filter((d) => d.status === "pendente").length },
    }
  }, [pacientes, demandas, unidades])

  return {
    users, addUser, updateUserInStore, toggleUserActive, changePassword, verifyPassword,
    resetTokens, createResetToken, validateResetToken, useResetToken,
    pacientes, findPacienteByCpfOrCns, addPaciente, updatePaciente,
    demandas, demandasByModule, demandasByPaciente, demandasByEmail, getDemandaByProtocol, getDemandaById,
    addDemanda, updateDemandaStatus,
    addAnexoToDemanda, removeAnexoFromDemanda,
    addInteracao, addAnexoToInteracao,
    unidades, addUnidade, updateUnidade, toggleUnidadeActive,
    notificacoes, addNotificacao, markNotificacaoRead, markAllNotificacoesRead, getNotificacoesForUser, getUnreadCount,
    stats,
  }
}
