import { z } from "zod"

// ── Roles ──────────────────────────────────────────────
export const ROLES = [
  "ADMIN",
  "MEDICO_SES",
  "REGULADOR",
  "OPERADOR",
  "VISUALIZADOR",
  "UNIDADE_HOSPITALAR",
] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  MEDICO_SES: "Medico SES",
  REGULADOR: "Regulador",
  OPERADOR: "Operador",
  VISUALIZADOR: "Visualizador",
  UNIDADE_HOSPITALAR: "Unidade Hospitalar",
}

// ── Modules ────────────────────────────────────────────
export const MODULES = ["tfd", "cnrac", "hemodialise"] as const
export type Module = (typeof MODULES)[number]

export const MODULE_LABELS: Record<Module, string> = {
  tfd: "TFD",
  cnrac: "CNRAC",
  hemodialise: "Hemodialise",
}

export const ACCESS_MODULES = [
  "tfd",
  "cnrac",
  "hemodialise",
  "judicial",
  "pre_judicial",
  "agendamento",
  "relatorios",
] as const
export type AccessModule = (typeof ACCESS_MODULES)[number]

export const ACCESS_MODULE_LABELS: Record<AccessModule, string> = {
  tfd: "TFD",
  cnrac: "CNRAC",
  hemodialise: "Hemodialise",
  judicial: "Judicial",
  pre_judicial: "Pré Judicial",
  agendamento: "Agendamento",
  relatorios: "Relatórios",
}

// ── Actions ────────────────────────────────────────────
export const ACTIONS = [
  "visualizar",
  "criar",
  "editar",
  "excluir",
  "imprimir",
  "interagir",
  "remover_documento",
] as const
export type Action = (typeof ACTIONS)[number]

export const ACTION_LABELS: Record<Action, string> = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  imprimir: "Imprimir",
  interagir: "Interagir",
  remover_documento: "Remover doc.",
}

// ── Permission matrix ──────────────────────────────────
export type PermissionMatrix = Record<
  Role,
  Record<AccessModule, Record<Action, boolean>>
>

// ── User ───────────────────────────────────────────────
export interface User {
  id: string
  nome: string
  cpf: string
  email: string
  telefone: string
  role: Role
  ativo: boolean
  assinaturaMedicoUrl?: string
  fotoUrl?: string
  unidadeNome?: string // only for UNIDADE_HOSPITALAR
}

// ── Unidade (hospital/clinic registered) ───────────────
export interface Unidade {
  id: string
  nome: string
  email: string // unique identifier
  telefone: string
  endereco: string
  ativo: boolean
  criadoEm: string
}

export const unidadeSchema = z.object({
  nome: z.string().min(2, "Nome obrigatorio").max(200, "Nome muito longo"),
  email: z.string().email("E-mail invalido"),
  telefone: z.string().min(10, "Telefone invalido").max(15, "Telefone invalido"),
  endereco: z.string().min(5, "Endereco obrigatorio"),
})
export type UnidadeFormData = z.infer<typeof unidadeSchema>

// ── Notification ───────────────────────────────────────
export interface Notificacao {
  id: string
  protocolo: string
  modulo: Module
  mensagem: string
  lida: boolean
  criadoEm: string
  destinatarioId: string // user id or "all"
  pacienteNome: string
}

// ── Password reset token ───────────────────────────────
export interface ResetToken {
  token: string
  email: string
  criadoEm: string
  usado: boolean
}

// ── Login ──────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().min(1, "Campo obrigatorio").email("Formato de e-mail invalido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  lembrarMe: z.boolean().optional(),
})
export type LoginFormData = z.infer<typeof loginSchema>

// ── Perfil ─────────────────────────────────────────────
export const perfilSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(120, "Nome muito longo"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF invalido (formato: 000.000.000-00)"),
  email: z.string().min(1, "Campo obrigatorio").email("Formato de e-mail invalido"),
  telefone: z.string().min(10, "Telefone invalido").max(15, "Telefone invalido"),
})
export type PerfilFormData = z.infer<typeof perfilSchema>

