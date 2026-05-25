"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Ban, CheckCheck, Download, Edit3, Eye, Plus, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import {
  JUDICIAL_FICHA_STATUS_LABELS,
  SYSTEM_LABELS,
  type JudicialFicha,
} from "@/lib/judicial-types"

type UploadedFileMeta = {
  name: string
  storedName: string
  relativePath: string
  url: string
  size: number
  mimeType: string
}

type JudicialFichaStatus = keyof typeof JUDICIAL_FICHA_STATUS_LABELS

const FICHA_STATUS_OPTIONS: JudicialFichaStatus[] = ["atendido", "falta", "obito", "inativa"]

function formatFileSize(size: number) {
  if (!Number.isFinite(size)) return "-"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function AttachmentActions({ attachment }: { attachment: { name: string; url?: string; relativePath?: string } }) {
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

export function JudicialFichasPanel({ caseId }: { caseId: string }) {
  const { user } = useAuth()
  const judicial = useJudicial()
  const caseItem = judicial.getCaseById(caseId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingFichaId, setEditingFichaId] = useState<string | null>(null)
  const [fichaSystem, setFichaSystem] = useState<"CORE" | "SISREG" | "OUTRO">("CORE")
  const [fichaNumber, setFichaNumber] = useState("")
  const [fichaAttachment, setFichaAttachment] = useState("")
  const [fichaNotes, setFichaNotes] = useState("")
  const [fichaProcedureCode, setFichaProcedureCode] = useState("")
  const [fichaCidCode, setFichaCidCode] = useState("")
  const [requestedInclusion, setRequestedInclusion] = useState(false)
  const [hasJudicialMark, setHasJudicialMark] = useState(true)
  const [selectedFichaFiles, setSelectedFichaFiles] = useState<FileList | null>(null)
  const [uploadedFichaFiles, setUploadedFichaFiles] = useState<UploadedFileMeta[]>([])
  const [uploadingFicha, setUploadingFicha] = useState(false)

  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [selectedFichaId, setSelectedFichaId] = useState<string | null>(null)
  const [fichaStatus, setFichaStatus] = useState<JudicialFichaStatus>("atendido")
  const [fichaStatusReason, setFichaStatusReason] = useState("")

  const activeProcedures = useMemo(
    () => caseItem?.procedures.filter((item) => item.active !== false) ?? [],
    [caseItem?.procedures],
  )

  const activeCids = useMemo(
    () => caseItem?.cids.filter((item) => item.active !== false) ?? [],
    [caseItem?.cids],
  )

  if (!caseItem) return null

  function resetFichaForm() {
    setEditingFichaId(null)
    setFichaSystem("CORE")
    setFichaNumber("")
    setFichaAttachment("")
    setFichaNotes("")
    setFichaProcedureCode("")
    setFichaCidCode("")
    setRequestedInclusion(false)
    setHasJudicialMark(true)
    setSelectedFichaFiles(null)
    setUploadedFichaFiles([])
  }

  function handleNewFicha() {
    resetFichaForm()
    setModalOpen(true)
  }

  function handleEditFicha(item: JudicialFicha) {
    setEditingFichaId(item.id)
    setFichaSystem(item.system)
    setFichaNumber(item.number || "")
    setFichaAttachment(item.attachmentName || "")
    setFichaNotes(item.notes || "")
    setFichaProcedureCode(item.notes.includes("Procedimento vinculado:") ? item.notes.split("\n")[0].replace("Procedimento vinculado:", "").trim() : "")
    setFichaCidCode(item.notes.includes("CID vinculado:") ? item.notes.split("\n").find((line) => line.startsWith("CID vinculado:"))?.replace("CID vinculado:", "").trim() || "" : "")
    setRequestedInclusion(item.requestedInclusion)
    setHasJudicialMark(item.hasJudicialMark)
    setSelectedFichaFiles(null)
    setUploadedFichaFiles([])
    setModalOpen(true)
  }

  async function handleUploadFicha() {
    if (!selectedFichaFiles || selectedFichaFiles.length === 0) {
      toast.error("Selecione ao menos um arquivo.")
      return
    }

    try {
      setUploadingFicha(true)
      const form = new FormData()
      form.append("cpf", caseItem.cpf)
      form.append("protocol", caseItem.originProtocol)
      form.append("module", "judicial")
      form.append("category", "ficha")
      Array.from(selectedFichaFiles).forEach((file) => form.append("files", file))

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: form,
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Falha no upload da ficha.")
      }
      const files = data.files as UploadedFileMeta[]
      setUploadedFichaFiles((prev) => [...prev, ...files])
      setFichaAttachment((prev) => [prev, ...files.map((file) => file.name)].filter(Boolean).join(", "))
      setSelectedFichaFiles(null)
      toast.success("Arquivo(s) da ficha enviado(s).")
    } catch (error) {
      console.error("UPLOAD_FICHA_ERROR", error)
      toast.error("Erro ao enviar os anexos da ficha.")
    } finally {
      setUploadingFicha(false)
    }
  }

  function handleSaveFicha() {
    if (!user) return
    if (!fichaNotes.trim()) {
      toast.error("Preencha as observações da ficha.")
      return
    }

    const noteLines = [
      fichaProcedureCode ? `Procedimento vinculado: ${fichaProcedureCode}` : "",
      fichaCidCode ? `CID vinculado: ${fichaCidCode}` : "",
      fichaNotes.trim(),
    ].filter(Boolean)
    const currentFicha = editingFichaId
      ? caseItem.fichas.find((item) => item.id === editingFichaId)
      : undefined

    const payload = {
      system: fichaSystem,
      number: fichaNumber || undefined,
      requestedInclusion,
      hasJudicialMark,
      attachmentName: fichaAttachment || undefined,
      attachmentUrl: uploadedFichaFiles[0]?.url ?? currentFicha?.attachmentUrl,
      attachmentRelativePath: uploadedFichaFiles[0]?.relativePath ?? currentFicha?.attachmentRelativePath,
      notes: noteLines.join("\n"),
      user,
    }

    if (editingFichaId) {
      judicial.updateFicha(caseItem.id, editingFichaId, payload)
      toast.success("Ficha atualizada.")
    } else {
      judicial.addFicha(caseItem.id, payload)
      toast.success("Ficha cadastrada.")
    }

    setModalOpen(false)
    resetFichaForm()
  }

  function handleToggleFicha(item: JudicialFicha) {
    if (!user) return
    const reason = item.active === false
      ? undefined
      : window.prompt("Informe o motivo da inativação da ficha:", item.inactiveReason || "Cadastro incorreto") || undefined
    judicial.toggleFicha(caseItem.id, item.id, user, reason)
    toast.success(item.active === false ? "Ficha reativada." : "Ficha inativada.")
  }

  function handleOpenStatus(item: JudicialFicha) {
    setSelectedFichaId(item.id)
    setFichaStatus(item.status ?? "atendido")
    setFichaStatusReason(item.statusReason ?? "")
    setStatusModalOpen(true)
  }

  function handleSaveStatus() {
    if (!user || !selectedFichaId) return
    if (!fichaStatusReason.trim()) {
      toast.error("Justifique a alteração do status da ficha.")
      return
    }

    judicial.updateFichaStatus(caseItem.id, {
      fichaId: selectedFichaId,
      status: fichaStatus,
      reason: fichaStatusReason.trim(),
      user,
    })

    setStatusModalOpen(false)
    setSelectedFichaId(null)
    setFichaStatusReason("")
    toast.success("Status da ficha atualizado.")
  }

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base">Fichas (CORE/SISREG)</CardTitle>
          <Button onClick={handleNewFicha}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar nova ficha
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Sistema</th>
                  <th className="px-3 py-2">Nº da ficha</th>
                  <th className="px-3 py-2">Anexo</th>
                  <th className="px-3 py-2">SIGTAP vinculado</th>
                  <th className="px-3 py-2">CID vinculado</th>
                  <th className="px-3 py-2">Observações</th>
                  <th className="px-3 py-2">Judicial marcada?</th>
                  <th className="px-3 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {caseItem.fichas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Nenhuma ficha cadastrada.
                    </td>
                  </tr>
                ) : (
                  caseItem.fichas.map((item) => {
                    const lines = (item.notes || "").split("\n").map((line) => line.trim()).filter(Boolean)
                    const linkedProcedure = lines.find((line) => line.startsWith("Procedimento vinculado:"))?.replace("Procedimento vinculado:", "").trim() || "-"
                    const linkedCid = lines.find((line) => line.startsWith("CID vinculado:"))?.replace("CID vinculado:", "").trim() || "-"
                    const notes = lines.filter((line) => !line.startsWith("Procedimento vinculado:") && !line.startsWith("CID vinculado:")).join(" ") || "-"

                    return (
                      <tr key={item.id} className="border-b border-border align-top">
                        <td className="px-3 py-3">{SYSTEM_LABELS[item.system]}</td>
                        <td className="px-3 py-3">
                          <div className="space-y-2">
                            <p>{item.number || "Sem número"}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={item.active === false ? "outline" : "secondary"}>
                                {item.active === false ? "Inativa" : "Ativa"}
                              </Badge>
                              {item.status && (
                                <Badge variant="outline">{JUDICIAL_FICHA_STATUS_LABELS[item.status]}</Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {item.attachmentName ? (
                            <div className="max-w-[220px]">
                              <p className="truncate text-sm font-medium">{item.attachmentName}</p>
                              <AttachmentActions
                                attachment={{
                                  name: item.attachmentName,
                                  url: item.attachmentUrl,
                                  relativePath: item.attachmentRelativePath,
                                }}
                              />
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-3">{linkedProcedure}</td>
                        <td className="px-3 py-3">{linkedCid}</td>
                        <td className="px-3 py-3">
                          <p className="max-w-[280px] whitespace-pre-wrap text-muted-foreground">{notes}</p>
                          {item.inactiveReason && (
                            <p className="mt-1 text-xs text-destructive">Inativação: {item.inactiveReason}</p>
                          )}
                          {item.statusReason && (
                            <p className="mt-1 text-xs text-muted-foreground">Status: {item.statusReason}</p>
                          )}
                        </td>
                        <td className="px-3 py-3">{item.hasJudicialMark ? "Sim" : "Não"}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="bg-transparent"
                              title="Editar ficha"
                              onClick={() => handleEditFicha(item)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="bg-transparent"
                              title="Alterar status da ficha"
                              onClick={() => handleOpenStatus(item)}
                            >
                              <CheckCheck className="h-4 w-4" />
                            </Button>
                            {item.attachmentUrl && (
                              <Button asChild variant="outline" size="icon" className="bg-transparent" title="Visualizar ficha">
                                <a href={item.attachmentUrl} target="_blank" rel="noreferrer">
                                  <Eye className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {item.attachmentUrl && (
                              <Button asChild variant="outline" size="icon" className="bg-transparent" title="Baixar ficha">
                                <a href={item.attachmentRelativePath ? `/api/files/${item.attachmentRelativePath}?download=1` : `${item.attachmentUrl}${item.attachmentUrl.includes("?") ? "&" : "?"}download=1`}>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              className="bg-transparent"
                              title={item.active === false ? "Reativar ficha" : "Inativar ficha"}
                              onClick={() => handleToggleFicha(item)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingFichaId ? "Editar ficha" : "Cadastrar nova ficha"}</DialogTitle>
            <DialogDescription>
              Informe os dados principais da ficha e os vínculos necessários.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">Sistema</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={fichaSystem}
                  onChange={(e) => setFichaSystem(e.target.value as "CORE" | "SISREG" | "OUTRO")}
                >
                  <option value="CORE">CORE</option>
                  <option value="SISREG">SISREG</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Número da ficha</Label>
                <Input value={fichaNumber} onChange={(e) => setFichaNumber(e.target.value)} placeholder="CORE-202600001" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">SIGTAP vinculado</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={fichaProcedureCode}
                  onChange={(e) => setFichaProcedureCode(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {activeProcedures.map((item) => (
                    <option key={item.id} value={`${item.sigtapCode} - ${item.description}`}>
                      {item.sigtapCode} - {item.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">CID vinculado</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={fichaCidCode}
                  onChange={(e) => setFichaCidCode(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {activeCids.map((item) => (
                    <option key={item.id} value={`${item.code} - ${item.description}`}>
                      {item.code} - {item.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                <input type="checkbox" checked={requestedInclusion} onChange={(e) => setRequestedInclusion(e.target.checked)} />
                Foi solicitada inclusão
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                <input type="checkbox" checked={hasJudicialMark} onChange={(e) => setHasJudicialMark(e.target.checked)} />
                Judicial marcada?
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
              <div>
                <Label className="mb-1 block text-xs">Anexar ficha</Label>
                <Input type="file" multiple onChange={(e) => setSelectedFichaFiles(e.target.files)} />
              </div>

              {selectedFichaFiles && selectedFichaFiles.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  {Array.from(selectedFichaFiles).map((file) => (
                    <p key={`${file.name}-${file.size}`}>{file.name} • {formatFileSize(file.size)}</p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="bg-transparent" disabled={uploadingFicha} onClick={handleUploadFicha}>
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingFicha ? "Enviando..." : "Enviar arquivo(s)"}
                </Button>
              </div>

              <Input value={fichaAttachment} onChange={(e) => setFichaAttachment(e.target.value)} placeholder="Arquivos enviados" />

              {uploadedFichaFiles.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {uploadedFichaFiles.map((file) => (
                    <a key={file.relativePath} href={file.url} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">
                      {file.name}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="mb-1 block text-xs">Observações</Label>
              <Textarea rows={4} value={fichaNotes} onChange={(e) => setFichaNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveFicha}>{editingFichaId ? "Salvar alterações" : "Salvar ficha"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar status da ficha</DialogTitle>
            <DialogDescription>
              Informe o resultado final da ficha ou a inativação do registro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs">Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={fichaStatus}
                onChange={(e) => setFichaStatus(e.target.value as JudicialFichaStatus)}
              >
                {FICHA_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {JUDICIAL_FICHA_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Justificativa</Label>
              <Textarea rows={4} value={fichaStatusReason} onChange={(e) => setFichaStatusReason(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setStatusModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveStatus}>Salvar status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
