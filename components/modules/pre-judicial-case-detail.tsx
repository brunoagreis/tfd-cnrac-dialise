"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Download, Eye, FileText, Mail, Plus, Printer, Send, Upload } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import { usePreJudicial } from "@/lib/pre-judicial-context"
import {
  PREJUDICIAL_MOVEMENT_LABELS,
  PREJUDICIAL_QUEUE_REASON_LABELS,
  PREJUDICIAL_STATUS_LABELS,
} from "@/lib/pre-judicial-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type UploadedFileMeta = {
  name: string
  storedName: string
  relativePath: string
  url: string
  size: number
  mimeType: string
}

function splitCommaNames(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function mergeCommaNames(currentValue: string, newNames: string[]) {
  const current = splitCommaNames(currentValue)
  const merged = [...current]

  for (const name of newNames) {
    if (!merged.includes(name)) merged.push(name)
  }

  return merged.join(", ")
}

const PRE_FINALIZATION_LABELS = {
  pendente: "Pendente",
  resolvido: "Resolvido",
  bloqueio: "Bloqueio",
  sequestro: "Sequestro",
  obito: "Óbito",
  devolvida: "Devolvida",
} as const

function AttachmentActions({
  attachment,
}: {
  attachment: { name: string; url?: string; relativePath?: string }
}) {
  if (!attachment.url) {
    return <span className="text-xs text-muted-foreground">Arquivo sem link</span>
  }

  const downloadUrl = attachment.relativePath
    ? `/api/files/${attachment.relativePath}?download=1`
    : `${attachment.url}${attachment.url.includes("?") ? "&" : "?"}download=1`

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
      >
        <Eye className="h-3.5 w-3.5" /> Visualizar
      </a>
      <a
        href={downloadUrl}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
      >
        <Download className="h-3.5 w-3.5" /> Baixar
      </a>
    </div>
  )
}