// ── User registration (admin) ──────────────────────────
export const userRegistrationSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(120, "Nome muito longo"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF invalido (formato: 000.000.000-00)"),
  email: z.string().min(1, "Campo obrigatorio").email("Formato de e-mail invalido"),
  telefone: z.string().min(10, "Telefone invalido").max(15, "Telefone invalido"),
  role: z.enum(ROLES, { required_error: "Selecione um perfil" }),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
})
export type UserRegistrationData = z.infer<typeof userRegistrationSchema>

// ── Paciente (1 paciente = N demandas) ─────────────────
export interface Paciente {
  id: string
  cpf: string
  cartaoSus: string
  nome: string
  dataNascimento: string
  telefones: string[]
  email: string
  municipio: string
  endereco: string
  criadoEm: string
  atualizadoEm: string
}

export const pacienteSchema = z.object({
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF invalido (formato: 000.000.000-00)"),
  cartaoSus: z.string().min(15, "Cartao SUS invalido (15 digitos)").max(15, "Cartao SUS invalido (15 digitos)"),
  nome: z.string().min(2, "Nome obrigatorio").max(120, "Nome muito longo"),
  dataNascimento: z.string().min(1, "Data de nascimento obrigatoria"),
  telefones: z.array(z.string().min(10, "Telefone invalido")).min(1, "Informe ao menos um telefone"),
  email: z.string().email("E-mail invalido").or(z.literal("")),
  municipio: z.string().min(2, "Municipio obrigatorio"),
  endereco: z.string().min(5, "Endereco obrigatorio"),
})
export type PacienteFormData = z.infer<typeof pacienteSchema>

// ── Demanda statuses ───────────────────────────────────
export const DEMANDA_STATUS = [
  "pendente",
  "resolvido",
  "devolvida",
] as const
export type DemandaStatus = (typeof DEMANDA_STATUS)[number]

export const DEMANDA_STATUS_LABELS: Record<DemandaStatus, string> = {
  pendente: "Pendente",
  resolvido: "Resolvido",
  devolvida: "Devolvida",
}

// ── Pendency types ─────────────────────────────────────
export const PENDENCIA_TIPOS = [
  "pendente_unidade_referencia",
  "pendente_unidade_origem",
  "pendente_area_tecnica",
  "pendente_avaliacao_medica_ses",
  "avaliacao_medica_concluida",
  "pendente_ses",
] as const
export type PendenciaTipo = (typeof PENDENCIA_TIPOS)[number]

export const PENDENCIA_LABELS: Record<PendenciaTipo, string> = {
  pendente_unidade_referencia: "Pendente Unidade de Referencia",
  pendente_unidade_origem: "Pendente Unidade de Origem",
  pendente_area_tecnica: "Pendente Area Tecnica",
  pendente_avaliacao_medica_ses: "Aguardando Avaliacao Medica SES",
  avaliacao_medica_concluida: "Avaliacao Medica Concluida",
  pendente_ses: "Pendente SES",
}

// ── Tipo solicitacao ───────────────────────────────────
export const TIPO_SOLICITACAO = ["transito", "definitiva"] as const
export type TipoSolicitacao = (typeof TIPO_SOLICITACAO)[number]

export const TIPO_SOLICITACAO_LABELS: Record<TipoSolicitacao, string> = {
  transito: "Transito",
  definitiva: "Definitiva",
}

// ── Attachment categories ──────────────────────────────
export const CATEGORIA_ANEXO = [
  "doc_pessoal",
  "laudo",
  "checklist",
  "outros",
] as const
export type CategoriaAnexo = (typeof CATEGORIA_ANEXO)[number]

export const CATEGORIA_ANEXO_LABELS: Record<CategoriaAnexo, string> = {
  doc_pessoal: "Doc. Pessoal",
  laudo: "Laudo",
  checklist: "Checklist",
  outros: "Outros",
}

