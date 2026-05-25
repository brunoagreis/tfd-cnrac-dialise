"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  JUDICIAL_DECISION_DEADLINE_UNIT_LABELS,
  JUDICIAL_FINALIZATION_STATUS_LABELS,
  JUDICIAL_PENDING_LOCATION_LABELS,
  JUDICIAL_PROCESS_LIFECYCLE_LABELS,
  type JudicialDecisionDeadlineUnit,
  type JudicialFinalizationStatus,
  type JudicialPendingLocation,
  type JudicialProcessLifecycleStatus,
} from "@/lib/judicial-types"

const FINALIZATION_OPTIONS: JudicialFinalizationStatus[] = [
  "pendente",
  "resolvido",
  "bloqueio",
  "sequestro",
  "obito",
  "devolvida",
]

export function JudicialGovernancePanel({ caseId }: { caseId: string }) {
  const { user } = useAuth()
  const judicial = useJudicial()
  const caseItem = judicial.getCaseById(caseId)

  const [linkedProcessInput, setLinkedProcessInput] = useState("")
  const [processLifecycleStatus, setProcessLifecycleStatus] = useState<JudicialProcessLifecycleStatus>(caseItem?.processLifecycleStatus ?? "em_andamento")
  const [decisionDeadlineUnit, setDecisionDeadlineUnit] = useState<JudicialDecisionDeadlineUnit>(caseItem?.decisionDeadlineUnit ?? "dias")
  const [decisionDeadlineValue, setDecisionDeadlineValue] = useState(caseItem?.decisionDeadlineValue ? String(caseItem.decisionDeadlineValue) : "")
  const [processLifecycleNote, setProcessLifecycleNote] = useState(caseItem?.processLifecycleNote ?? "")

  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [finalizeStatus, setFinalizeStatus] = useState<JudicialFinalizationStatus>("resolvido")
  const [finalizeReason, setFinalizeReason] = useState("")
  const [pendingLocation, setPendingLocation] = useState<JudicialPendingLocation>("ses")

  const linkedProcesses = useMemo(
    () => (caseItem?.linkedProcesses?.length ? caseItem.linkedProcesses : caseItem?.processNumber ? [caseItem.processNumber] : []),
    [caseItem?.linkedProcesses, caseItem?.processNumber],
  )

  if (!caseItem) return null

  function handleSaveProcessStatus() {
    if (!user) return
    if (processLifecycleStatus === "decisao_judicial_com_prazo") {
      const numeric = Number(decisionDeadlineValue)
      if (!numeric || numeric <= 0) {
        toast.error("Informe o prazo da decisão judicial.")
        return
      }
      judicial.updateProcessLifecycle(caseItem.id, {
        status: processLifecycleStatus,
        deadlineUnit: decisionDeadlineUnit,
        deadlineValue: numeric,
        note: processLifecycleNote.trim() || undefined,
        user,
      })
    } else {
      judicial.updateProcessLifecycle(caseItem.id, {
        status: processLifecycleStatus,
        note: processLifecycleNote.trim() || undefined,
        user,
      })
    }
    toast.success("Status do processo atualizado.")
  }

  function handleAddLinkedProcess() {
    if (!user) return
    if (!linkedProcessInput.trim()) {
      toast.error("Informe o número do processo para vincular ao PGE.net.")
      return
    }
    judicial.addLinkedProcess(caseItem.id, linkedProcessInput, user)
    setLinkedProcessInput("")
    toast.success("Processo vinculado ao PGE.net.")
  }

  function handleFinalize() {
    if (!user) return
    if (finalizeStatus === "pendente" && !pendingLocation) {
      toast.error("Selecione onde a demanda está pendente.")
      return
    }
    if (finalizeStatus === "devolvida" && !finalizeReason.trim()) {
      toast.error("Justifique a devolução da demanda.")
      return
    }
    if (["bloqueio", "sequestro", "obito"].includes(finalizeStatus) && !finalizeReason.trim()) {
      toast.error("Informe a justificativa da finalização.")
      return
    }

    judicial.finalizeCase(caseItem.id, {
      status: finalizeStatus,
      reason: finalizeReason.trim() || undefined,
      pendingLocation: finalizeStatus === "pendente" ? pendingLocation : undefined,
      user,
    })
    setFinalizeOpen(false)
    setFinalizeReason("")
    toast.success("Demanda finalizada e movida para encerrados.")
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status do processo judicial</CardTitle>
          <CardDescription>
            Sinaliza se o processo está em andamento, descumprido ou com decisão judicial com prazo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {JUDICIAL_PROCESS_LIFECYCLE_LABELS[caseItem.processLifecycleStatus ?? "em_andamento"]}
            </Badge>
            {caseItem.decisionDeadlineValue && caseItem.decisionDeadlineUnit && (
              <Badge variant="secondary">
                Prazo: {caseItem.decisionDeadlineValue} {JUDICIAL_DECISION_DEADLINE_UNIT_LABELS[caseItem.decisionDeadlineUnit]}
              </Badge>
            )}
            {caseItem.decisionDeadlineTargetAt && (
              <Badge variant="secondary">
                Limite: {new Date(caseItem.decisionDeadlineTargetAt).toLocaleString("pt-BR")}
              </Badge>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={processLifecycleStatus}
                onChange={(e) => setProcessLifecycleStatus(e.target.value as JudicialProcessLifecycleStatus)}
              >
                {Object.entries(JUDICIAL_PROCESS_LIFECYCLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {processLifecycleStatus === "decisao_judicial_com_prazo" && (
              <>
                <div>
                  <Label className="mb-1 block text-xs">Prazo</Label>
                  <Input
                    type="number"
                    min="1"
                    value={decisionDeadlineValue}
                    onChange={(e) => setDecisionDeadlineValue(e.target.value)}
                    placeholder="Ex.: 48"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Unidade</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={decisionDeadlineUnit}
                    onChange={(e) => setDecisionDeadlineUnit(e.target.value as JudicialDecisionDeadlineUnit)}
                  >
                    <option value="dias">Dias</option>
                    <option value="horas">Horas</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div>
            <Label className="mb-1 block text-xs">Observação</Label>
            <Textarea rows={3} value={processLifecycleNote} onChange={(e) => setProcessLifecycleNote(e.target.value)} />
          </div>

          <Button onClick={handleSaveProcessStatus}>Salvar status do processo</Button>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">PGE.net e processos vinculados</CardTitle>
          <CardDescription>
            Permite vincular mais de um processo ao mesmo PGE.net.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
            <p>
              <span className="font-semibold text-foreground">PGE.net:</span>{" "}
              {caseItem.registration?.pgeNetNumber || "Não informado"}
            </p>
          </div>

          <div className="space-y-2">
            {linkedProcesses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum processo vinculado.</p>
            ) : (
              linkedProcesses.map((process) => (
                <div key={process} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                  <span>{process}</span>
                  {linkedProcesses.length > 1 && user && (
                    <Button variant="outline" size="sm" className="bg-transparent" onClick={() => judicial.removeLinkedProcess(caseItem.id, process, user)}>
                      Remover
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Input value={linkedProcessInput} onChange={(e) => setLinkedProcessInput(e.target.value)} placeholder="Novo número de processo" />
            <Button onClick={handleAddLinkedProcess}>Vincular</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border xl:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Finalizar demanda</CardTitle>
          <CardDescription>
            As finalizações retiram o paciente da fila ativa e enviam a demanda para encerrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {caseItem.finalizationStatus ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-3 text-sm">
              <Badge variant="secondary">{JUDICIAL_FINALIZATION_STATUS_LABELS[caseItem.finalizationStatus]}</Badge>
              {caseItem.finalizationPendingLocation && (
                <Badge variant="outline">{JUDICIAL_PENDING_LOCATION_LABELS[caseItem.finalizationPendingLocation]}</Badge>
              )}
              {caseItem.finalizationReason && <span className="text-muted-foreground">{caseItem.finalizationReason}</span>}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {FINALIZATION_OPTIONS.map((status) => (
              <Button
                key={status}
                type="button"
                variant="outline"
                className="bg-transparent"
                onClick={() => {
                  setFinalizeStatus(status)
                  setFinalizeReason("")
                  setPendingLocation("ses")
                  setFinalizeOpen(true)
                }}
              >
                {JUDICIAL_FINALIZATION_STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar demanda</DialogTitle>
            <DialogDescription>
              {JUDICIAL_FINALIZATION_STATUS_LABELS[finalizeStatus]}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {finalizeStatus === "pendente" && (
              <div>
                <Label className="mb-1 block text-xs">Onde está pendente?</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={pendingLocation}
                  onChange={(e) => setPendingLocation(e.target.value as JudicialPendingLocation)}
                >
                  {Object.entries(JUDICIAL_PENDING_LOCATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label className="mb-1 block text-xs">
                {finalizeStatus === "devolvida" ? "Justificativa da devolução" : "Justificativa"}
              </Label>
              <Textarea rows={4} value={finalizeReason} onChange={(e) => setFinalizeReason(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setFinalizeOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleFinalize}>Confirmar finalização</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
