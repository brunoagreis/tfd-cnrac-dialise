"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import type { Paciente } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

function normalizeUpper(value: string) {
  return value.toUpperCase()
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

  const [municipios, setMunicipios] = useState<string[]>([])
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

      setMunicipios(Array.isArray(json?.municipios) ? json.municipios : [])
      setProcedureCatalog(Array.isArray(json?.sigtap) ? json.sigtap : [])
      setCidCatalog(Array.isArray(json?.cid10) ? json.cid10 : [])
      setEspecialidadeSubItems(Array.isArray(json?.especialidades) ? json.especialidades : [])
    } catch (error) {
      console.error("LOAD_JUDICIAL_CATALOGS_ERROR", error)
      toast.error("Erro ao carregar catálogos do Judicial.")
    } finally {
      setLoadingCatalogs(false)
    }
  }

  useEffect(() => {
    if (especialidadeSubItems.length === 0) return

    setProcedureCatalog((prev) =>
      prev.map((item) => {
        const found = especialidadeSubItems.find(
          (row) =>
            normalizeUpper(row.especialidadeNome) === normalizeUpper(item.specialty) &&
            normalizeUpper(row.subespecialidadeNome) === normalizeUpper(item.subSpecialty),
        )

        if (found) return item

        return item
      }),
    )
  }, [especialidadeSubItems])

  async function handleSubmit() {
    if (!user) return

    if (
      !oficioNumber.trim() ||
      !receivedAt ||
      !actionRecords.trim() ||
      !pgeNetNumber.trim() ||
      !deadlineDays ||
      !municipalityName
    ) {
      toast.error("Preencha os campos obrigatórios do Judicial.")
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
        !item.specialty ||
        !item.subSpecialty,
    )

    if (invalidProcedure) {
      toast.error("Todos os procedimentos devem ter SIGTAP, descrição, especialidade e subespecialidade.")
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
            <Label className="mb-1 block text-xs">Número do ofício ou intimação *</Label>
            <Input
              value={oficioNumber}
              onChange={(e) => setOficioNumber(normalizeUpper(e.target.value))}
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
            <Label className="mb-1 block text-xs">Município envolvido *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={municipalityName}
              onChange={(e) => setMunicipalityName(e.target.value)}
              disabled={loadingCatalogs}
            >
              <option value="">
                {loadingCatalogs ? "Carregando..." : "Selecione"}
              </option>
              {municipios.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
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
      </Card>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        Campos obrigatórios: número do ofício/intimação, data do recebimento, autos da ação, número do PGE.net, prazo em dias, município envolvido, ao menos 1 procedimento e ao menos 1 CID. A data da reiteração não é obrigatória.
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