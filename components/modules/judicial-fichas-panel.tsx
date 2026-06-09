"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Ban, CheckCheck, Download, Eye, Plus, Trash2, Upload, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import {
  JUDICIAL_FICHA_STATUS_LABELS,
  SYSTEM_LABELS,
  type JudicialCase,
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

function getLinkedValue(notes: string, label: string) {
  return (
    notes
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith(label))
      ?.replace(label, "")
      .trim() || "-"
  )
}

function getPlainNotes(notes: string) {
  return (
    notes
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("Procedimento vinculado:"))
      .filter((line) => !line.startsWith("CID vinculado:"))
      .join(" ") || "-"
  )
}

export function JudicialFichasPanel({ caseId }: { caseId: string }) {
  const { user } = useAuth()

  const [caseItem, setCaseItem] = useState<JudicialCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
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
  const [savingFicha, setSavingFicha] = useState(false)
  const [statusFichaId, setStatusFichaId] = useState("")
  const [fichaStatus, setFichaStatus] = useState<JudicialFichaStatus>("atendido")
  const [fichaStatusReason, setFichaStatusReason] = useState("")
  const [savingAction, setSavingAction] = useState(false)

  async function loadCase() {
    try {
      setLoading(true)
      const response = await fetch(`/api/judicial/casos/${encodeURIComponent(caseId)}`, {
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.ok || !data?.item) {
        throw new Error(data?.error || "Processo judicial não encontrado.")
      }

      setCaseItem(data.item as JudicialCase)
    } catch (error) {
      console.error("LOAD_JUDICIAL_FICHAS_CASE_ERROR", error)
      toast.error(error instanceof Error ? error.message : "Erro ao carregar fichas.")
      setCaseItem(null)
    } finally {
      setLoading(false)
    }
  }

  function refreshProcessView() {
    window.location.reload()
  }

  useEffect(() => {
    void loadCase()
  }, [caseId])

  const activeProcedures = useMemo(
    () => caseItem?.procedures.filter((item) => item.active !== false) ?? [],
    [caseItem],
  )

  const activeCids = useMemo(
    () => caseItem?.cids.filter((item) => item.active !== false) ?? [],
    [caseItem],
  )

  function resetFichaForm() {
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
    setFormOpen(true)
  }

  async function handleUploadFicha() {
    if (!caseItem) return

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

  async function handleSaveFicha() {
    if (!user) return

    if (!fichaNumber.trim()) {
      toast.error("Informe o número da ficha.")
      return
    }

    try {
      setSavingFicha(true)

      const noteLines = [
        fichaProcedureCode ? `Procedimento vinculado: ${fichaProcedureCode}` : "",
        fichaCidCode ? `CID vinculado: ${fichaCidCode}` : "",
        fichaNotes.trim(),
      ].filter(Boolean)

      const response = await fetch(`/api/judicial/casos/${encodeURIComponent(caseId)}/fichas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: fichaSystem,
          number: fichaNumber.trim(),
          requestedInclusion,
          hasJudicialMark,
          attachmentName: fichaAttachment || undefined,
          attachmentUrl: uploadedFichaFiles[0]?.url,
          attachmentRelativePath: uploadedFichaFiles[0]?.relativePath,
          notes: noteLines.join("\n"),
          user,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao cadastrar ficha.")
      }

      toast.success("Ficha cadastrada no banco.")
      setFormOpen(false)
      resetFichaForm()
      refreshProcessView()
    } catch (error) {
      console.error("SAVE_JUDICIAL_FICHA_ERROR", error)
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar ficha.")
    } finally {
      setSavingFicha(false)
    }
  }

  function openStatusForm(item: JudicialFicha) {
    setStatusFichaId(item.id)
    setFichaStatus((item.status as JudicialFichaStatus) || "atendido")
    setFichaStatusReason(item.statusReason || "")
  }

  async function updateFichaAction(action: string, fichaId: string, extra: Record<string, unknown> = {}) {
    if (!user) return

    try {
      setSavingAction(true)
      const response = await fetch(`/api/judicial/casos/${encodeURIComponent(caseId)}/fichas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichaId, action, user, ...extra }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao atualizar ficha.")
      }

      toast.success("Ficha atualizada.")
      setStatusFichaId("")
      setFichaStatusReason("")
      refreshProcessView()
    } catch (error) {
      console.error("UPDATE_JUDICIAL_FICHA_ERROR", error)
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar ficha.")
    } finally {
      setSavingAction(false)
    }
  }

  async function deleteFicha(item: JudicialFicha) {
    if (!user) return

    const reason = window.prompt(`Informe o motivo para excluir a ficha ${item.number || item.id}:`, "Cadastro incorreto")
    if (reason === null) return

    const confirmed = window.confirm(`Confirma excluir a ficha ${item.number || item.id}?`)
    if (!confirmed) return

    try {
      setSavingAction(true)
      const response = await fetch(`/api/judicial/casos/${encodeURIComponent(caseId)}/fichas`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichaId: item.id, reason, user }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao excluir ficha.")
      }

      toast.success("Ficha excluída.")
      refreshProcessView()
    } catch (error) {
      console.error("DELETE_JUDICIAL_FICHA_ERROR", error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir ficha.")
    } finally {
      setSavingAction(false)
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando fichas...</p>
  }

  if (!caseItem) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Processo judicial não encontrado.</p>
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
        <CardContent className="space-y-4">
          {formOpen && (
            <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Nova ficha</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
                  <X className="mr-2 h-4 w-4" /> Fechar
                </Button>
              </div>

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
                  <Input value={fichaNumber} onChange={(e) => setFichaNumber(e.target.value)} placeholder="Número da ficha" />
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

                <Button type="button" variant="outline" className="bg-transparent" disabled={uploadingFicha} onClick={handleUploadFicha}>
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingFicha ? "Enviando..." : "Enviar arquivo(s)"}
                </Button>

                <Input value={fichaAttachment} onChange={(e) => setFichaAttachment(e.target.value)} placeholder="Arquivos enviados" />
              </div>

              <div>
                <Label className="mb-1 block text-xs">Observações</Label>
                <Textarea rows={4} value={fichaNotes} onChange={(e) => setFichaNotes(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="bg-transparent" onClick={() => setFormOpen(false)} disabled={savingFicha}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveFicha} disabled={savingFicha}>
                  {savingFicha ? "Salvando..." : "Salvar ficha"}
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Sistema</th>
                  <th className="px-3 py-2">Nº da ficha</th>
                  <th className="px-3 py-2">Anexo</th>
                  <th className="px-3 py-2">SIGTAP vinculado</th>
                  <th className="px-3 py-2">CID vinculado</th>
                  <th className="px-3 py-2">Observações</th>
                  <th className="px-3 py-2">Judicial?</th>
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
                    const notes = item.notes || ""
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
                        <td className="px-3 py-3">{getLinkedValue(notes, "Procedimento vinculado:")}</td>
                        <td className="px-3 py-3">{getLinkedValue(notes, "CID vinculado:")}</td>
                        <td className="px-3 py-3">
                          <p className="max-w-[260px] whitespace-pre-wrap text-muted-foreground">{getPlainNotes(notes)}</p>
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
                            <Button type="button" variant="outline" size="icon" className="bg-transparent" title="Alterar status" onClick={() => openStatusForm(item)}>
                              <CheckCheck className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="bg-transparent"
                              title={item.active === false ? "Reativar" : "Inativar"}
                              disabled={savingAction}
                              onClick={() => {
                                if (item.active === false) {
                                  void updateFichaAction("reativar", item.id)
                                  return
                                }
                                const reason = window.prompt(`Informe o motivo para inativar a ficha ${item.number || item.id}:`, "Ficha substituída ou cadastro incorreto")
                                if (reason !== null) void updateFichaAction("inativar", item.id, { reason })
                              }}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="icon" className="bg-transparent" title="Excluir" disabled={savingAction} onClick={() => deleteFicha(item)}>
                              <Trash2 className="h-4 w-4" />
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

          {statusFichaId && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Alterar status da ficha</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setStatusFichaId("")}>
                  <X className="mr-2 h-4 w-4" /> Fechar
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div>
                  <Label className="mb-1 block text-xs">Status</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={fichaStatus}
                    onChange={(e) => setFichaStatus(e.target.value as JudicialFichaStatus)}
                  >
                    {FICHA_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {JUDICIAL_FICHA_STATUS_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Justificativa</Label>
                  <Input value={fichaStatusReason} onChange={(e) => setFichaStatusReason(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={savingAction}
                  onClick={() => updateFichaAction("status", statusFichaId, { status: fichaStatus, reason: fichaStatusReason })}
                >
                  Salvar status
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
