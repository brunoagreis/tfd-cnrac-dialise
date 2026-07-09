"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import type { Paciente } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MunicipalitySelectField } from "@/components/paciente/municipality-select-field"
import {
  ProcedureMultiEntry,
  type ProcedureCatalogItem,
  type ProcedureEntry,
} from "@/components/paciente/procedure-multi-entry"
import {
  CidMultiEntry,
  type CidCatalogItem,
  type CidEntry,
} from "@/components/paciente/cid-multi-entry"

type EspecialidadeSubItem = {
  especialidadeId: string
  especialidadeNome: string
  subespecialidadeId: string
  subespecialidadeNome: string
}

function calculateDeadlineAt(receivedAt: string, deadlineDays: number) {
  if (!receivedAt || !deadlineDays || Number.isNaN(deadlineDays)) return ""
  const d = new Date(`${receivedAt}T00:00:00`)
  d.setDate(d.getDate() + deadlineDays)
  return d.toISOString().slice(0, 10)
}

function normalizeUpper(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase()
}

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

  const [loadingCatalogs, setLoadingCatalogs] = useState(true)
  const [saving, setSaving] = useState(false)

  const [monitorarHoje, setMonitorarHoje] = useState(false)
  const [procedureCatalog, setProcedureCatalog] = useState<ProcedureCatalogItem[]>([])
  const [cidCatalog, setCidCatalog] = useState<CidCatalogItem[]>([])
  const [especialidadeSubItems, setEspecialidadeSubItems] = useState<EspecialidadeSubItem[]>([])

  const [isIntimation, setIsIntimation] = useState<"sim" | "nao">("sim")
  const [oficioNumber, setOficioNumber] = useState("")
  const [receivedAt, setReceivedAt] = useState("")
  const [reiterationAt, setReiterationAt] = useState("")
  const [actionRecords, setActionRecords] = useState("")
  const [pgeNetNumber, setPgeNetNumber] = useState("")
  const [deadlineDays, setDeadlineDays] = useState("")
  const [municipalityName, setMunicipalityName] = useState("")
  const [procedures, setProcedures] = useState<ProcedureEntry[]>([])
  const [cids, setCids] = useState<CidEntry[]>([])

  const oficioRequired = isIntimation === "sim"

  const deadlineAt = useMemo(
    () => calculateDeadlineAt(receivedAt, Number(deadlineDays || 0)),
    [receivedAt, deadlineDays],
  )

  useEffect(() => {
    void fetchCatalogs()
  }, [])

  async function fetchCatalogs() {
    try {
      setLoadingCatalogs(true)

      const response = await fetch("/api/judicial/cadastro", {
        method: "GET",
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar catálogos do Judicial.")
        return
      }

      setProcedureCatalog(
        Array.isArray(json?.sigtap)
          ? json.sigtap.map((item: Record<string, unknown>) => ({
              sigtapCode: String(item?.sigtapCode ?? ""),
              description: normalizeUpper(item?.description),
              specialty: normalizeUpper(item?.specialty),
              subSpecialty: normalizeUpper(item?.subSpecialty),
            }))
          : [],
      )
      setCidCatalog(
        Array.isArray(json?.cid10)
          ? json.cid10.map((item: Record<string, unknown>) => ({
              code: normalizeUpper(item?.code),
              description: normalizeUpper(item?.description),
            }))
          : [],
      )
      setEspecialidadeSubItems(
        Array.isArray(json?.especialidades)
          ? json.especialidades.map((item: Record<string, unknown>) => ({
              especialidadeId: String(item?.especialidadeId ?? ""),
              especialidadeNome: normalizeUpper(item?.especialidadeNome),
              subespecialidadeId: String(item?.subespecialidadeId ?? ""),
              subespecialidadeNome: normalizeUpper(item?.subespecialidadeNome),
            }))
          : [],
      )
    } catch (error) {
      console.error("LOAD_JUDICIAL_CATALOGS_ERROR", error)
      toast.error("Erro ao carregar catálogos do Judicial.")
    } finally {
      setLoadingCatalogs(false)
    }
  }

  async function handleSubmit() {
    if (!user) return

    const missingFields: string[] = []

    if (oficioRequired && !oficioNumber.trim()) missingFields.push("Número do ofício/intimação")
    if (!receivedAt) missingFields.push("Data do recebimento")
    if (!actionRecords.trim()) missingFields.push("Autos da ação")
    if (!pgeNetNumber.trim()) missingFields.push("Número do PGE.net")
    if (!deadlineDays) missingFields.push("Prazo em dias")
    if (!municipalityName.trim()) missingFields.push("Município envolvido")

    if (missingFields.length > 0) {
      toast.error(`Preencha: ${missingFields.join(", ")}.`)
      return
    }

    if (procedures.length === 0) {
      toast.error("Informe ao menos 1 procedimento.")
      return
    }

    if (cids.length === 0) {
      toast.error("Informe ao menos 1 CID.")
      return
    }

    const invalidProcedure = procedures.find(
      (item) =>
        !item.sigtapCode ||
        !item.description ||
        !item.specialty,
    )

    if (invalidProcedure) {
      toast.error("Todos os procedimentos devem ter SIGTAP, descrição e especialidade.")
      return
    }

    const invalidCid = cids.find((item) => !item.code || !item.description)

    if (invalidCid) {
      toast.error("Todos os CIDs devem ter código e descrição.")
      return
    }

    try {
      setSaving(true)

      const response = await fetch("/api/judicial/cadastro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: patient.id,
          isIntimation,
          oficioNumber,
          receivedAt,
          reiterationAt,
          actionRecords,
          pgeNetNumber,
          deadlineDays: Number(deadlineDays),
          deadlineAt,
          municipalityName,
          procedures,
          cids,
          criadoPor: user.id,
          criadoPorNome: user.nome,
          criadoPorEmail: (user as { email?: string }).email ?? "",
          monitorarHoje,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao salvar cadastro Judicial.")
        return
      }

      toast.success(`Judicial ${json?.item?.protocolo ?? ""} cadastrado com sucesso.`)
      onSaved()
    } catch (error) {
      console.error("SAVE_JUDICIAL_DEMANDA_ERROR", error)
      toast.error("Erro ao salvar cadastro Judicial.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastro Judicial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs">É intimação? *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={isIntimation}
              onChange={(e) => setIsIntimation(e.target.value as "sim" | "nao")}
            >
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>

          <div>
            <Label className="mb-1 block text-xs">
              Número do ofício ou intimação{oficioRequired ? " *" : ""}
            </Label>
            <Input
              value={oficioNumber}
              onChange={(e) => setOficioNumber(normalizeUpper(e.target.value))}
              placeholder={oficioRequired ? "Obrigatório quando for intimação" : "Opcional quando não for intimação"}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Data do recebimento *</Label>
            <Input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Data da reiteração</Label>
            <Input
              type="date"
              value={reiterationAt}
              onChange={(e) => setReiterationAt(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Autos da ação *</Label>
            <Input
              value={actionRecords}
              onChange={(e) => setActionRecords(normalizeUpper(e.target.value))}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Número do PGE.net *</Label>
            <Input
              value={pgeNetNumber}
              onChange={(e) => setPgeNetNumber(normalizeUpper(e.target.value))}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Prazo (em dias) *</Label>
            <Input
              type="number"
              min="1"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Prazo final</Label>
            <Input value={deadlineAt} readOnly />
          </div>

          <div className="md:col-span-2">
            <MunicipalitySelectField
              value={municipalityName}
              onChange={setMunicipalityName}
              label="Município envolvido *"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Procedimentos *</CardTitle>
        </CardHeader>
        <CardContent>
          <ProcedureMultiEntry
            catalog={procedureCatalog}
            value={procedures}
            onChange={setProcedures}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CID *</CardTitle>
        </CardHeader>
        <CardContent>
          <CidMultiEntry
            catalog={cidCatalog}
            value={cids}
            onChange={setCids}
          />
        </CardContent>
      </Card>      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-950">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border"
            checked={monitorarHoje}
            disabled={saving}
            onChange={(event) => setMonitorarHoje(event.target.checked)}
          />
          <span>
            <span className="font-semibold">Monitorar hoje</span>
            <span className="block text-xs text-blue-900">
              Ao marcar, o paciente entra no monitoramento de hoje do usuário que criou a demanda judicial.
            </span>
          </span>
        </label>
      </div>



      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        Campos obrigatórios: data do recebimento, autos da ação, número do PGE.net, prazo em dias, município envolvido, ao menos 1 procedimento e ao menos 1 CID. O número do ofício/intimação só é obrigatório quando “É intimação?” for Sim. A data da reiteração não é obrigatória.
      </div>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
          Voltar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={saving || loadingCatalogs}>
          {saving ? "Salvando..." : "Salvar Judicial"}
        </Button>
      </div>
    </div>
  )
}
