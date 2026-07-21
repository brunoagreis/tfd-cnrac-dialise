"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Paperclip,
  Printer,
  ShieldAlert,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { getUserPerfilCodigo } from "@/lib/access-control"

const PAGE_SIZE = 2

type ApiPaciente = {
  id: string
  cpf: string
  cartaoSus: string
  nome: string
  dataNascimento: string
  telefones: string[]
  email: string
  municipio: string
  endereco: string
}

type ApiDemanda = {
  id: string
  protocolo: string
  pacienteId: string
  modulo: string
  localSolicitante: string
  telefoneSolicitante: string[]
  emailSolicitante: string
  codigoSigtap: string
  descricaoSigtap: string
  cid10: string
  especialidade: string
  subespecialidade: string
  peso: string
  altura: string
  tipoSanguineo: string
  observacoesUnidade: string
  tipoSolicitacao: string
  localSolicitado: string
  acaoJudicial: boolean
  status: string
  criadoEm: string
  atualizadoEm: string
  criadoPor: string
  criadoPorNome: string
}

type ApiAnexo = {
  id: string
  demandaId: string
  interacaoId: string
  nome: string
  tipo: string
  tamanho: number
  categoria: string
  descricao: string
  criadoPor: string
  criadoPorNome: string
  criadoEm: string
  arquivoNomeOriginal: string
  arquivoPath: string
  mimeType: string
  arquivoUrl: string
}

type ApiInteracao = {
  id: string
  demandaId: string
  texto: string
  pendencia?: string
  anexos: ApiAnexo[]
  criadoEm: string
  criadoPor: string
  criadoPorNome: string
  criadoPorCpf: string
  assinaturaUrl: string
}

type ApiResponse = {
  ok: boolean
  item?: {
    demanda: ApiDemanda
    paciente: ApiPaciente
  }
  error?: string
}

type ApiInteracoesResponse = {
  ok: boolean
  items?: ApiInteracao[]
  error?: string
}

type ApiAnexosResponse = {
  ok: boolean
  items?: ApiAnexo[]
  error?: string
}

type MovementColumnItem =
  | {
      type: "interacao"
      id: string
      interacao: ApiInteracao
    }
  | {
      type: "anexos-gerais"
      id: string
      anexos: ApiAnexo[]
    }

const MODULE_LABELS: Record<string, string> = {
  tfd: "TFD",
  cnrac: "CNRAC",
  hemodialise: "Hemodiálise",
  judicial: "Judicial",
  pre_judicial: "Pré Judicial",
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-800",
  },
  resolvido: {
    label: "Resolvido",
    className: "bg-emerald-100 text-emerald-800",
  },
  devolvida: {
    label: "Devolvida",
    className: "bg-red-100 text-red-800",
  },
}

const TIPO_SOLICITACAO_LABELS: Record<string, string> = {
  inclusao: "Inclusão",
  substituicao: "Substituição",
  alta: "Alta",
  outros: "Outros",
  nao_se_aplica: "Não se aplica",
}

const PENDENCIA_LABELS: Record<string, string> = {
  manifestacao: "Manifestação",
  finalizar_demanda: "Finalização da demanda",
  pendente_avaliacao_medica_ses: "Aguardando avaliação médica SES",
  avaliacao_medica_concluida: "Avaliação médica concluída",
}

function moduleLabel(value: string) {
  const key = String(value ?? "").toLowerCase()
  return MODULE_LABELS[key] ?? (key ? key.toUpperCase() : "Módulo")
}

function statusConfig(value: string) {
  const key = String(value || "pendente").toLowerCase()
  return STATUS_CONFIG[key] ?? STATUS_CONFIG.pendente
}

function valueOrNotInformed(value: unknown) {
  const text = String(value ?? "").trim()
  return text || "Não informado"
}

function formatDateOnly(value: string) {
  if (!value) return "Não informado"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Não informado"

  return parsed.toLocaleDateString("pt-BR")
}

