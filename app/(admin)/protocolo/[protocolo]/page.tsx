"use client"

import React, { useState, useRef, use } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import Link from "next/link"
import {
  ArrowLeft,
  Send,
  Paperclip,
  Trash2,
  Printer,
  FileText,
  ClipboardList,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Plus,
  File,
  Download,
  MessageSquare,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useStore } from "@/lib/store-context"
import { usePermissions } from "@/lib/permissions"
import {
  interacaoSchema,
  PENDENCIA_TIPOS,
  PENDENCIA_LABELS,
  DEMANDA_STATUS,
  DEMANDA_STATUS_LABELS,
  MODULE_LABELS,
  TIPO_SOLICITACAO_LABELS,
  CATEGORIA_ANEXO,
  CATEGORIA_ANEXO_LABELS,
  type InteracaoFormData,
  type CategoriaAnexo,
  type DemandaStatus,
  type Module,
  type PendenciaTipo,
} from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const MODULE_ICONS: Record<Module, typeof FileText> = {
  tfd: FileText,
  cnrac: ClipboardList,
  hemodialise: Stethoscope,
}

const STATUS_CONFIG: Record<DemandaStatus, { icon: typeof AlertTriangle; color: string }> = {
  pendente: { icon: AlertTriangle, color: "bg-amber-100 text-amber-800" },
  resolvido: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800" },
  devolvida: { icon: RotateCcw, color: "bg-red-100 text-red-800" },
}