export function PreJudicialCaseDetail({ caseId }: { caseId: string }) {
  const { user } = useAuth()
  const pre = usePreJudicial()
  const judicial = useJudicial()
  const caseItem = pre.getCaseById(caseId)
  const municipality = judicial.municipalityContacts.find(
    (item) => item.municipalityName === caseItem?.municipalityName,
  )

  const lastTrackedTabRef = useRef<string>("")

  const [interactionDescription, setInteractionDescription] = useState("")
  const [interactionAttachments, setInteractionAttachments] = useState("")
  const [procedureQuery, setProcedureQuery] = useState("")
  const [cidQuery, setCidQuery] = useState("")
  const [sendDescription, setSendDescription] = useState("")
  const [responseDeadlineAt, setResponseDeadlineAt] = useState("")
  const [sendAttachments, setSendAttachments] = useState("")
  const [closeReason, setCloseReason] = useState("")
  const [activeTab, setActiveTab] = useState("visao-geral")
  const [finalizeStatus, setFinalizeStatus] =
    useState<keyof typeof PRE_FINALIZATION_LABELS>("resolvido")
  const [finalizePendingLocation, setFinalizePendingLocation] = useState<
    "ses" | "core" | "municipio"
  >("ses")

  const [selectedInteractionFiles, setSelectedInteractionFiles] =
    useState<FileList | null>(null)
  const [uploadedInteractionFiles, setUploadedInteractionFiles] = useState<
    UploadedFileMeta[]
  >([])
  const [uploadingInteraction, setUploadingInteraction] = useState(false)

  const [selectedSchedulingFiles, setSelectedSchedulingFiles] =
    useState<FileList | null>(null)
  const [uploadedSchedulingFiles, setUploadedSchedulingFiles] = useState<
    UploadedFileMeta[]
  >([])
  const [uploadingScheduling, setUploadingScheduling] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const storedTab = window.sessionStorage.getItem(`prejudicial-tab:${caseId}`)
    if (storedTab) {
      setActiveTab(storedTab)
    }

    lastTrackedTabRef.current = ""
  }, [caseId])

  if (!caseItem) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Processo pré judicial não encontrado.
      </div>
    )
  }

  function handleTabChange(nextTab: string) {
    setActiveTab(nextTab)

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`prejudicial-tab:${caseId}`, nextTab)
    }

    if (!user || !caseItem?.id) return

    const trackKey = `${caseItem.id}:${nextTab}:${user.id}`
    if (lastTrackedTabRef.current === trackKey) return

    lastTrackedTabRef.current = trackKey
    pre.trackUiAction("abrir_aba_pre_judicial", user, caseItem.id, nextTab)
  }

  const latestFinalization = caseItem.finalization

  const procedureMatches = useMemo(
    () =>
      pre.procedureCatalog
        .filter((item) =>
          `${item.sigtapCode} ${item.description}`
            .toLowerCase()
            .includes(procedureQuery.toLowerCase()),
        )
        .slice(0, 10),
    [pre.procedureCatalog, procedureQuery],
  )

  const cidMatches = useMemo(
    () =>
      pre.cidCatalog
        .filter((item) =>
          `${item.code} ${item.description}`
            .toLowerCase()
            .includes(cidQuery.toLowerCase()),
        )
        .slice(0, 10),
    [pre.cidCatalog, cidQuery],
  )

  const queueItem = pre
    .getDailyQueueForUser(user, 200)
    .find((item) => item.id === caseItem.id)

  function ensureUser() {
    if (!user) {
      toast.error("Usuário não autenticado.")
      return false
    }
    return true
  }

  async function uploadFiles(params: {
    files: FileList | null
    category: "interacao" | "agendamento"
    setUploading: (value: boolean) => void
    onSuccess: (files: UploadedFileMeta[]) => void
  }) {
    const { files, category, setUploading, onSuccess } = params

    if (!files || files.length === 0) {
      toast.error("Selecione ao menos um arquivo.")
      return
    }

    try {
      setUploading(true)

      const form = new FormData()
      form.append("cpf", caseItem.cpf)
      form.append("protocol", caseItem.protocolNumber)
      form.append("module", "prejudicial")
      form.append("category", category)

      Array.from(files).forEach((file) => {
        form.append("files", file)
      })

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: form,
      })

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Falha no upload.")
      }

      onSuccess(data.files as UploadedFileMeta[])
      toast.success("Arquivo(s) enviado(s).")
    } catch (error) {
      console.error("UPLOAD_ERROR", error)
      toast.error("Erro ao enviar arquivo(s).")
    } finally {
      setUploading(false)
    }
  }

  async function handleUploadInteraction() {
    await uploadFiles({
      files: selectedInteractionFiles,
      category: "interacao",
      setUploading: setUploadingInteraction,
      onSuccess: (files) => {
        setUploadedInteractionFiles((prev) => [...prev, ...files])
        setInteractionAttachments((prev) =>
          mergeCommaNames(
            prev,
            files.map((file) => file.name),
          ),
        )
        setSelectedInteractionFiles(null)
      },
    })
  }

  async function handleUploadScheduling() {
    await uploadFiles({
      files: selectedSchedulingFiles,
      category: "agendamento",
      setUploading: setUploadingScheduling,
      onSuccess: (files) => {
        setUploadedSchedulingFiles((prev) => [...prev, ...files])
        setSendAttachments((prev) =>
          mergeCommaNames(
            prev,
            files.map((file) => file.name),
          ),
        )
        setSelectedSchedulingFiles(null)
      },
    })
  }

  function handleInteraction() {
    if (!ensureUser()) return
    if (!interactionDescription.trim()) {
      toast.error("Descreva a interação para registrar no processo.")
      return
    }

    pre.registerInteraction(caseItem.id, {
      description: interactionDescription,
      attachmentNames:
        uploadedInteractionFiles.length > 0
          ? uploadedInteractionFiles
          : splitCommaNames(interactionAttachments),
      user,
    })

    setInteractionDescription("")
    setInteractionAttachments("")
    setSelectedInteractionFiles(null)
    setUploadedInteractionFiles([])
    toast.success("Interação registrada.")
  }

  function handleProcedureAdd(code: string, description: string) {
    if (!ensureUser()) return
    pre.addProcedure(caseItem.id, { sigtapCode: code, description, user })
    setProcedureQuery("")
    toast.success("Procedimento incluído.")
  }

  function handleCidAdd(code: string, description: string) {
    if (!ensureUser()) return
    pre.addCid(caseItem.id, { code, description, user })
    setCidQuery("")
    toast.success("CID incluído.")
  }

  function handleSendToScheduling() {
    if (!ensureUser()) return
    if (!sendDescription.trim()) {
      toast.error("Descreva o motivo do envio ao Agendamento da Demanda.")
      return
    }
    if (!responseDeadlineAt) {
      toast.error("Informe o prazo de resposta do Agendamento da Demanda.")
      return
    }

    const filesText = splitCommaNames(sendAttachments)
    const composedDescription = filesText.length
      ? `${sendDescription}\n\nAnexos: ${filesText.join(", ")}`
      : sendDescription

    pre.sendToScheduling(caseItem.id, {
      description: composedDescription,
      responseDeadlineAt: new Date(responseDeadlineAt).toISOString(),
      attachmentNames:
        uploadedSchedulingFiles.length > 0 ? uploadedSchedulingFiles : filesText,
      user,
    })

    setSendDescription("")
    setResponseDeadlineAt("")
    setSendAttachments("")
    setSelectedSchedulingFiles(null)
    setUploadedSchedulingFiles([])
    toast.success("Demanda enviada ao Agendamento com prazo registrado.")
  }

  function handleClose() {
    if (!ensureUser()) return
    if (
      (finalizeStatus === "devolvida" || finalizeStatus === "pendente") &&
      !closeReason.trim()
    ) {
      toast.error(
        finalizeStatus === "devolvida"
          ? "Informe a justificativa da devolução."
          : "Informe a justificativa da pendência.",
      )
      return
    }

    pre.finalizeDemand(caseItem.id, {
      status: finalizeStatus,
      pendingLocation:
        finalizeStatus === "pendente" ? finalizePendingLocation : undefined,
      reason: closeReason.trim() || undefined,
      user,
    })

    setCloseReason("")
    toast.success("Demanda finalizada.")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant={
                caseItem.deadlineWarningLevel === "overdue"
                  ? "destructive"
                  : "secondary"
              }
            >
              {caseItem.deadlineWarningLevel === "overdue"
                ? "Prazo vencido"
                : caseItem.deadlineWarningLevel === "critical"
                  ? "Prazo crítico"
                  : caseItem.deadlineWarningLevel === "warning"
                    ? "Prazo próximo"
                    : "Prazo regular"}
            </Badge>
            <Badge variant="outline">
              {PREJUDICIAL_STATUS_LABELS[caseItem.status]}
            </Badge>
            {queueItem && (
              <Badge variant="outline">
                {PREJUDICIAL_QUEUE_REASON_LABELS[queueItem.queueReason]}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {caseItem.patientName}
          </h1>
          <p className="text-sm text-muted-foreground">
            CPF {caseItem.cpf} • Protocolo {caseItem.protocolNumber} • Município{" "}
            {caseItem.municipalityName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prazo atual: {new Date(caseItem.deadlineAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <Card className="w-full max-w-xl border-border">
          <CardContent className="grid gap-3 pt-5 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Origem</p>
              <p className="font-medium">{caseItem.originModule.toUpperCase()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Agendamento</p>
              <p className="font-medium">
                {caseItem.schedulingStatus === "fora_fila"
                  ? "Interno"
                  : caseItem.schedulingStatus === "reservado"
                    ? "Reservado"
                    : "Pendente"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atualizado em</p>
              <p className="font-medium">
                {new Date(caseItem.updatedAt).toLocaleString("pt-BR")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          className="bg-transparent"
          onClick={() => {
            if (user) pre.trackUiAction("voltar_processo_pre_judicial", user, caseItem.id)
            window.history.back()
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <Button
          variant="outline"
          className="bg-transparent"
          onClick={() => {
            if (user) pre.trackUiAction("imprimir_processo_pre_judicial", user, caseItem.id)
            window.print()
          }}
        >
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[760px]">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="procedimentos">Procedimentos / CID</TabsTrigger>
          <TabsTrigger value="municipio">Município</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent
          value="visao-geral"
          className="mt-0 grid gap-4 lg:grid-cols-[0.95fr_1fr]"
        >
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Finalizar demanda</CardTitle>
              <CardDescription>
                Esta área fica acima de interagir no processo e leva a demanda para os
                encerrados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(
                  ["pendente", "resolvido", "bloqueio", "sequestro", "obito", "devolvida"] as Array<
                    keyof typeof PRE_FINALIZATION_LABELS
                  >
                ).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={status === finalizeStatus ? "default" : "outline"}
                    className={
                      status === finalizeStatus
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    }
                    onClick={() => setFinalizeStatus(status)}
                  >
                    {PRE_FINALIZATION_LABELS[status]}
                  </Button>
                ))}
              </div>
              {finalizeStatus === "pendente" && (
                <div>
                  <Label className="mb-1 block text-xs">Onde está pendente?</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={finalizePendingLocation}
                    onChange={(e) =>
                      setFinalizePendingLocation(
                        e.target.value as "ses" | "core" | "municipio",
                      )
                    }
                  >
                    <option value="ses">Pendente SES</option>
                    <option value="core">Pendente CORE</option>
                    <option value="municipio">Pendente Município</option>
                  </select>
                </div>
              )}
              <Textarea
                rows={4}
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder={
                  finalizeStatus === "devolvida"
                    ? "Justifique a devolução"
                    : finalizeStatus === "pendente"
                      ? "Descreva a pendência"
                      : "Observação opcional"
                }
              />
              <Button variant="outline" className="bg-transparent" onClick={handleClose}>
                <FileText className="mr-2 h-4 w-4" /> Salvar finalização
              </Button>
              {latestFinalization && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">
                      Última finalização:
                    </span>{" "}
                    {PRE_FINALIZATION_LABELS[latestFinalization.status]}
                  </p>
                  <p>
                    {new Date(latestFinalization.createdAt).toLocaleString("pt-BR")} •{" "}
                    {latestFinalization.createdByName}
                  </p>
                  {latestFinalization.pendingLocation && (
                    <p>Pendente em: {latestFinalization.pendingLocation.toUpperCase()}</p>
                  )}
                  {latestFinalization.reason && (
                    <p>Justificativa: {latestFinalization.reason}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Interagir no processo</CardTitle>
              <CardDescription>
                Descreva algo obrigatório e anexe documentos quando necessário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={5}
                value={interactionDescription}
                onChange={(e) => setInteractionDescription(e.target.value)}
                placeholder="Descreva a interação realizada..."
              />

              <div className="space-y-2">
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setSelectedInteractionFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="bg-transparent"
                  disabled={uploadingInteraction}
                  onClick={handleUploadInteraction}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingInteraction ? "Enviando..." : "Enviar arquivos"}
                </Button>
                <Input
                  value={interactionAttachments}
                  onChange={(e) => setInteractionAttachments(e.target.value)}
                  placeholder="Arquivos enviados"
                />
                {uploadedInteractionFiles.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    {uploadedInteractionFiles.map((file) => (
                      <div key={file.relativePath} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-medium">{file.name}</p>
                        <AttachmentActions attachment={file} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleInteraction}>
                  <Mail className="mr-2 h-4 w-4" /> Registrar interação
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Encaminhar ao Agendamento da Demanda
              </CardTitle>
              <CardDescription>
                Ao enviar, o prazo passa a ser controlado visualmente com alerta
                progressivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={4}
                value={sendDescription}
                onChange={(e) => setSendDescription(e.target.value)}
                placeholder="Explique por que a demanda deve ir para o Agendamento da Demanda..."
              />
              <div>
                <Label className="mb-1 block text-xs">Prazo de resposta</Label>
                <Input
                  type="datetime-local"
                  value={responseDeadlineAt}
                  onChange={(e) => setResponseDeadlineAt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setSelectedSchedulingFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="bg-transparent"
                  disabled={uploadingScheduling}
                  onClick={handleUploadScheduling}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingScheduling ? "Enviando..." : "Enviar arquivos"}
                </Button>
                <Input
                  value={sendAttachments}
                  onChange={(e) => setSendAttachments(e.target.value)}
                  placeholder="Arquivos enviados"
                />
                {uploadedSchedulingFiles.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    {uploadedSchedulingFiles.map((file) => (
                      <div key={file.relativePath} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-medium">{file.name}</p>
                        <AttachmentActions attachment={file} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="bg-transparent"
                onClick={handleSendToScheduling}
              >
                <Send className="mr-2 h-4 w-4" /> Enviar com prazo
              </Button>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Se o prazo vencer sem resposta, o sistema registra automaticamente a
                falta de interação do setor responsável e devolve a demanda para a fila
                do Pré Judicial.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="procedimentos"
          className="mt-0 grid gap-4 lg:grid-cols-[1fr_1fr]"
        >
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Procedimentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={procedureQuery}
                onChange={(e) => setProcedureQuery(e.target.value)}
                placeholder="Digite ortopedia, cardiologia ou código SIGTAP..."
              />
              {procedureQuery.trim() && (
                <div className="rounded-lg border border-border p-2">
                  {procedureMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum procedimento localizado.
                    </p>
                  ) : (
                    procedureMatches.map((item) => (
                      <button
                        key={item.sigtapCode}
                        type="button"
                        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                        onClick={() =>
                          handleProcedureAdd(item.sigtapCode, item.description)
                        }
                      >
                        <span>
                          {item.sigtapCode} - {item.description}
                        </span>
                        <Plus className="h-4 w-4" />
                      </button>
                    ))
                  )}
                </div>
              )}
              <div className="space-y-2">
                {caseItem.procedures.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.sigtapCode} - {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.active ? "Ativo" : "Inativo"} • {item.createdByName}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                      onClick={() =>
                        user && pre.toggleProcedure(caseItem.id, item.id, user)
                      }
                    >
                      {item.active ? "Inativar" : "Ativar"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">CID</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={cidQuery}
                onChange={(e) => setCidQuery(e.target.value)}
                placeholder="Digite M17, I50 ou descrição..."
              />
              {cidQuery.trim() && (
                <div className="rounded-lg border border-border p-2">
                  {cidMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum CID localizado.
                    </p>
                  ) : (
                    cidMatches.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => handleCidAdd(item.code, item.description)}
                      >
                        <span>
                          {item.code} - {item.description}
                        </span>
                        <Plus className="h-4 w-4" />
                      </button>
                    ))
                  )}
                </div>
              )}
              <div className="space-y-2">
                {caseItem.cids.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.code} - {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.active ? "Ativo" : "Inativo"} • {item.createdByName}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                      onClick={() => user && pre.toggleCid(caseItem.id, item.id, user)}
                    >
                      {item.active ? "Inativar" : "Ativar"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="municipio" className="mt-0 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contatos do município</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <strong>Município:</strong> {caseItem.municipalityName}
              </p>
              <p className="text-sm">
                <strong>E-mails:</strong>{" "}
                {municipality?.emails.join(", ") || "Não informado"}
              </p>
              <p className="text-sm">
                <strong>Telefones:</strong>{" "}
                {municipality?.phones.join(", ") || "Não informado"}
              </p>
              <p className="text-sm">
                <strong>Responsáveis:</strong>{" "}
                {municipality?.contacts.join(", ") || "Não informado"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumo da demanda</CardTitle>
              <CardDescription>
                Visualização rápida do andamento atual do caso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Status atual:</strong>{" "}
                {PREJUDICIAL_STATUS_LABELS[caseItem.status]}
              </p>
              <p>
                <strong className="text-foreground">Última atualização:</strong>{" "}
                {new Date(caseItem.updatedAt).toLocaleString("pt-BR")}
              </p>
              <p>
                <strong className="text-foreground">Agendamento:</strong>{" "}
                {caseItem.schedulingStatus === "fora_fila"
                  ? "Interno"
                  : caseItem.schedulingStatus === "reservado"
                    ? "Reservado"
                    : "Pendente"}
              </p>
              {latestFinalization && (
                <p>
                  <strong className="text-foreground">Última finalização:</strong>{" "}
                  {PRE_FINALIZATION_LABELS[latestFinalization.status]}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-0 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Linha do tempo</CardTitle>
              <CardDescription>
                Toda interação permanece registrada com data, hora e usuário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...caseItem.movements].reverse().map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {PREJUDICIAL_MOVEMENT_LABELS[item.type]}
                    </Badge>
                    {item.dueAt && (
                      <Badge variant="secondary">
                        Prazo {new Date(item.dueAt).toLocaleString("pt-BR")}
                      </Badge>
                    )}
                    {item.appointmentDate && (
                      <Badge variant="secondary">
                        Agenda {new Date(item.appointmentDate).toLocaleString("pt-BR")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium">{item.createdByName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  {item.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {item.attachments.map((att) => (
                        <div key={att.id} className="rounded-lg border border-border p-3">
                          <p className="text-sm font-medium">{att.name}</p>
                          <AttachmentActions attachment={att} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Auditoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pre.auditTrail
                .filter((item) => item.caseId === caseItem.id)
                .slice(-15)
                .reverse()
                .map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{item.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("pt-BR")} • {item.action}
                    </p>
                    {item.details && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.details}
                      </p>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}