// ── Anexo ──────────────────────────────────────────────
export interface Anexo {
  id: string
  nome: string
  tipo: string
  tamanho: number
  categoria: CategoriaAnexo
  descricao: string
  url: string
  criadoEm: string
  criadoPor: string
  criadoPorNome: string
}

// ── Interacao ───────────────────────────────────────────
export interface Interacao {
  id: string
  demandaId: string
  texto: string
  pendencia?: PendenciaTipo
  anexos: Anexo[]
  criadoEm: string
  criadoPor: string
  criadoPorNome: string
  criadoPorCpf: string
  assinaturaUrl?: string // populated from user profile if MEDICO_SES
}

// ── Demanda (protocolo) ────────────────────────────────
export interface Demanda {
  id: string
  protocolo: string // e.g. "TFD-2026-00001"
  pacienteId: string
  modulo: Module
  // Solicitante
  localSolicitante: string
  telefoneSolicitante: string[]
  emailSolicitante: string
  // Clinico
  codigoSigtap: string
  descricaoSigtap: string
  cid10: string
  especialidade: string
  subespecialidade: string
  peso: string
  altura: string
  tipoSanguineo: string
  observacoesUnidade: string
  tipoSolicitacao: TipoSolicitacao
  localSolicitado: string
  acaoJudicial: boolean
  // Status
  status: DemandaStatus
  // Relacoes
  anexos: Anexo[]
  interacoes: Interacao[]
  criadoEm: string
  atualizadoEm: string
  criadoPor: string
  criadoPorNome: string
}

export const demandaSchema = z.object({
  modulo: z.enum(MODULES, { required_error: "Selecione o modulo" }),
  localSolicitante: z.string().min(2, "Informe o local solicitante"),
  telefoneSolicitante: z.array(z.string().min(10, "Telefone invalido")).min(1, "Informe ao menos um telefone"),
  emailSolicitante: z.string().email("E-mail invalido").or(z.literal("")),
  codigoSigtap: z.string().min(1, "Codigo SIGTAP obrigatorio"),
  descricaoSigtap: z.string().min(1, "Descricao do procedimento obrigatoria"),
  cid10: z.string().min(1, "CID-10 obrigatorio"),
  especialidade: z.string().min(1, "Especialidade obrigatoria"),
  subespecialidade: z.string().optional().default(""),
  peso: z.string().optional().default(""),
  altura: z.string().optional().default(""),
  tipoSanguineo: z.string().optional().default(""),
  observacoesUnidade: z.string().max(2000, "Muito longo").optional().default(""),
  tipoSolicitacao: z.enum(TIPO_SOLICITACAO, { required_error: "Selecione o tipo" }),
  localSolicitado: z.string().optional().default(""),
  acaoJudicial: z.boolean().optional().default(false),
})
export type DemandaFormData = z.infer<typeof demandaSchema>

// ── Interacao schema ───────────────────────────────────
export const interacaoSchema = z.object({
  texto: z.string().min(5, "A interacao deve ter pelo menos 5 caracteres").max(3000, "Texto muito longo"),
  pendencia: z.enum(PENDENCIA_TIPOS).optional(),
})
export type InteracaoFormData = z.infer<typeof interacaoSchema>

// ── Password change ────────────────────────────────────
export const passwordChangeSchema = z
  .object({
    senhaAtual: z.string().min(1, "Senha atual obrigatoria"),
    novaSenha: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
    confirmarSenha: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: "As senhas nao conferem",
    path: ["confirmarSenha"],
  })
export type PasswordChangeData = z.infer<typeof passwordChangeSchema>

// ── Password reset request ─────────────────────────────
export const resetRequestSchema = z.object({
  email: z.string().email("E-mail invalido"),
})

export const resetPasswordSchema = z
  .object({
    novaSenha: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
    confirmarSenha: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: "As senhas nao conferem",
    path: ["confirmarSenha"],
  })
