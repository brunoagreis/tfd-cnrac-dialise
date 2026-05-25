"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
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
  JUDICIAL_PROCEDURE_COMPLETION_STATUS_LABELS,
  type JudicialProcedureCompletionStatus,
} from "@/lib/judicial-types"

const PROCEDURE_STATUS_OPTIONS: JudicialProcedureCompletionStatus[] = ["atendido", "regulado", "pendente"]

export function JudicialProcedureCidPanel({ caseId }: { caseId: string }) {
  const { user } = useAuth()
  const judicial = useJudicial()
  const caseItem = judicial.getCaseById(caseId)

  const [procedureSearch, setProcedureSearch] = useState("")
  const [selectedProcedure, setSelectedProcedure] = useState("")
  const [cidSearch, setCidSearch] = useState("")
  const [selectedCid, setSelectedCid] = useState("")

  const [procedureModalOpen, setProcedureModalOpen] = useState(false)
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null)
  const [procedureStatus, setProcedureStatus] = useState<JudicialProcedureCompletionStatus>("atendido")
  const [procedureReason, setProcedureReason] = useState("")

  const procedureOptions = useMemo(
    () => judicial.procedureCatalog.filter((item) => !procedureSearch || `${item.sigtapCode} ${item.description}`.toLowerCase().includes(procedureSearch.toLowerCase())),
    [judicial.procedureCatalog, procedureSearch],
  )

  const cidOptions = useMemo(
    () => judicial.cidCatalog.filter((item) => !cidSearch || `${item.code} ${item.description}`.toLowerCase().includes(cidSearch.toLowerCase())),
    [judicial.cidCatalog, cidSearch],
  )

  if (!caseItem) return null

  function handleAddProcedure() {
    if (!user) return
    const item = procedureOptions.find((option) => option.sigtapCode === selectedProcedure)
    if (!item) {
      toast.error("Selecione um procedimento.")
      return
    }
    judicial.addProcedure(caseItem.id, {
      sigtapCode: item.sigtapCode,
      description: item.description,
      specialty: item.specialty,
      subSpecialty: item.subSpecialty,
      user,
    })
    setSelectedProcedure("")
    setProcedureSearch("")
    toast.success("Procedimento adicionado.")
  }

  function handleAddCid() {
    if (!user) return
    const item = cidOptions.find((option) => option.code === selectedCid)
    if (!item) {
      toast.error("Selecione um CID.")
      return
    }
    judicial.addCid(caseItem.id, {
      code: item.code,
      description: item.description,
      user,
    })
    setSelectedCid("")
    setCidSearch("")
    toast.success("CID adicionado.")
  }

  function handleFinalizeProcedure() {
    if (!user || !selectedProcedureId) return
    if (!procedureReason.trim()) {
      toast.error("Justifique a finalização do procedimento.")
      return
    }
    judicial.finalizeProcedure(caseItem.id, selectedProcedureId, {
      status: procedureStatus,
      reason: procedureReason.trim(),
      user,
    })
    setProcedureModalOpen(false)
    setSelectedProcedureId(null)
    setProcedureReason("")
    toast.success("Procedimento finalizado.")
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Procedimentos SIGTAP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input value={procedureSearch} onChange={(e) => setProcedureSearch(e.target.value)} placeholder="Pesquisar procedimento por código ou descrição" />
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedProcedure} onChange={(e) => setSelectedProcedure(e.target.value)}>
            <option value="">Selecione um procedimento</option>
            {procedureOptions.map((item) => (
              <option key={item.sigtapCode} value={item.sigtapCode}>
                {item.sigtapCode} - {item.description}
              </option>
            ))}
          </select>
          <Button onClick={handleAddProcedure}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar procedimento
          </Button>

          <div className="space-y-2">
            {caseItem.procedures.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={item.active === false ? "outline" : "secondary"}>{item.active === false ? "Inativo" : "Ativo"}</Badge>
                      {item.completionStatus && <Badge variant="outline">{JUDICIAL_PROCEDURE_COMPLETION_STATUS_LABELS[item.completionStatus]}</Badge>}
                    </div>
                    <p className="mt-2 text-sm font-medium">{item.sigtapCode} - {item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.specialty || "Sem especialidade"}
                      {item.subSpecialty ? ` • ${item.subSpecialty}` : ""}
                      {` • ${item.createdByName}`}
                    </p>
                    {item.completionReason && <p className="mt-1 text-xs text-muted-foreground">Motivo: {item.completionReason}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="bg-transparent" onClick={() => user && judicial.toggleProcedure(caseItem.id, item.id, user)}>
                      {item.active === false ? "Ativar" : "Inativar"}
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-transparent"
                      onClick={() => {
                        setSelectedProcedureId(item.id)
                        setProcedureStatus(item.completionStatus ?? "atendido")
                        setProcedureReason(item.completionReason ?? "")
                        setProcedureModalOpen(true)
                      }}
                    >
                      Finalizar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">CID</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input value={cidSearch} onChange={(e) => setCidSearch(e.target.value)} placeholder="Pesquisar CID por código ou descrição" />
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedCid} onChange={(e) => setSelectedCid(e.target.value)}>
            <option value="">Selecione um CID</option>
            {cidOptions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} - {item.description}
              </option>
            ))}
          </select>
          <Button onClick={handleAddCid}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar CID
          </Button>

          <div className="space-y-2">
            {caseItem.cids.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">{item.code} - {item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.active === false ? "Inativo" : "Ativo"} • {item.createdByName}</p>
                </div>
                <Button variant="outline" className="bg-transparent" onClick={() => user && judicial.toggleCid(caseItem.id, item.id, user)}>
                  {item.active === false ? "Ativar" : "Inativar"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={procedureModalOpen} onOpenChange={setProcedureModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar procedimento SIGTAP</DialogTitle>
            <DialogDescription>
              Informe o status final e a justificativa do procedimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs">Status final</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={procedureStatus} onChange={(e) => setProcedureStatus(e.target.value as JudicialProcedureCompletionStatus)}>
                {PROCEDURE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {JUDICIAL_PROCEDURE_COMPLETION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Justificativa</Label>
              <Textarea rows={4} value={procedureReason} onChange={(e) => setProcedureReason(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setProcedureModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleFinalizeProcedure}>Salvar finalização</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
