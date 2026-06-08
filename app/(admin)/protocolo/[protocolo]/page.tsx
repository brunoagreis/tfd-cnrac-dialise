"use client"

import React, { useEffect, useMemo, useState, use } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  FileText,
  ClipboardList,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Printer,
  MessageSquare,
  Send,
  Paperclip,
  File,
  Download,
  Eye,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  DEMANDA_STATUS_LABELS,
  MODULE_LABELS,
  TIPO_SOLICITACAO_LABELS,
  PENDENCIA_TIPOS,
  PENDENCIA_LABELS,
  CATEGORIA_ANEXO,
  CATEGORIA_ANEXO_LABELS,
  type DemandaStatus,
  type Module,
  type PendenciaTipo,
  type CategoriaAnexo,
} from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  criadoEm: string
  atualizadoEm: string
}

type ApiDemanda = {
  id: string
  protocolo: string
  pacienteId: string
  modulo: Module
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
  tipoSolicitacao:
  | "transito"
  | "definitiva"
  | "nao_se_aplica"
  | "inclusao"
  | "substituicao"
  | "alta"
  | "outros"
  localSolicitado: string
  acaoJudicial: boolean
  status: DemandaStatus
  anexos: unknown[]
  interacoes: unknown[]
  criadoEm: string
  atualizadoEm: string
  criadoPor: string
  criadoPorNome: string
}

type ApiInteracao = {
  id: string
  demandaId: string
  texto: string
  pendencia?: PendenciaTipo
  anexos: unknown[]
  criadoEm: string
  criadoPor: string
  criadoPorNome: string
  criadoPorCpf: string
  assinaturaUrl?: string
}