export default function ProtocoloPage({ params }: { params: Promise<{ protocolo: string }> }) {
  const { protocolo } = use(params)
  const { user } = useAuth()
  const store = useStore()
  const { hasPermission } = usePermissions()

  const demanda = store.getDemandaByProtocol(decodeURIComponent(protocolo))
  const paciente = demanda ? store.pacientes.find((p) => p.id === demanda.pacienteId) : null

  const [showInteracao, setShowInteracao] = useState(false)
  const [showAnexo, setShowAnexo] = useState(false)
  const [showPrint, setShowPrint] = useState(false)

  if (!user) return null

  if (!demanda || !paciente) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Protocolo nao encontrado</h2>
        <p className="text-sm text-muted-foreground">O protocolo informado nao existe no sistema.</p>
        <Button asChild variant="outline"><Link href="/dashboard">Voltar ao Dashboard</Link></Button>
      </div>
    )
  }

  const canInteract = hasPermission(user.role, demanda.modulo, "interagir")
  const canPrint = hasPermission(user.role, demanda.modulo, "imprimir")
  const canRemoveDoc = hasPermission(user.role, demanda.modulo, "remover_documento")
  const canEdit = hasPermission(user.role, demanda.modulo, "editar")

  const Icon = MODULE_ICONS[demanda.modulo]
  const statusCfg = STATUS_CONFIG[demanda.status]
  const StatusIcon = statusCfg.icon

  // Collect all attachments from demand + interactions
  const allAnexos = [
    ...demanda.anexos.map((a) => ({ ...a, origem: "Demanda" })),
    ...demanda.interacoes.flatMap((i) =>
      i.anexos.map((a) => ({ ...a, origem: `Interacao - ${i.criadoPorNome}` })),
    ),
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${demanda.modulo}`} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{demanda.protocolo}</h1>
              <Badge variant="outline" className={statusCfg.color}>
                <StatusIcon className="mr-1 h-3 w-3" />{DEMANDA_STATUS_LABELS[demanda.status]}
              </Badge>
              <Badge variant="secondary"><Icon className="mr-1 h-3 w-3" />{MODULE_LABELS[demanda.modulo]}</Badge>
              {demanda.acaoJudicial && <Badge variant="destructive" className="text-xs">Acao Judicial</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Criado em {new Date(demanda.criadoEm).toLocaleDateString("pt-BR")} por {demanda.criadoPorNome}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canInteract && (
            <Button size="sm" onClick={() => setShowInteracao(true)}>
              <MessageSquare className="mr-1 h-3.5 w-3.5" /> Nova Interacao
            </Button>
          )}
          {canInteract && (
            <Button size="sm" variant="outline" onClick={() => setShowAnexo(true)}>
              <Paperclip className="mr-1 h-3.5 w-3.5" /> Anexar Documento
            </Button>
          )}
          {canPrint && (
            <Button size="sm" variant="outline" onClick={() => setShowPrint(true)}>
              <Printer className="mr-1 h-3.5 w-3.5" /> Imprimir
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="detalhes" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="interacoes">Interacoes ({demanda.interacoes.length})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos ({allAnexos.length})</TabsTrigger>
        </TabsList>

        {/* ── TAB: Detalhes ──────────────────────── */}
        <TabsContent value="detalhes" className="mt-0 flex flex-col gap-4">
          {/* Status update */}
          {canEdit && (
            <Card className="border-border">
              <CardContent className="flex flex-wrap items-center gap-3 pt-4">
                <Label className="text-sm font-semibold">Finalizar demanda:</Label>
                {DEMANDA_STATUS.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={demanda.status === s ? "default" : "outline"}
                    onClick={() => {
                      store.updateDemandaStatus(demanda.id, s)
                      toast.success(`Status alterado para ${DEMANDA_STATUS_LABELS[s]}`)
                    }}
                  >
                    {DEMANDA_STATUS_LABELS[s]}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Paciente */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-card-foreground">Paciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <InfoRow label="Nome" value={paciente.nome} />
                <InfoRow label="CPF" value={paciente.cpf} />
                <InfoRow label="CNS" value={paciente.cartaoSus} />
                <InfoRow label="Data Nasc." value={new Date(paciente.dataNascimento).toLocaleDateString("pt-BR")} />
                <InfoRow label="Telefone(s)" value={paciente.telefones.join(", ")} />
                <InfoRow label="E-mail" value={paciente.email || "-"} />
                <InfoRow label="Municipio" value={paciente.municipio} />
                <InfoRow label="Endereco" value={paciente.endereco} />
              </div>
            </CardContent>
          </Card>

          {/* Solicitante */}
          <Card className="border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base text-card-foreground">Dados do Solicitante</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <InfoRow label="Local" value={demanda.localSolicitante} />
                <InfoRow label="Telefone(s)" value={demanda.telefoneSolicitante.join(", ")} />
                <InfoRow label="E-mail" value={demanda.emailSolicitante || "-"} />
              </div>
            </CardContent>
          </Card>

          {/* Clinicos */}
          <Card className="border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base text-card-foreground">Dados Clinicos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label="SIGTAP" value={`${demanda.codigoSigtap} - ${demanda.descricaoSigtap}`} />
                <InfoRow label="CID-10" value={demanda.cid10} />
                <InfoRow label="Especialidade" value={demanda.especialidade} />
                <InfoRow label="Subespecialidade" value={demanda.subespecialidade || "-"} />
                <InfoRow label="Peso" value={demanda.peso ? `${demanda.peso} kg` : "-"} />
                <InfoRow label="Altura" value={demanda.altura ? `${demanda.altura} m` : "-"} />
                <InfoRow label="Tipo Sanguineo" value={demanda.tipoSanguineo || "-"} />
                <InfoRow label="Tipo Solicitacao" value={TIPO_SOLICITACAO_LABELS[demanda.tipoSolicitacao]} />
                <InfoRow label="Local Solicitado" value={demanda.localSolicitado || "-"} />
              </div>
              {demanda.observacoesUnidade && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">Observacoes da Unidade</p>
                  <p className="mt-1 text-sm text-card-foreground">{demanda.observacoesUnidade}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Interacoes ────────────────────── */}
        <TabsContent value="interacoes" className="mt-0 flex flex-col gap-4">
          {canInteract && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowInteracao(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Nova Interacao
              </Button>
            </div>
          )}

          {demanda.interacoes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma interacao registrada neste protocolo.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {demanda.interacoes.map((inter) => (
                <Card key={inter.id} className="border-border">
                  <CardContent className="pt-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-card-foreground">{inter.criadoPorNome}</span>
                        <span className="text-xs text-muted-foreground">CPF: {inter.criadoPorCpf}</span>
                        <span className="text-xs text-muted-foreground">{new Date(inter.criadoEm).toLocaleString("pt-BR")}</span>
                        {inter.pendencia && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800">
                            {PENDENCIA_LABELS[inter.pendencia]}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-card-foreground whitespace-pre-wrap">{inter.texto}</p>
                      {inter.anexos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {inter.anexos.map((a) => (
                            <Badge key={a.id} variant="secondary" className="gap-1 text-xs">
                              <File className="h-3 w-3" />{a.nome}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {inter.assinaturaUrl !== undefined && (
                        <div className="mt-2 rounded border border-border bg-muted/30 p-2">
                          <p className="text-xs text-muted-foreground">Assinatura Medica SES</p>
                          {inter.assinaturaUrl ? (
                            <img src={inter.assinaturaUrl || "/placeholder.svg"} alt="Assinatura medica" className="mt-1 max-h-16 object-contain" />
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground italic">Assinatura nao configurada no perfil.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Documentos ────────────────────── */}
        <TabsContent value="documentos" className="mt-0 flex flex-col gap-4">
          {canInteract && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowAnexo(true)}>
                <Paperclip className="mr-1 h-3.5 w-3.5" /> Anexar Documento
              </Button>
            </div>
          )}

          {allAnexos.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum documento anexado a este protocolo.
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="pt-4">
                <div className="flex flex-col gap-2">
                  {allAnexos.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <File className="h-8 w-8 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-card-foreground">{a.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {CATEGORIA_ANEXO_LABELS[a.categoria as CategoriaAnexo]} | {a.origem} | {(a.tamanho / 1024).toFixed(0)} KB | {new Date(a.criadoEm).toLocaleDateString("pt-BR")}
                        </p>
                        {a.descricao && <p className="text-xs text-muted-foreground italic">{a.descricao}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" aria-label="Baixar">
                          <Download className="h-4 w-4" />
                        </Button>
                        {canRemoveDoc && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remover documento"
                            onClick={() => {
                              store.removeAnexoFromDemanda(demanda.id, a.id)
                              toast.success("Documento removido")
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Interacao dialog */}
      <InteracaoDialog
        open={showInteracao}
        onClose={() => setShowInteracao(false)}
        demandaId={demanda.id}
        modulo={demanda.modulo}
      />

      {/* Anexo dialog */}
      <AnexoDialog
        open={showAnexo}
        onClose={() => setShowAnexo(false)}
        demandaId={demanda.id}
      />

      {/* Print dialog */}
      <PrintDialog
        open={showPrint}
        onClose={() => setShowPrint(false)}
        demanda={demanda}
        paciente={paciente}
        allAnexos={allAnexos}
      />
    </div>
  )
}

// ── Helper row ─────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-card-foreground">{value}</span>
    </div>
  )
}

// ── Interacao dialog ───────────────────────────────────
function InteracaoDialog({
  open,
  onClose,
  demandaId,
  modulo,
}: {
  open: boolean
  onClose: () => void
  demandaId: string
  modulo: Module
}) {
  const { user } = useAuth()
  const store = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachFiles, setAttachFiles] = useState<{ nome: string; tipo: string; tamanho: number; categoria: CategoriaAnexo; descricao: string }[]>([])

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<InteracaoFormData>({
    resolver: zodResolver(interacaoSchema),
    defaultValues: { texto: "", pendencia: undefined },
  })

  function handle(data: InteracaoFormData) {
    if (!user) return
    const anexos = attachFiles.map((f) => ({
      ...f,
      id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      url: "#",
      criadoEm: new Date().toISOString(),
      criadoPor: user.id,
      criadoPorNome: user.nome,
    }))

    store.addInteracao(demandaId, {
      texto: data.texto,
      pendencia: data.pendencia,
      criadoPor: user.id,
      criadoPorNome: user.nome,
      criadoPorCpf: user.cpf,
      assinaturaUrl: user.role === "MEDICO_SES" ? (user.assinaturaMedicoUrl ?? "") : undefined,
      anexos,
    })

    // Emit notification to all users
    const demandaRef = store.getDemandaById(demandaId)
    if (demandaRef) {
      const pacRef = store.pacientes.find((p) => p.id === demandaRef.pacienteId)
      store.addNotificacao({
        protocolo: demandaRef.protocolo,
        modulo,
        mensagem: `${user.nome} registrou uma nova interacao.${data.pendencia ? ` Pendencia: ${data.pendencia}` : ""}`,
        destinatarioId: "all",
        pacienteNome: pacRef?.nome ?? "Paciente",
      })
      // Send email notification (fire and forget)
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: demandaRef.emailSolicitante,
          subject: `Nova interacao no protocolo ${demandaRef.protocolo}`,
          text: `Nova interacao por ${user.nome} no protocolo ${demandaRef.protocolo}: ${data.texto.slice(0, 200)}`,
        }),
      }).catch(() => {})
    }

    toast.success("Interacao registrada")
    reset()
    setAttachFiles([])
    onClose()
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    for (const f of Array.from(files)) {
      setAttachFiles((prev) => [...prev, { nome: f.name, tipo: f.type, tamanho: f.size, categoria: "outros", descricao: "" }])
    }
    e.target.value = ""
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); setAttachFiles([]) } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Nova Interacao</DialogTitle>
          <DialogDescription>Registre uma nova movimentacao neste protocolo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handle)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label>Texto da Interacao</Label>
            <Textarea rows={4} {...register("texto")} />
            {errors.texto && <p className="text-xs text-destructive" role="alert">{errors.texto.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Marcar Pendencia (opcional)</Label>
            <Controller
              control={control}
              name="pendencia"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || undefined)}>
                  <SelectTrigger><SelectValue placeholder="Sem pendencia" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem pendencia</SelectItem>
                    {PENDENCIA_TIPOS.map((p) => (
                      <SelectItem key={p} value={p}>{PENDENCIA_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Attach files */}
          <div className="flex flex-col gap-2">
            <Label>Documentos (opcional)</Label>
            {attachFiles.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{f.nome}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => setAttachFiles((p) => p.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            <input ref={fileInputRef} type="file" multiple className="sr-only" onChange={handleFileAdd} />
            <Button type="button" variant="outline" size="sm" className="w-fit bg-transparent" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="mr-1 h-3.5 w-3.5" /> Anexar arquivo
            </Button>
          </div>

          {user?.role === "MEDICO_SES" && (
            <div className="rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Sua assinatura medica sera incluida automaticamente nesta interacao.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onClose(); reset(); setAttachFiles([]) }}>Cancelar</Button>
            <Button type="submit"><Send className="mr-1 h-3.5 w-3.5" /> Registrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Anexo dialog ───────────────────────────────────────
function AnexoDialog({
  open,
  onClose,
  demandaId,
}: {
  open: boolean
  onClose: () => void
  demandaId: string
}) {
  const { user } = useAuth()
  const store = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ nome: string; tipo: string; tamanho: number } | null>(null)
  const [categoria, setCategoria] = useState<CategoriaAnexo>("outros")
  const [descricao, setDescricao] = useState("")

  function handleSubmitAnexo() {
    if (!file || !user) return
    store.addAnexoToDemanda(demandaId, {
      nome: file.nome,
      tipo: file.tipo,
      tamanho: file.tamanho,
      categoria,
      descricao,
      criadoPor: user.id,
      criadoPorNome: user.nome,
    })
    toast.success("Documento anexado")
    setFile(null)
    setDescricao("")
    setCategoria("outros")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setFile(null) } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Anexar Documento</DialogTitle>
          <DialogDescription>Selecione o arquivo e a categoria do documento.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaAnexo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIA_ANEXO.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORIA_ANEXO_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Descricao</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o documento..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Arquivo</Label>
            {file ? (
              <div className="flex items-center gap-2 rounded border border-border p-2">
                <File className="h-4 w-4 text-primary" />
                <span className="flex-1 truncate text-sm">{file.nome}</span>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="mr-1 h-3.5 w-3.5" /> Selecionar arquivo
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setFile({ nome: f.name, tipo: f.type, tamanho: f.size })
                e.target.value = ""
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setFile(null) }}>Cancelar</Button>
          <Button onClick={handleSubmitAnexo} disabled={!file}>Anexar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Print dialog ───────────────────────────────────────
function PrintDialog({
  open,
  onClose,
  demanda,
  paciente,
  allAnexos,
}: {
  open: boolean
  onClose: () => void
  demanda: ReturnType<ReturnType<typeof useStore>["getDemandaById"]> & {}
  paciente: { nome: string; cpf: string; cartaoSus: string }
  allAnexos: { id: string; nome: string }[]
}) {
  const [includeAnexos, setIncludeAnexos] = useState(false)
  const [selectedInteracoes, setSelectedInteracoes] = useState<Set<string>>(
    new Set(demanda.interacoes.map((i) => i.id)),
  )

  function toggleInteracao(id: string) {
    setSelectedInteracoes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handlePrint() {
    const printContent = document.createElement("div")
    printContent.innerHTML = `
      <style>body{font-family:sans-serif;padding:20px;color:#1a1a1a}h1{font-size:18px}h2{font-size:14px;margin-top:16px;border-bottom:1px solid #ccc;padding-bottom:4px}.row{display:flex;gap:16px;margin:4px 0}.label{font-weight:bold;min-width:120px;font-size:12px;color:#666}.value{font-size:13px}.interaction{border:1px solid #ddd;padding:8px;margin:6px 0;border-radius:4px}.sig{margin-top:8px;max-height:60px}@media print{body{padding:0}}</style>
      <h1>Protocolo: ${demanda.protocolo}</h1>
      <p>Modulo: ${MODULE_LABELS[demanda.modulo]} | Status: ${DEMANDA_STATUS_LABELS[demanda.status]} | Data: ${new Date(demanda.criadoEm).toLocaleDateString("pt-BR")}</p>
      <h2>Paciente</h2>
      <div class="row"><span class="label">Nome:</span><span class="value">${paciente.nome}</span></div>
      <div class="row"><span class="label">CPF:</span><span class="value">${paciente.cpf}</span></div>
      <div class="row"><span class="label">CNS:</span><span class="value">${paciente.cartaoSus}</span></div>
      <h2>Procedimento</h2>
      <div class="row"><span class="label">SIGTAP:</span><span class="value">${demanda.codigoSigtap} - ${demanda.descricaoSigtap}</span></div>
      <div class="row"><span class="label">CID-10:</span><span class="value">${demanda.cid10}</span></div>
      <div class="row"><span class="label">Especialidade:</span><span class="value">${demanda.especialidade}</span></div>
      ${demanda.interacoes.filter((i) => selectedInteracoes.has(i.id)).map((i) => `
        <h2>Interacao - ${new Date(i.criadoEm).toLocaleString("pt-BR")}</h2>
        <div class="interaction">
          <div class="row"><span class="label">Por:</span><span class="value">${i.criadoPorNome} (${i.criadoPorCpf})</span></div>
          <p>${i.texto}</p>
          ${i.pendencia ? `<div class="row"><span class="label">Pendencia:</span><span class="value">${PENDENCIA_LABELS[i.pendencia]}</span></div>` : ""}
          ${i.assinaturaUrl ? `<img src="${i.assinaturaUrl}" class="sig" alt="Assinatura" />` : ""}
        </div>
      `).join("")}
      ${includeAnexos ? `<h2>Documentos Anexados</h2><ul>${allAnexos.map((a) => `<li>${a.nome}</li>`).join("")}</ul>` : ""}
    `
    const printWin = window.open("", "_blank")
    if (printWin) {
      printWin.document.write(printContent.innerHTML)
      printWin.document.close()
      printWin.print()
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Opcoes de Impressao</DialogTitle>
          <DialogDescription>Selecione quais interacoes e documentos incluir na impressao.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="print-anexos"
              checked={includeAnexos}
              onCheckedChange={(v) => setIncludeAnexos(v === true)}
            />
            <Label htmlFor="print-anexos" className="cursor-pointer">Incluir lista de documentos anexados</Label>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-semibold">Interacoes a incluir:</Label>
            {demanda.interacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma interacao.</p>
            ) : (
              demanda.interacoes.map((i) => (
                <div key={i.id} className="flex items-start gap-2">
                  <Checkbox
                    id={`print-int-${i.id}`}
                    checked={selectedInteracoes.has(i.id)}
                    onCheckedChange={() => toggleInteracao(i.id)}
                  />
                  <Label htmlFor={`print-int-${i.id}`} className="cursor-pointer text-sm">
                    {new Date(i.criadoEm).toLocaleString("pt-BR")} - {i.criadoPorNome}: {i.texto.slice(0, 80)}...
                  </Label>
                </div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handlePrint}><Printer className="mr-1 h-3.5 w-3.5" /> Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