function formatDateTime(value: string) {
  if (!value) return "Não informado"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Não informado"

  return parsed.toLocaleString("pt-BR")
}

function calculateAge(value: string) {
  if (!value) return "Não informado"

  const birthDate = new Date(value)
  if (Number.isNaN(birthDate.getTime())) return "Não informado"

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  if (age < 0) return "Não informado"

  return age === 1 ? "1 ano" : `${age} anos`
}

function tipoSolicitacaoLabel(value: string) {
  const key = String(value ?? "").trim().toLowerCase()

  if (!key || key === "transito") return "Não informado"

  return TIPO_SOLICITACAO_LABELS[key] ?? "Não informado"
}

function pendenciaLabel(value?: string) {
  const key = String(value ?? "").trim()
  return PENDENCIA_LABELS[key] ?? (key ? key.replaceAll("_", " ") : "Movimentação")
}

function formatFileSize(value: number) {
  const size = Number(value ?? 0)

  if (!Number.isFinite(size) || size <= 0) return "Tamanho não informado"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function protocolBackHref(modulo: string) {
  const key = String(modulo ?? "").toLowerCase()

  if (key === "judicial") return "/judicial"
  if (key === "pre_judicial") return "/pre-judicial"
  if (["tfd", "cnrac", "hemodialise"].includes(key)) return `/${key}`

  return "/pacientes"
}

function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE))
}

function formatMedicalCrm(value: unknown) {
  const raw = String(value ?? "").trim()

  const crmMsMatch = raw.match(/CRM\s*\/?\s*MS\s*[:\-]?\s*([\d.]{3,12})/i)
  if (crmMsMatch?.[1]) return `CRM/MS ${crmMsMatch[1]}`

  const numberMatch = raw.match(/\b([\d.]{3,12})\b/)
  if (numberMatch?.[1]) return `CRM/MS ${numberMatch[1]}`

  return "CRM/MS não informado"
}

function buildMedicalSignatureText(args: {
  nome?: string
  categoria?: string
  crm?: string
  dataHora?: string
  protocolo?: string
}) {
  const nome = String(args.nome ?? "").trim() || "Médico não informado"
  const categoria = String(args.categoria ?? "").trim() || "Médico SES"
  const crm = formatMedicalCrm(args.crm)
  const dataHora = args.dataHora
    ? new Date(args.dataHora).toLocaleString("pt-BR")
    : new Date().toLocaleString("pt-BR")
  const protocolo = String(args.protocolo ?? "").trim()

  return [
    "ASSINATURA DIGITAL DO MÉDICO",
    `Assinado digitalmente por: ${nome}`,
    `Categoria: ${categoria}`,
    crm,
    `Data/hora do registro: ${dataHora}`,
    protocolo ? `Verificação: registro eletrônico vinculado ao protocolo ${protocolo}.` : "Verificação: registro eletrônico vinculado ao SIGAJUS.",
  ].join("\n")
}

function latestMedicalAssessmentPendency(items: ApiInteracao[]) {
  const medicalItems = items
    .filter((item) =>
      item.pendencia === "pendente_avaliacao_medica_ses" ||
      item.pendencia === "avaliacao_medica_concluida"
    )
    .sort((a, b) => new Date(b.criadoEm || 0).getTime() - new Date(a.criadoEm || 0).getTime())

  return medicalItems[0]?.pendencia ?? null
}

function pageItems<T>(items: T[], page: number) {
  const start = (page - 1) * PAGE_SIZE
  return items.slice(start, start + PAGE_SIZE)
}