type ApiAnexo = {
  id: string
  demandaId: string
  nome: string
  tipo: string
  tamanho: number
  categoria: CategoriaAnexo
  descricao: string
  criadoPor: string
  criadoPorNome: string
  criadoEm: string
  arquivoNomeOriginal?: string
  arquivoPath?: string
  mimeType?: string
  arquivoUrl?: string
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

const MODULE_ICONS: Record<Module, typeof FileText> = {
  tfd: FileText,
  cnrac: ClipboardList,
  hemodialise: Stethoscope,
}

const STATUS_CONFIG: Record<
  DemandaStatus,
  { icon: typeof AlertTriangle; color: string }
> = {
  pendente: { icon: AlertTriangle, color: "bg-amber-100 text-amber-800" },
  resolvido: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800" },
  devolvida: { icon: RotateCcw, color: "bg-red-100 text-red-800" },
}

function formatFileSize(size: number) {
  if (!size || size <= 0) return "0 KB"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function ProtocoloPage({
  params,
}: {
  params: Promise<{ protocolo: string }>
}) {
  const { protocolo } = use(params)
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [demanda, setDemanda] = useState<ApiDemanda | null>(null)
  const [paciente, setPaciente] = useState<ApiPaciente | null>(null)

  const [loadingInteracoes, setLoadingInteracoes] = useState(false)
  const [interacoes, setInteracoes] = useState<ApiInteracao[]>([])

  const [loadingAnexos, setLoadingAnexos] = useState(false)
  const [anexos, setAnexos] = useState<ApiAnexo[]>([])

  const [showInteracao, setShowInteracao] = useState(false)
  const [savingInteracao, setSavingInteracao] = useState(false)
  const [interacaoTexto, setInteracaoTexto] = useState("")
  const [interacaoPendencia, setInteracaoPendencia] = useState<string>("")

  const [showAnexo, setShowAnexo] = useState(false)
  const [savingAnexo, setSavingAnexo] = useState(false)
  const [anexoFile, setAnexoFile] = useState<File | null>(null)
  const [anexoCategoria, setAnexoCategoria] = useState<CategoriaAnexo>("outros")
  const [anexoDescricao, setAnexoDescricao] = useState("")

  const decodedProtocol = useMemo(
    () => decodeURIComponent(protocolo),
    [protocolo],
  )

  useEffect(() => {
    async function loadProtocolo() {
      try {
        setLoading(true)
        setError("")

        const response = await fetch(
          `/api/protocolo/${encodeURIComponent(decodedProtocol)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        )

        const json = (await response.json().catch(() => ({}))) as ApiResponse

        if (!response.ok || !json?.ok || !json?.item) {
          setError(json?.error || "Protocolo não encontrado.")
          setDemanda(null)
          setPaciente(null)
          return
        }

        setDemanda(json.item.demanda)
        setPaciente(json.item.paciente)
      } catch (err) {
        console.error("LOAD_PROTOCOLO_ERROR", err)
        setError("Erro ao carregar protocolo.")
        setDemanda(null)
        setPaciente(null)
      } finally {
        setLoading(false)
      }
    }

    void loadProtocolo()
  }, [decodedProtocol])

  useEffect(() => {
    if (!demanda?.protocolo) {
      setInteracoes([])
      setAnexos([])
      return
    }

    void loadInteracoes(demanda.protocolo)
    void loadAnexos(demanda.protocolo)
  }, [demanda?.protocolo])

  async function loadInteracoes(protocolValue: string) {
    try {
      setLoadingInteracoes(true)

      const response = await fetch(
        `/api/protocolo/${encodeURIComponent(protocolValue)}/interacoes`,
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = (await response.json().catch(() => ({}))) as ApiInteracoesResponse

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar interações.")
        setInteracoes([])
        return
      }

      setInteracoes(Array.isArray(json?.items) ? json.items : [])
    } catch (err) {
      console.error("LOAD_PROTOCOLO_INTERACOES_ERROR", err)
      toast.error("Erro ao carregar interações.")
      setInteracoes([])
    } finally {
      setLoadingInteracoes(false)
    }
  }

  async function loadAnexos(protocolValue: string) {
    try {
      setLoadingAnexos(true)

      const response = await fetch(
        `/api/protocolo/${encodeURIComponent(protocolValue)}/anexos`,
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = (await response.json().catch(() => ({}))) as ApiAnexosResponse

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar documentos.")
        setAnexos([])
        return
      }

      setAnexos(Array.isArray(json?.items) ? json.items : [])
    } catch (err) {
      console.error("LOAD_PROTOCOLO_ANEXOS_ERROR", err)
      toast.error("Erro ao carregar documentos.")
      setAnexos([])
    } finally {
      setLoadingAnexos(false)
    }
  }

  async function handleSaveInteracao() {
    if (!user || !demanda) return

    if (!interacaoTexto.trim()) {
      toast.error("Digite o texto da interação.")
      return
    }

    try {
      setSavingInteracao(true)

      const response = await fetch(
        `/api/protocolo/${encodeURIComponent(demanda.protocolo)}/interacoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            texto: interacaoTexto,
            pendencia: interacaoPendencia || undefined,
            createdBy: user.id,
            createdByName: user.nome,
            createdByCpf: user.cpf,
            assinaturaUrl:
              user.role === "MEDICO_SES" ? user.assinaturaMedicoUrl ?? "" : "",
          }),
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao salvar interação.")
        return
      }

      toast.success("Interação salva com sucesso.")
      setInteracaoTexto("")
      setInteracaoPendencia("")
      setShowInteracao(false)
      await loadInteracoes(demanda.protocolo)
    } catch (err) {
      console.error("SAVE_PROTOCOLO_INTERACAO_ERROR", err)
      toast.error("Erro ao salvar interação.")
    } finally {
      setSavingInteracao(false)
    }
  }

  async function handleSaveAnexo() {
    if (!user || !demanda) return

    if (!anexoFile) {
      toast.error("Selecione um arquivo.")
      return
    }

    try {
      setSavingAnexo(true)

      const formData = new FormData()
      formData.append("file", anexoFile)
      formData.append("categoria", anexoCategoria)
      formData.append("descricao", anexoDescricao)
      formData.append("criadoPor", user.id)
      formData.append("criadoPorNome", user.nome)

      const response = await fetch(
        `/api/protocolo/${encodeURIComponent(demanda.protocolo)}/anexos`,
        {
          method: "POST",
          body: formData,
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao enviar documento.")
        return
      }

      toast.success("Documento enviado com sucesso.")
      setAnexoFile(null)
      setAnexoCategoria("outros")
      setAnexoDescricao("")
      setShowAnexo(false)
      await loadAnexos(demanda.protocolo)
    } catch (err) {
      console.error("SAVE_PROTOCOLO_ANEXO_ERROR", err)
      toast.error("Erro ao enviar documento.")
    } finally {
      setSavingAnexo(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">
          Carregando protocolo...
        </h2>
      </div>
    )
  }

  if (!demanda || !paciente) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">
          Protocolo não encontrado
        </h2>
        <p className="text-sm text-muted-foreground">
          {error || "O protocolo informado não existe no sistema."}
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Voltar ao Dashboard</Link>
        </Button>
      </div>
    )
  }

  const Icon = MODULE_ICONS[demanda.modulo]
  const statusCfg = STATUS_CONFIG[demanda.status]
  const StatusIcon = statusCfg.icon

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${demanda.modulo}`} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {demanda.protocolo}
              </h1>

              <Badge variant="outline" className={statusCfg.color}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {DEMANDA_STATUS_LABELS[demanda.status]}
              </Badge>

              <Badge variant="secondary">
                <Icon className="mr-1 h-3 w-3" />
                {MODULE_LABELS[demanda.modulo]}
              </Badge>

              {demanda.acaoJudicial && (
                <Badge variant="destructive" className="text-xs">
                  Ação Judicial
                </Badge>
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Criado em{" "}
              {demanda.criadoEm
                ? new Date(demanda.criadoEm).toLocaleDateString("pt-BR")
                : "-"}{" "}
              por {demanda.criadoPorNome || "-"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowInteracao(true)}>
            <MessageSquare className="mr-1 h-3.5 w-3.5" />
            Nova Interação
          </Button>

          <Button size="sm" variant="outline" onClick={() => setShowAnexo(true)}>
            <Paperclip className="mr-1 h-3.5 w-3.5" />
            Anexar Documento
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
          >
            <Printer className="mr-1 h-3.5 w-3.5" />
            Imprimir
          </Button>
        </div>
      </div>

      <Tabs defaultValue="detalhes" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="interacoes">
            Interações ({interacoes.length})
          </TabsTrigger>
          <TabsTrigger value="documentos">
            Documentos ({anexos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detalhes" className="mt-0 flex flex-col gap-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-card-foreground">
                Paciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <InfoRow label="Nome" value={paciente.nome || "-"} />
                <InfoRow label="CPF" value={paciente.cpf || "-"} />
                <InfoRow label="CNS" value={paciente.cartaoSus || "-"} />
                <InfoRow
                  label="Data Nasc."
                  value={
                    paciente.dataNascimento
                      ? new Date(paciente.dataNascimento).toLocaleDateString(
                          "pt-BR",
                        )
                      : "-"
                  }
                />
                <InfoRow
                  label="Telefone(s)"
                  value={
                    paciente.telefones?.length > 0
                      ? paciente.telefones.join(", ")
                      : "-"
                  }
                />
                <InfoRow label="E-mail" value={paciente.email || "-"} />
                <InfoRow label="Município" value={paciente.municipio || "-"} />
                <InfoRow label="Endereço" value={paciente.endereco || "-"} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-card-foreground">
                Dados do Solicitante
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <InfoRow
                  label="Local"
                  value={demanda.localSolicitante || "-"}
                />
                <InfoRow
                  label="Telefone(s)"
                  value={
                    demanda.telefoneSolicitante?.length > 0
                      ? demanda.telefoneSolicitante.join(", ")
                      : "-"
                  }
                />
                <InfoRow
                  label="E-mail"
                  value={demanda.emailSolicitante || "-"}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-card-foreground">
                Dados Clínicos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow
                  label="SIGTAP"
                  value={`${demanda.codigoSigtap || "-"} - ${
                    demanda.descricaoSigtap || "-"
                  }`}
                />
                <InfoRow label="CID-10" value={demanda.cid10 || "-"} />
                <InfoRow
                  label="Especialidade"
                  value={demanda.especialidade || "-"}
                />
                <InfoRow
                  label="Subespecialidade"
                  value={demanda.subespecialidade || "-"}
                />
                <InfoRow
                  label="Peso"
                  value={demanda.peso ? `${demanda.peso} kg` : "-"}
                />
                <InfoRow
                  label="Altura"
                  value={demanda.altura ? `${demanda.altura} m` : "-"}
                />
                <InfoRow
                  label="Tipo Sanguíneo"
                  value={demanda.tipoSanguineo || "-"}
                />
<InfoRow
  label="Tipo Solicitação"
  value={
    demanda.tipoSolicitacao === "definitiva"
      ? "Definitiva"
      : demanda.tipoSolicitacao === "nao_se_aplica"
        ? "Não se aplica"
        : demanda.tipoSolicitacao === "inclusao"
          ? "Inclusão"
          : demanda.tipoSolicitacao === "substituicao"
            ? "Substituição"
            : demanda.tipoSolicitacao === "alta"
              ? "Alta"
              : demanda.tipoSolicitacao === "outros"
                ? "Outros"
                : "Trânsito"
  }
/>
                <InfoRow
                  label="Local Solicitado"
                  value={demanda.localSolicitado || "-"}
                />
              </div>

              {demanda.observacoesUnidade && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Observações da Unidade
                  </p>
                  <p className="mt-1 text-sm text-card-foreground">
                    {demanda.observacoesUnidade}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interacoes" className="mt-0">
          {loadingInteracoes ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                Carregando interações...
              </CardContent>
            </Card>
          ) : interacoes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma interação registrada neste protocolo.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {interacoes.map((item) => (
                <Card key={item.id} className="border-border">
                  <CardContent className="pt-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-card-foreground">
                          {item.criadoPorNome || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          CPF: {item.criadoPorCpf || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.criadoEm
                            ? new Date(item.criadoEm).toLocaleString("pt-BR")
                            : "-"}
                        </span>
                        {item.pendencia && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-xs text-amber-800"
                          >
                            {PENDENCIA_LABELS[item.pendencia]}
                          </Badge>
                        )}
                      </div>

                      <p className="whitespace-pre-wrap text-sm text-card-foreground">
                        {item.texto}
                      </p>

                      {item.assinaturaUrl ? (
                        <div className="mt-2 rounded border border-border bg-muted/30 p-2">
                          <p className="text-xs text-muted-foreground">
                            Assinatura Médica SES
                          </p>
                          <img
                            src={item.assinaturaUrl}
                            alt="Assinatura médica"
                            className="mt-1 max-h-16 object-contain"
                          />
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="mt-0">
          {loadingAnexos ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                Carregando documentos...
              </CardContent>
            </Card>
          ) : anexos.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum documento registrado neste protocolo.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {anexos.map((item) => (
                <Card key={item.id} className="border-border">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <File className="mt-0.5 h-8 w-8 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-card-foreground">
                            {item.arquivoNomeOriginal || item.nome}
                          </span>
                          <Badge variant="outline">
                            {CATEGORIA_ANEXO_LABELS[item.categoria]}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Tipo: {item.mimeType || item.tipo || "-"} | Tamanho: {formatFileSize(item.tamanho)}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Registrado por {item.criadoPorNome || "-"} em{" "}
                          {item.criadoEm
                            ? new Date(item.criadoEm).toLocaleString("pt-BR")
                            : "-"}
                        </p>

                        {item.descricao ? (
                          <p className="mt-2 text-sm text-card-foreground">
                            {item.descricao}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.arquivoUrl ? (
                            <>
                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={item.arquivoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Eye className="mr-1 h-3.5 w-3.5" />
                                  Visualizar
                                </a>
                              </Button>

                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={item.arquivoUrl}
                                  download={item.arquivoNomeOriginal || item.nome}
                                >
                                  <Download className="mr-1 h-3.5 w-3.5" />
                                  Baixar
                                </a>
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Arquivo sem caminho disponível.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={showInteracao}
        onOpenChange={(open) => {
          if (!open) {
            setShowInteracao(false)
            setInteracaoTexto("")
            setInteracaoPendencia("")
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Interação</DialogTitle>
            <DialogDescription>
              Registre uma nova movimentação neste protocolo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Texto da Interação</Label>
              <Textarea
                rows={5}
                value={interacaoTexto}
                onChange={(e) => setInteracaoTexto(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Marcar Pendência</Label>
              <Select
                value={interacaoPendencia || "none"}
                onValueChange={(value) =>
                  setInteracaoPendencia(value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem pendência" />
                </SelectTrigger>
<SelectContent>
  <SelectItem value="none">Sem pendência</SelectItem>

  <SelectItem value="finalizar_demanda">
    Finalizar demanda
  </SelectItem>

  {PENDENCIA_TIPOS.map((item) => (
    <SelectItem key={item} value={item}>
      {PENDENCIA_LABELS[item]}
    </SelectItem>
  ))}
</SelectContent>
              </Select>
            </div>

            {user?.role === "MEDICO_SES" ? (
              <div className="rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Sua assinatura médica será incluída automaticamente nesta interação.
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowInteracao(false)
                setInteracaoTexto("")
                setInteracaoPendencia("")
              }}
              disabled={savingInteracao}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveInteracao}
              disabled={savingInteracao}
            >
              <Send className="mr-1 h-3.5 w-3.5" />
              {savingInteracao ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAnexo}
        onOpenChange={(open) => {
          if (!open) {
            setShowAnexo(false)
            setAnexoFile(null)
            setAnexoCategoria("outros")
            setAnexoDescricao("")
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Documento</DialogTitle>
            <DialogDescription>
              Selecione o arquivo e registre o documento neste protocolo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Arquivo</Label>
              <Input
                type="file"
                onChange={(e) => setAnexoFile(e.target.files?.[0] ?? null)}
              />
              {anexoFile ? (
                <p className="text-xs text-muted-foreground">
                  {anexoFile.name} • {formatFileSize(anexoFile.size)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <Select
                value={anexoCategoria}
                onValueChange={(value) => setAnexoCategoria(value as CategoriaAnexo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIA_ANEXO.map((item) => (
                    <SelectItem key={item} value={item}>
                      {CATEGORIA_ANEXO_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={4}
                value={anexoDescricao}
                onChange={(e) => setAnexoDescricao(e.target.value)}
                placeholder="Descreva o documento..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAnexo(false)
                setAnexoFile(null)
                setAnexoCategoria("outros")
                setAnexoDescricao("")
              }}
              disabled={savingAnexo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveAnexo}
              disabled={savingAnexo}
            >
              <Paperclip className="mr-1 h-3.5 w-3.5" />
              {savingAnexo ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-card-foreground">{value}</span>
    </div>
  )
}