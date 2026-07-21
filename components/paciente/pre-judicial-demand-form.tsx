"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
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
import {
  ProcedureMultiEntry,
  type ProcedureEntry,
} from "@/components/paciente/procedure-multi-entry"
import {
  CidMultiEntry,
  type CidEntry,
} from "@/components/paciente/cid-multi-entry"

function normalizeMunicipalitySearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
}

export function PreJudicialDemandForm({
  patient,
  onBack,
  onSaved,
}: {
  patient: Paciente
  onBack: () => void
  onSaved: () => void
}) {
  const { user } = useAuth()

  const [receivedAt, setReceivedAt] = useState("")
  const [actionRecords, setActionRecords] = useState("")
  const [pgeNetNumber, setPgeNetNumber] = useState("")
  const [deadlineDays, setDeadlineDays] = useState("")
  const [municipalityId, setMunicipalityId] = useState("")

  const [municipalitySearch, setMunicipalitySearch] = useState("")
  const [municipalitySearchOpen, setMunicipalitySearchOpen] = useState(false)
  const [procedures, setProcedures] = useState<ProcedureEntry[]>([])
  const [cids, setCids] = useState<CidEntry[]>([])
  const [saving, setSaving] = useState(false)

  const deadlineAt = useMemo(
    () => calculateDeadlineAt(receivedAt, Number(deadlineDays || 0)),
    [receivedAt, deadlineDays],
  )

  const municipality = MUNICIPALITY_OPTIONS.find(
    (item) => item.id === municipalityId,
  )

  const filteredMunicipalities = useMemo(() => {
    const q = normalizeMunicipalitySearch(municipalitySearch)

    return MUNICIPALITY_OPTIONS
      .filter((item) => {
        const label = normalizeMunicipalitySearch(municipalityLabel(item).replace("/undefined", ""))
        const name = normalizeMunicipalitySearch(item.name)
        const ibge = String(item.ibge ?? "")

        return !q || label.includes(q) || name.includes(q) || ibge.includes(q)
      })
      .slice(0, 79)
  }, [municipalitySearch])



  async function handleSubmit() {
    if (!user) {
      toast.error("Usuário não autenticado.")
      return
    }

    if (
      !receivedAt ||
      !actionRecords ||
      !pgeNetNumber ||
      !deadlineDays ||
      !municipalityId
    ) {
      toast.error("Preencha os campos obrigatórios do Pré Judicial.")
      return
    }

    if (Number(deadlineDays) <= 0) {
      toast.error("Informe um prazo válido em dias.")
      return
    }

    if (!deadlineAt) {
      toast.error("Não foi possível calcular o prazo final.")
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

    try {
      setSaving(true)

      const response = await fetch("/api/pre-judicial/casos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient,
          user,
          data: {
            receivedAt,
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
        }),
      })

      const result = await response.json()

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Erro ao salvar caso Pré Judicial.")
      }

      toast.success("Caso Pré Judicial cadastrado com sucesso.")
      onSaved()
    } catch (error) {
      console.error("[PreJudicialDemandForm] erro ao salvar:", error)

      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao salvar caso Pré Judicial.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastro Pré Judicial</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs">Data do recebimento</Label>
            <Input
              type="date"
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Autos da ação</Label>
            <Input
              value={actionRecords}
              onChange={(event) => setActionRecords(event.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Número do PGE.net</Label>
            <Input
              value={pgeNetNumber}
              onChange={(event) => setPgeNetNumber(event.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Prazo em dias</Label>
            <Input
              type="number"
              min="1"
              value={deadlineDays}
              onChange={(event) => setDeadlineDays(event.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Prazo final</Label>
            <Input value={deadlineAt} readOnly />
          </div>

          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs">Município envolvido</Label>

            <div className="relative">
              <Input
                value={municipalitySearch}
                onChange={(event) => {
                  setMunicipalitySearch(event.target.value)
                  setMunicipalityId("")
                  setMunicipalitySearchOpen(true)
                }}
                onFocus={() => setMunicipalitySearchOpen(true)}
                placeholder="Digite o município envolvido"
              />

              {municipalitySearchOpen ? (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-background p-1 shadow-lg">
                  {filteredMunicipalities.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum município de Mato Grosso do Sul localizado.
                    </p>
                  ) : (
                    filteredMunicipalities.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setMunicipalityId(item.id)
                          setMunicipalitySearch(municipalityLabel(item).replace("/undefined", ""))
                          setMunicipalitySearchOpen(false)
                        }}
                      >
                        <span className="font-medium">{municipalityLabel(item).replace("/undefined", "")}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Procedimentos</CardTitle>
        </CardHeader>

        <CardContent>
          <ProcedureMultiEntry
            catalog={PROCEDURE_CATALOG}
            value={procedures}
            onChange={setProcedures}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CID</CardTitle>
        </CardHeader>

        <CardContent>
          <CidMultiEntry
            catalog={CID_CATALOG}
            value={cids}
            onChange={setCids}
          />
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={saving}
        >
          Voltar
        </Button>

        <Button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Pré Judicial"}
        </Button>
      </div>
    </div>
  )
}
