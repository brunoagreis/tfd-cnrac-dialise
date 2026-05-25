
"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import type { Paciente } from "@/lib/types"
import {
  MUNICIPALITY_OPTIONS,
  PROCEDURE_CATALOG,
  CID_CATALOG,
  calculateDeadlineAt,
  municipalityLabel,
} from "@/lib/paciente-demand-catalogs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProcedureMultiEntry, type ProcedureEntry } from "@/components/paciente/procedure-multi-entry"
import { CidMultiEntry, type CidEntry } from "@/components/paciente/cid-multi-entry"

export function JudicialDemandForm({
  patient,
  onBack,
  onSaved,
}: {
  patient: Paciente
  onBack: () => void
  onSaved: () => void
}) {
  const { user } = useAuth()
  const judicial = useJudicial()

  const [isIntimation, setIsIntimation] = useState<"sim" | "nao">("sim")
  const [oficioNumber, setOficioNumber] = useState("")
  const [receivedAt, setReceivedAt] = useState("")
  const [reiterationAt, setReiterationAt] = useState("")
  const [actionRecords, setActionRecords] = useState("")
  const [pgeNetNumber, setPgeNetNumber] = useState("")
  const [deadlineDays, setDeadlineDays] = useState("")
  const [municipalityId, setMunicipalityId] = useState("")
  const [procedures, setProcedures] = useState<ProcedureEntry[]>([])
  const [cids, setCids] = useState<CidEntry[]>([])

  const deadlineAt = useMemo(
    () => calculateDeadlineAt(receivedAt, Number(deadlineDays || 0)),
    [receivedAt, deadlineDays],
  )

  const municipality = MUNICIPALITY_OPTIONS.find((item) => item.id === municipalityId)

  function handleSubmit() {
    if (!user) return
    if (!oficioNumber || !receivedAt || !actionRecords || !pgeNetNumber || !deadlineDays || !municipalityId) {
      toast.error("Preencha os campos obrigatórios do Judicial.")
      return
    }
    if (procedures.length === 0 && cids.length === 0) {
      toast.error("Informe ao menos 1 procedimento ou 1 CID.")
      return
    }
    if (!municipality) {
      toast.error("Selecione o município envolvido.")
      return
    }

    const caseId = judicial.createCaseFromPatient({
      patient,
      user,
      data: {
        isIntimation,
        oficioNumber,
        receivedAt,
        reiterationAt,
        actionRecords,
        pgeNetNumber,
        deadlineDays: Number(deadlineDays),
        deadlineAt,
        municipalityId: municipality.id,
        municipalityIbge: municipality.ibge,
        municipalityName: municipality.name,
        procedures,
        cids,
      },
    })

    toast.success("Caso judicial cadastrado com sucesso.")
    onSaved()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Cadastro Judicial</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs">É intimação?</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={isIntimation} onChange={(e) => setIsIntimation(e.target.value as "sim" | "nao") }>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Número do ofício ou intimação</Label>
            <Input value={oficioNumber} onChange={(e) => setOficioNumber(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Data do recebimento</Label>
            <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Data da reiteração</Label>
            <Input type="date" value={reiterationAt} onChange={(e) => setReiterationAt(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Autos da ação</Label>
            <Input value={actionRecords} onChange={(e) => setActionRecords(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Número do PGE.net</Label>
            <Input value={pgeNetNumber} onChange={(e) => setPgeNetNumber(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Prazo (em dias)</Label>
            <Input type="number" min="1" value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Prazo final</Label>
            <Input value={deadlineAt} readOnly />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs">Município envolvido</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)}>
              <option value="">Selecione</option>
              {MUNICIPALITY_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>{municipalityLabel(item)}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Procedimentos</CardTitle></CardHeader>
        <CardContent>
          <ProcedureMultiEntry catalog={PROCEDURE_CATALOG} value={procedures} onChange={setProcedures} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">CID</CardTitle></CardHeader>
        <CardContent>
          <CidMultiEntry catalog={CID_CATALOG} value={cids} onChange={setCids} />
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack}>Voltar</Button>
        <Button type="button" onClick={handleSubmit}>Salvar Judicial</Button>
      </div>
    </div>
  )
}