export default function ProtocoloPage({
  params,
}: {
  params: Promise<{ protocolo: string }>
}) {
  const { user } = useAuth()
  const { protocolo } = use(params)
  const decodedProtocol = useMemo(() => decodeURIComponent(protocolo), [protocolo])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [demanda, setDemanda] = useState<ApiDemanda | null>(null)
  const [paciente, setPaciente] = useState<ApiPaciente | null>(null)
  const [interacoes, setInteracoes] = useState<ApiInteracao[]>([])
  const [anexos, setAnexos] = useState<ApiAnexo[]>([])
  const [timelineError, setTimelineError] = useState("")
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [manifestacaoPage, setManifestacaoPage] = useState(1)
  const [movimentacaoPage, setMovimentacaoPage] = useState(1)
  const [manifestSubject, setManifestSubject] = useState("")
  const [manifestText, setManifestText] = useState("")
  const [selectedManifestFiles, setSelectedManifestFiles] = useState<FileList | null>(null)
  const [manifestFileInputKey, setManifestFileInputKey] = useState(0)
  const [savingManifest, setSavingManifest] = useState(false)

  useEffect(() => {
    async function loadProtocolo() {
      try {
        setLoading(true)
        setError("")
        setTimelineError("")
        setDemanda(null)
        setPaciente(null)
        setInteracoes([])
        setAnexos([])

        const response = await fetch(`/api/protocolo/${encodeURIComponent(decodedProtocol)}`, {
          method: "GET",
          cache: "no-store",
        })

        const json = (await response.json().catch(() => ({}))) as ApiResponse

        if (!response.ok || !json?.ok || !json?.item) {
          setError(json?.error || "Protocolo não encontrado.")
          return
        }

        setDemanda(json.item.demanda)
        setPaciente(json.item.paciente)

        const [interacoesResponse, anexosResponse] = await Promise.all([
          fetch(`/api/protocolo/${encodeURIComponent(decodedProtocol)}/interacoes`, {
            method: "GET",
            cache: "no-store",
          }),
          fetch(`/api/protocolo/${encodeURIComponent(decodedProtocol)}/anexos`, {
            method: "GET",
            cache: "no-store",
          }),
        ])

        const interacoesJson = (await interacoesResponse.json().catch(() => ({}))) as ApiInteracoesResponse
        const anexosJson = (await anexosResponse.json().catch(() => ({}))) as ApiAnexosResponse

        if (interacoesResponse.ok && interacoesJson?.ok) {
          setInteracoes(interacoesJson.items ?? [])
        } else {
          setTimelineError(interacoesJson?.error || "Não foi possível carregar manifestações e movimentações.")
        }

        if (anexosResponse.ok && anexosJson?.ok) {
          setAnexos(anexosJson.items ?? [])
        }
      } catch (err) {
        console.error("LOAD_PROTOCOLO_ERROR", err)
        setError("Erro ao carregar protocolo.")
      } finally {
        setLoading(false)
      }
    }

    void loadProtocolo()
  }, [decodedProtocol])

  const manifestacoes = useMemo(() => [] as ApiInteracao[], [])

  const movimentacoes = useMemo(() => interacoes, [interacoes])

  const anexosSemInteracao = useMemo(
    () => anexos.filter((anexo) => !String(anexo.interacaoId ?? "").trim()),
    [anexos],
  )

  const movementColumnItems = useMemo<MovementColumnItem[]>(() => {
    const items: MovementColumnItem[] = movimentacoes.map((interacao) => ({
      type: "interacao",
      id: interacao.id,
      interacao,
    }))

    if (anexosSemInteracao.length) {
      items.push({
        type: "anexos-gerais",
        id: "anexos-sem-movimentacao",
        anexos: anexosSemInteracao,
      })
    }

    return items
  }, [movimentacoes, anexosSemInteracao])

  const manifestacaoTotalPages = pageCount(manifestacoes.length)
  const movimentacaoTotalPages = pageCount(movementColumnItems.length)

  const medicalAssessmentPendency = useMemo(
    () => latestMedicalAssessmentPendency(interacoes),
    [interacoes],
  )

  const currentPerfilCodigo = getUserPerfilCodigo(user)
  const currentRole = String((user as any)?.role ?? "").trim().toUpperCase()
  const isMedicalUser =
    currentPerfilCodigo === "MEDICO" ||
    currentPerfilCodigo === "MEDICO_SES" ||
    currentRole === "MEDICO" ||
    currentRole === "MEDICO_SES"

  const currentManifestacoes = pageItems(manifestacoes, manifestacaoPage)
  const currentMovimentacoes = pageItems(movementColumnItems, movimentacaoPage)

  useEffect(() => {
    setManifestacaoPage(1)
  }, [manifestacoes.length])

  useEffect(() => {
    setMovimentacaoPage(1)
  }, [movementColumnItems.length])

  async function handleRegisterManifestacao() {
    if (!demanda) return

    const subject = manifestSubject.trim()
    const text = manifestText.trim()

    if (!subject) {
      setTimelineError("Selecione o assunto da manifestação.")
      return
    }

    if (!text) {
      setTimelineError("Escreva o texto da manifestação.")
      return
    }

    try {
      setSavingManifest(true)
      setTimelineError("")

      const composedText = `Assunto: ${subject}\n\n${text}`


      const isMedicalAssessmentSubject = subject.toLowerCase() === "avaliação médica ses"


      const shouldConcludeMedicalAssessment =


        isMedicalUser && medicalAssessmentPendency === "pendente_avaliacao_medica_ses"


      const pendencia = shouldConcludeMedicalAssessment


        ? "avaliacao_medica_concluida"


        : isMedicalAssessmentSubject


          ? "pendente_avaliacao_medica_ses"


          : "manifestacao"

      const medicalSignatureText = isMedicalUser
        ? buildMedicalSignatureText({
            nome: user?.nome || demanda.criadoPorNome || "",
            categoria: "Médico SES",
            crm:
              (user as any)?.crm ||
              (user as any)?.registroProfissional ||
              (user as any)?.registro_profissional ||
              (user as any)?.cargo ||
              "",
            dataHora: new Date().toISOString(),
            protocolo: decodedProtocol,
          })
        : ""
      const textoComAssinatura = medicalSignatureText
        ? `${composedText}\n\n${medicalSignatureText}`
        : composedText

      const response = await fetch(`/api/protocolo/${encodeURIComponent(decodedProtocol)}/interacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          texto: textoComAssinatura,
          pendencia,

          createdBy: user?.id || demanda.criadoPor || undefined,

          createdByName: user?.nome || demanda.criadoPorNome || undefined,

          createdByCpf: (user as any)?.cpf || undefined,

          assinaturaUrl: isMedicalUser ? (user as any)?.assinaturaMedicoUrl || undefined : undefined,
        }),
      })

      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        item?: ApiInteracao
        error?: string
      }

      if (!response.ok || !json?.ok || !json.item) {
        throw new Error(json?.error || "Erro ao registrar manifestação.")
      }

      const uploadedAnexos: ApiAnexo[] = []

      for (const file of Array.from(selectedManifestFiles ?? [])) {
        const form = new FormData()
        form.append("file", file)
        form.append("categoria", "outros")
        form.append("descricao", subject)
        form.append("interacaoId", json.item.id)

        if (user?.id || demanda.criadoPor) form.append("criadoPor", user?.id || demanda.criadoPor)
        if (user?.nome || demanda.criadoPorNome) form.append("criadoPorNome", user?.nome || demanda.criadoPorNome)

        const anexoResponse = await fetch(`/api/protocolo/${encodeURIComponent(decodedProtocol)}/anexos`, {
          method: "POST",
          body: form,
        })

        const anexoJson = (await anexoResponse.json().catch(() => ({}))) as {
          ok?: boolean
          item?: ApiAnexo
          error?: string
        }

        if (!anexoResponse.ok || !anexoJson?.ok || !anexoJson.item) {
          throw new Error(anexoJson?.error || `Manifestação registrada, mas houve erro ao anexar ${file.name}.`)
        }

        uploadedAnexos.push(anexoJson.item)
      }

      setInteracoes((current) => [
        {
          ...json.item!,
          anexos: uploadedAnexos,
        },
        ...current,
      ])

      setManifestSubject("")
      setManifestText("")
      setSelectedManifestFiles(null)
      setManifestFileInputKey((current) => current + 1)
    } catch (err) {
      console.error("REGISTER_MANIFESTACAO_ERROR", err)
      setTimelineError(err instanceof Error ? err.message : "Erro ao registrar manifestação.")
    } finally {
      setSavingManifest(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Carregando protocolo...</h2>
      </div>
    )
  }

  if (!demanda || !paciente) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Protocolo não encontrado</h2>
        <p className="text-sm text-muted-foreground">{error || "O protocolo informado não existe no sistema."}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Voltar ao Dashboard</Link>
        </Button>
      </div>
    )
  }

  const status = statusConfig(demanda.status)
  const sigtapText =
    demanda.codigoSigtap || demanda.descricaoSigtap
      ? `${demanda.codigoSigtap || "Sem código"} - ${demanda.descricaoSigtap || "Sem descrição"}`
      : "Não informado"

  async function handlePrintWithQrCode() {
    const signedItems = movementColumnItems
      .filter((entry) => entry.type === "interacao")
      .map((entry) => entry.type === "interacao" ? entry.interacao : null)
      .filter((item): item is ApiInteracao => Boolean(item))
      .filter((item) =>
        String(item.texto ?? "").includes("ASSINATURA DIGITAL DO MÉDICO") ||
        Boolean(item.assinaturaUrl)
      )

    await Promise.all(
      signedItems.map(
        (item) =>
          new Promise<void>((resolve) => {
            const image = new window.Image()
            image.onload = () => resolve()
            image.onerror = () => resolve()
            image.src = `/api/assinaturas/qrcode?id=${encodeURIComponent(item.id)}`
          }),
      ),
    )

    await new Promise((resolve) => window.setTimeout(resolve, 500))
    window.print()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" className="bg-transparent" asChild>
          <Link href={protocolBackHref(demanda.modulo)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="bg-transparent" onClick={() => void handlePrintWithQrCode()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>

          <Button variant="outline" className="bg-transparent" onClick={() => setAuditModalOpen(true)}>
            <ShieldAlert className="mr-2 h-4 w-4" />
            Auditoria
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{moduleLabel(demanda.modulo)}</Badge>
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-tight">
                {paciente.nome || "Paciente não informado"}
              </h1>

              <div className="mt-1 space-y-0.5 text-sm leading-tight text-muted-foreground">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>
                    <span className="font-semibold text-foreground">Protocolo:</span>{" "}
                    {demanda.protocolo}
                  </span>
                  <Badge variant="secondary">
                    Criado em {formatDateTime(demanda.criadoEm)}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    <span className="font-semibold text-foreground">Nascimento:</span>{" "}
                    {formatDateOnly(paciente.dataNascimento)}
                  </span>
                  <span>|</span>
                  <span>
                    <span className="font-semibold text-foreground">Idade:</span>{" "}
                    {calculateAge(paciente.dataNascimento)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    <span className="font-semibold text-foreground">CPF:</span>{" "}
                    {valueOrNotInformed(paciente.cpf)}
                  </span>
                  <span>|</span>
                  <span>
                    <span className="font-semibold text-foreground">CNS:</span>{" "}
                    {valueOrNotInformed(paciente.cartaoSus)}
                  </span>
                  <span>|</span>
                  <span>
                    <span className="font-semibold text-foreground">Município:</span>{" "}
                    {valueOrNotInformed(paciente.municipio)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    <span className="font-semibold text-foreground">E-mail:</span>{" "}
                    {valueOrNotInformed(paciente.email)}
                  </span>
                  <span>|</span>
                  <span>
                    <span className="font-semibold text-foreground">Criado por:</span>{" "}
                    {demanda.criadoPorNome || "Não informado"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-card-foreground">Dados Clínicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <InfoLine label="SIGTAP" value={sigtapText} />
            <InfoLine label="CID-10" value={valueOrNotInformed(demanda.cid10)} />
            <InfoLine
              label="Especialidade / Subespecialidade"
              value={`${valueOrNotInformed(demanda.especialidade)} | ${valueOrNotInformed(demanda.subespecialidade)}`}
            />
            <InfoLine label="Tipo da Solicitação" value={tipoSolicitacaoLabel(demanda.tipoSolicitacao)} />
          </div>

          {demanda.observacoesUnidade ? (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Observações</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-card-foreground">{demanda.observacoesUnidade}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {timelineError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {timelineError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 print:hidden">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base text-card-foreground">Manifestação</CardTitle>
            <Badge variant="outline">Nova</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Assunto
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manifestSubject}
                  onChange={(event) => setManifestSubject(event.target.value)}
                >
                  <option value="">Selecione o assunto</option>
                  <option value="Avaliação médica SES">Avaliação médica SES</option>
                  <option value="Solicitação de informação">Solicitação de informação</option>
                  <option value="Devolução">Devolução</option>
                  <option value="Complementação de dados">Complementação de dados</option>
                  <option value="Solicitação de TRS">Solicitação de TRS</option>
                  <option value="Vaga Aprovada">Vaga Aprovada</option>
                  <option value="Negativa de Vaga">Negativa de Vaga</option>
                  <option value="Encerrar processo">Encerrar processo</option>
                  <option value="Arquivar processo">Arquivar processo</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => {
                    setManifestSubject("Outros")
                    setManifestText("")
                  }}
                >
                  Em branco
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Texto da manifestação
              </label>
              <textarea
                className="min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                value={manifestText}
                onChange={(event) => setManifestText(event.target.value)}
                placeholder="Digite aqui a manifestação, solicitação, devolução ou orientação."
              />
            </div>

            <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Anexos
                </label>
                <input
                  key={manifestFileInputKey}
                  type="file"
                  multiple
                  className="block w-full text-sm text-muted-foreground"
                  onChange={(event) => setSelectedManifestFiles(event.target.files)}
                />
              </div>

              {selectedManifestFiles && selectedManifestFiles.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  {Array.from(selectedManifestFiles).map((file) => (
                    <p key={file.name}>{file.name}</p>
                  ))}
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={savingManifest}
              onClick={handleRegisterManifestacao}
            >
              {savingManifest ? "Registrando..." : "Registrar manifestação"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base text-card-foreground">Movimentação</CardTitle>
            <Badge variant="outline">{movementColumnItems.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentMovimentacoes.length ? (
              currentMovimentacoes.map((item) =>
                item.type === "interacao" ? (
                  <MovimentacaoCard key={item.id} item={item.interacao} />
                ) : (
                  <AnexosGeraisCard key={item.id} anexos={item.anexos} />
                ),
              )
            ) : (
              <EmptyTimeline text="Nenhuma movimentação registrada." />
            )}

            <PaginationControls
              page={movimentacaoPage}
              totalPages={movimentacaoTotalPages}
              onPrevious={() => setMovimentacaoPage((current) => Math.max(1, current - 1))}
              onNext={() => setMovimentacaoPage((current) => Math.min(movimentacaoTotalPages, current + 1))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="hidden print:block">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-card-foreground">
              Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {movementColumnItems.length ? (
              movementColumnItems.map((item) =>
                item.type === "interacao" ? (
                  <MovimentacaoCard key={item.id} item={item.interacao} />
                ) : (
                  <PrintAnexosGeraisCard key={item.id} anexos={item.anexos} />
                ),
              )
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Nenhuma movimentação registrada.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auditoria e motivos da exibição</DialogTitle>
            <DialogDescription>
              Dados de auditoria da tela e justificativas de exibição no fluxo {moduleLabel(demanda.modulo)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Motivos de exibição e fila</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <ShieldAlert className="h-4 w-4" />
                    Fluxo atual
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {moduleLabel(demanda.modulo)}
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4" />
                    Protocolo
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {demanda.protocolo}
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="mb-2 text-sm font-semibold">
                    Status
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {status.label}
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="mb-2 text-sm font-semibold">
                    Escopo
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Sem PGE.net, processo, prazo, responsável ou monitoramento judicial.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Auditoria de tela</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">Registro da demanda</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(demanda.criadoEm)} • {demanda.criadoPorNome || "Usuário não informado"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    ID: {demanda.id}
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">Movimentações carregadas</p>
                  <p className="text-xs text-muted-foreground">
                    {interacoes.length} registro(s) em interações
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Os anexos vinculados por interacaoId são exibidos dentro do card da respectiva movimentação.
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">Auditoria detalhada</p>
                  <p className="text-sm text-muted-foreground">
                    As ações do sistema são gravadas em sistema_auditoria. A listagem detalhada pode ser ligada em uma rota própria para este protocolo, mantendo este mesmo modal.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PrintMovimentacaoCard({ item }: { item: ApiInteracao }) {
  return (
    <div className="break-inside-avoid rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <Badge variant="secondary">{pendenciaLabel(item.pendencia)}</Badge>
        <span className="text-xs text-muted-foreground">{formatDateTime(item.criadoEm)}</span>
      </div>

      <p className="mt-2 text-sm font-medium text-card-foreground">
        {item.criadoPorNome || "Usuário não informado"}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-sm text-card-foreground">
        {item.texto || "Sem descrição."}
      </p>

      {item.anexos?.length ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Anexos
          </p>
          <div className="space-y-1">
            {item.anexos.map((anexo) => (
              <p key={anexo.id} className="text-xs text-card-foreground">
                {(anexo.arquivoNomeOriginal || anexo.nome || "Arquivo")} • {formatFileSize(anexo.tamanho)}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PrintAnexosGeraisCard({ anexos }: { anexos: ApiAnexo[] }) {
  return (
    <div className="break-inside-avoid rounded-xl border border-border p-4">
      <div className="border-b border-border pb-2">
        <Badge variant="secondary">Anexos sem movimentação vinculada</Badge>
      </div>

      <div className="mt-3 space-y-1">
        {anexos.map((anexo) => (
          <p key={anexo.id} className="text-xs text-card-foreground">
            {(anexo.arquivoNomeOriginal || anexo.nome || "Arquivo")} • {formatFileSize(anexo.tamanho)}
          </p>
        ))}
      </div>
    </div>
  )
}


function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-card-foreground">{value}</span>
    </div>
  )
}

function EmptyTimeline({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function ManifestacaoCard({ item }: { item: ApiInteracao }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-col gap-1 border-b border-border pb-3">
        <p className="text-sm font-semibold text-card-foreground">{item.criadoPorNome || "Usuário não informado"}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(item.criadoEm)}</p>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-card-foreground">{item.texto || "Sem descrição."}</p>

      <PrintMedicalSignatureQr item={item} />
    </div>
  )
}

function MovimentacaoCard({ item }: { item: ApiInteracao }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-col gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{pendenciaLabel(item.pendencia)}</Badge>
          <span className="text-xs text-muted-foreground">{formatDateTime(item.criadoEm)}</span>
        </div>

        <p className="text-sm text-muted-foreground">
          {item.criadoPorNome || "Usuário não informado"}
        </p>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-card-foreground">{item.texto || "Sem descrição."}</p>

      <MedicalSignatureImage item={item} />

      {item.anexos?.length ? <AttachmentList anexos={item.anexos} /> : null}
    </div>
  )
}

function hasDigitalSignatureOnItem(item: ApiInteracao) {
  return (
    String(item.texto ?? "").includes("ASSINATURA DIGITAL DO MÉDICO") ||
    Boolean(item.assinaturaUrl)
  )
}

function signatureQrSrc(item: ApiInteracao) {
  return `/api/assinaturas/qrcode?id=${encodeURIComponent(item.id)}`
}

function signatureValidationLink(item: ApiInteracao) {
  return `/api/assinaturas/validar-link?id=${encodeURIComponent(item.id)}`
}

function PrintMedicalSignatureQr({ item }: { item: ApiInteracao }) {
  if (!hasDigitalSignatureOnItem(item)) return null

  return (
    <div className="mt-3 break-inside-avoid rounded-lg border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-card-foreground">
        QR Code de validação da assinatura digital
      </p>

      <div className="mt-2 flex items-start gap-3">
        <img
          src={signatureQrSrc(item)}
          alt="QR Code para validação da assinatura digital"
          className="h-28 w-28 rounded-md border border-border bg-white p-1"
        />

        <div className="text-xs text-muted-foreground">
          <p>
            Escaneie o QR Code para validar a autenticidade desta movimentação.
          </p>
          <p className="mt-2 break-all font-mono text-[10px]">
            {signatureValidationLink(item)}
          </p>
        </div>
      </div>
    </div>
  )
}

function MedicalSignatureImage({ item }: { item: ApiInteracao }) {
  const hasDigitalSignature =
    String(item.texto ?? "").includes("ASSINATURA DIGITAL DO MÉDICO") ||
    Boolean(item.assinaturaUrl)

  if (!hasDigitalSignature) return null

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
        Assinatura digital do profissional
      </p>

      {item.assinaturaUrl ? (
        <img
          src={item.assinaturaUrl}
          alt="Assinatura digital do médico"
          className="mt-2 max-h-20 max-w-xs object-contain"
        />
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <img
          src={`/api/assinaturas/qrcode?id=${encodeURIComponent(item.id)}`}
          alt="QR Code para validação da assinatura digital"
          className="h-28 w-28 rounded-md border border-emerald-200 bg-white p-1"
        />

        <div className="max-w-sm text-xs text-emerald-900">
          <p className="font-semibold">Validação por QR Code</p>
          <p className="mt-1">
            Escaneie o código para confirmar a autenticidade desta assinatura digital.
          </p>
          <a
            href={`/api/assinaturas/validar-link?id=${encodeURIComponent(item.id)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block font-medium underline"
          >
            Abrir validação
          </a>
        </div>
      </div>
    </div>
  )
}

function AnexosGeraisCard({ anexos }: { anexos: ApiAnexo[] }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-col gap-1 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Anexos sem movimentação vinculada</Badge>
          <span className="text-xs text-muted-foreground">{anexos.length} arquivo(s)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Arquivos antigos ou enviados antes do vínculo com movimentação.
        </p>
      </div>

      <AttachmentList anexos={anexos} />
    </div>
  )
}

function AttachmentList({ anexos }: { anexos: ApiAnexo[] }) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" />
        Anexos
      </p>

      <div className="space-y-2">
        {anexos.map((anexo) => {
          const url = anexo.arquivoUrl || anexo.arquivoPath
          const nome = anexo.arquivoNomeOriginal || anexo.nome || "Arquivo"

          return (
            <div key={anexo.id} className="rounded-md border border-border bg-background p-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(anexo.tamanho)} • {anexo.criadoPorNome || "Usuário não informado"}
                  </p>
                </div>

                {url ? (
                  <div className="flex items-center gap-2 text-xs">
                    <a className="font-medium text-primary hover:underline" href={url} target="_blank" rel="noreferrer">
                      Visualizar
                    </a>
                    <span className="text-muted-foreground">|</span>
                    <a className="font-medium text-primary hover:underline" href={url} download>
                      Baixar
                    </a>
                  </div>
                ) : null}
              </div>

              {anexo.descricao ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{anexo.descricao}</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PaginationControls({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number
  totalPages: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border pt-3 print:hidden">
      <Button variant="outline" size="sm" onClick={onPrevious} disabled={page <= 1}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        Anterior
      </Button>

      <span className="text-xs text-muted-foreground">
        Página {page} de {totalPages}
      </span>

      <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
        Próxima
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  )
}
