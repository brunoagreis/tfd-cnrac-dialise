"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Settings2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type PriorityMode = "procedure" | "cid" | "combined"
type FocusMode = PriorityMode | "none"

type PriorityFocusItem = {
  id: string
  mode: PriorityMode
  value: string
  label: string
  expiresAt?: string
  createdAt?: string
}

type EspecialidadeSubItem = {
  especialidadeNome: string
  subespecialidadeNome: string
}

type CombinedCriteria = {
  cid: string
  procedure: string
  specialty: string
  subspecialty: string
}

function makeUiId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeProcedureCode(value: string) {
  return String(value ?? "").replace(/\D/g, "")
}

function normalizeCidCode(value: string) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

function formatCidCode(value: string) {
  const normalized = normalizeCidCode(value).slice(0, 6)
  if (!normalized) return ""
  if (normalized.length <= 3) return normalized
  return `${normalized.slice(0, 3)}.${normalized.slice(3)}`
}

function normalizeName(value: string) {
  return String(value ?? "").trim().toUpperCase()
}

function countCriteria(criteria: CombinedCriteria) {
  return [criteria.cid, criteria.procedure, criteria.specialty, criteria.subspecialty].filter(Boolean).length
}

function buildCombinedLabel(criteria: CombinedCriteria) {
  return [
    criteria.cid ? `CID ${criteria.cid}` : "",
    criteria.procedure ? `SIGTAP ${criteria.procedure}` : "",
    criteria.specialty,
    criteria.subspecialty,
  ]
    .filter(Boolean)
    .join(" + ")
}

function parseCombinedValue(value: string): CombinedCriteria {
  try {
    const parsed = JSON.parse(value || "{}") as Partial<CombinedCriteria>

    return {
      cid: normalizeCidCode(String(parsed.cid ?? "")),
      procedure: normalizeProcedureCode(String(parsed.procedure ?? "")),
      specialty: normalizeName(String(parsed.specialty ?? "")),
      subspecialty: normalizeName(String(parsed.subspecialty ?? "")),
    }
  } catch {
    return { cid: "", procedure: "", specialty: "", subspecialty: "" }
  }
}

function isPriorityItemActive(item: PriorityFocusItem) {
  if (!item.expiresAt) return true
  const expiresAt = new Date(`${item.expiresAt}T23:59:59.999`)
  return expiresAt >= new Date()
}

function badgeText(mode: PriorityMode) {
  if (mode === "procedure") return "Procedimento"
  if (mode === "cid") return "CID"
  return "Combinada"
}

function describePriorityItem(item: PriorityFocusItem) {
  const prefix =
    item.mode === "procedure"
      ? "Procedimento"
      : item.mode === "cid"
        ? "CID"
        : "Combinação"

  const base = `${prefix} ${item.label}`

  return item.expiresAt
    ? `${base} • até ${new Date(`${item.expiresAt}T00:00:00`).toLocaleDateString("pt-BR")}`
    : `${base} • sem prazo final`
}

function upsertPriorityItem(prev: PriorityFocusItem[], nextItem: PriorityFocusItem) {
  const existingIndex = prev.findIndex((entry) => {
    if (entry.mode !== nextItem.mode) return false
    if (entry.mode === "procedure") return normalizeProcedureCode(entry.value) === normalizeProcedureCode(nextItem.value)
    if (entry.mode === "cid") return normalizeCidCode(entry.value) === normalizeCidCode(nextItem.value)
    return entry.value === nextItem.value
  })

  if (existingIndex < 0) return [...prev, nextItem]

  const next = [...prev]
  next[existingIndex] = { ...next[existingIndex], ...nextItem, id: next[existingIndex].id }
  return next
}

export function JudicialPrioritiesPanel() {
  const [focusMode, setFocusMode] = useState<FocusMode>("procedure")
  const [priorityProcedureQuery, setPriorityProcedureQuery] = useState("")
  const [priorityCidQuery, setPriorityCidQuery] = useState("")
  const [priorityExpiresAt, setPriorityExpiresAt] = useState("")
  const [focusItems, setFocusItems] = useState<PriorityFocusItem[]>([])
  const [loadingPriorities, setLoadingPriorities] = useState(false)
  const [savingPriorities, setSavingPriorities] = useState(false)
  const [especialidadeSubItems, setEspecialidadeSubItems] = useState<EspecialidadeSubItem[]>([])

  const [priorityCombinedCid, setPriorityCombinedCid] = useState("")
  const [priorityCombinedProcedure, setPriorityCombinedProcedure] = useState("")
  const [priorityCombinedSpecialty, setPriorityCombinedSpecialty] = useState("")
  const [priorityCombinedSubspecialty, setPriorityCombinedSubspecialty] = useState("")

  const specialtyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          especialidadeSubItems
            .map((item) => normalizeName(item.especialidadeNome))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [especialidadeSubItems],
  )

  const combinedSubspecialtyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          especialidadeSubItems
            .filter(
              (item) =>
                !priorityCombinedSpecialty ||
                normalizeName(item.especialidadeNome) === priorityCombinedSpecialty,
            )
            .map((item) => normalizeName(item.subespecialidadeNome))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [especialidadeSubItems, priorityCombinedSpecialty],
  )

  useEffect(() => {
    void fetchPriorityFocus()
    void fetchEspecialidadeSub()
  }, [])

  async function fetchPriorityFocus() {
    try {
      setLoadingPriorities(true)

      const response = await fetch(
        "/api/admin/judicial/prioridades?tipoPrioridade=monitoramento",
        { method: "GET", cache: "no-store" },
      )
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar prioridades.")
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []
      setFocusItems(items)

      const lastMode = items[items.length - 1]?.mode
      if (lastMode === "procedure" || lastMode === "cid" || lastMode === "combined") {
        setFocusMode(lastMode)
      }
    } catch (error) {
      console.error("LOAD_PRIORIDADES_ERROR", error)
      toast.error("Erro ao carregar prioridades.")
    } finally {
      setLoadingPriorities(false)
    }
  }

  async function fetchEspecialidadeSub() {
    try {
      const response = await fetch("/api/admin/judicial/especialidades", {
        method: "GET",
        cache: "no-store",
      })
      const json = await response.json().catch(() => ({}))

      setEspecialidadeSubItems(response.ok && json?.ok && Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_ESPECIALIDADE_SUB_ERROR", error)
      setEspecialidadeSubItems([])
    }
  }

  function addManualProcedurePriority() {
    const code = normalizeProcedureCode(priorityProcedureQuery)

    if (!code) {
      toast.error("Informe o procedimento SIGTAP.")
      return
    }

    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "procedure",
      value: code,
      label: `${code} - PROCEDIMENTO PRIORITÁRIO`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => upsertPriorityItem(prev, nextItem))
    setPriorityProcedureQuery("")
    setPriorityExpiresAt("")
    toast.success("Procedimento adicionado à lista de prioridade.")
  }

  function addManualCidPriority() {
    const code = formatCidCode(priorityCidQuery)

    if (!code) {
      toast.error("Informe o CID.")
      return
    }

    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "cid",
      value: code,
      label: `${code} - CID prioritário`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => upsertPriorityItem(prev, nextItem))
    setPriorityCidQuery("")
    setPriorityExpiresAt("")
    toast.success("CID adicionado à lista de prioridade.")
  }

  function addCombinedPriority() {
    const criteria: CombinedCriteria = {
      cid: normalizeCidCode(priorityCombinedCid),
      procedure: normalizeProcedureCode(priorityCombinedProcedure),
      specialty: normalizeName(priorityCombinedSpecialty),
      subspecialty: normalizeName(priorityCombinedSubspecialty),
    }

    if (countCriteria(criteria) < 2) {
      toast.error("Informe pelo menos dois critérios para criar uma prioridade combinada.")
      return
    }

    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "combined",
      value: JSON.stringify(criteria),
      label: buildCombinedLabel(criteria),
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => upsertPriorityItem(prev, nextItem))
    setPriorityCombinedCid("")
    setPriorityCombinedProcedure("")
    setPriorityCombinedSpecialty("")
    setPriorityCombinedSubspecialty("")
    setPriorityExpiresAt("")
    toast.success("Combinação adicionada à lista de prioridade.")
  }

  function removePriorityItem(itemId: string) {
    setFocusItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  async function applyPriorityFocus() {
    if (focusItems.length === 0) {
      toast.error("Adicione pelo menos um procedimento, CID ou combinação antes de aplicar.")
      return
    }

    try {
      setSavingPriorities(true)

      const response = await fetch("/api/admin/judicial/prioridades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoPrioridade: "monitoramento", items: focusItems }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao salvar prioridades.")
        return
      }

      setFocusItems(Array.isArray(json?.items) ? json.items : [])
      toast.success("Lista de prioridades do monitoramento atualizada.")
    } catch (error) {
      console.error("SAVE_PRIORIDADES_ERROR", error)
      toast.error("Erro ao salvar prioridades.")
    } finally {
      setSavingPriorities(false)
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Prioridades do monitoramento</CardTitle>
        <CardDescription>
          Adicione procedimentos, CIDs ou combinações. Na prioridade combinada, todos os campos preenchidos precisam bater; campos vazios são ignorados.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1 block text-xs">Tipo de prioridade</Label>
          <select
            value={focusMode}
            onChange={(e) => setFocusMode(e.target.value as FocusMode)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="procedure">Priorizar por procedimento</option>
            <option value="cid">Priorizar por CID</option>
            <option value="combined">Prioridade combinada</option>
            <option value="none">Somente visualizar lista</option>
          </select>
        </div>

        {focusMode === "procedure" && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <Label className="mb-1 block text-xs">Procedimento SIGTAP</Label>
              <Input
                value={priorityProcedureQuery}
                onChange={(e) => setPriorityProcedureQuery(normalizeProcedureCode(e.target.value))}
                placeholder="0000000000"
              />
            </div>
            <PriorityExpiresInput value={priorityExpiresAt} onChange={setPriorityExpiresAt} />
            <Button type="button" variant="outline" onClick={addManualProcedurePriority}>
              Adicionar procedimento à lista
            </Button>
          </div>
        )}

        {focusMode === "cid" && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <Label className="mb-1 block text-xs">CID</Label>
              <Input
                value={priorityCidQuery}
                onChange={(e) => setPriorityCidQuery(formatCidCode(e.target.value))}
                placeholder="A00.0"
              />
            </div>
            <PriorityExpiresInput value={priorityExpiresAt} onChange={setPriorityExpiresAt} />
            <Button type="button" variant="outline" onClick={addManualCidPriority}>
              Adicionar CID à lista
            </Button>
          </div>
        )}

        {focusMode === "combined" && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              Preencha pelo menos dois critérios. Exemplo: CID + SIGTAP exige que os dois batam. SIGTAP + especialidade + subespecialidade exige que os três batam.
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">CID</Label>
                <Input
                  value={priorityCombinedCid}
                  onChange={(e) => setPriorityCombinedCid(formatCidCode(e.target.value))}
                  placeholder="M16.0"
                />
              </div>

              <div>
                <Label className="mb-1 block text-xs">Procedimento SIGTAP</Label>
                <Input
                  value={priorityCombinedProcedure}
                  onChange={(e) => setPriorityCombinedProcedure(normalizeProcedureCode(e.target.value))}
                  placeholder="0302050043"
                />
              </div>

              <div>
                <Label className="mb-1 block text-xs">Especialidade</Label>
                <select
                  value={priorityCombinedSpecialty}
                  onChange={(e) => {
                    setPriorityCombinedSpecialty(normalizeName(e.target.value))
                    setPriorityCombinedSubspecialty("")
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Ignorar especialidade</option>
                  {specialtyOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="mb-1 block text-xs">Subespecialidade</Label>
                <select
                  value={priorityCombinedSubspecialty}
                  onChange={(e) => setPriorityCombinedSubspecialty(normalizeName(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Ignorar subespecialidade</option>
                  {combinedSubspecialtyOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>

            <PriorityExpiresInput value={priorityExpiresAt} onChange={setPriorityExpiresAt} />
            <Button type="button" variant="outline" onClick={addCombinedPriority}>
              Adicionar combinação à lista
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Itens priorizados</Label>
            <Badge variant="outline">{focusItems.length}</Badge>
          </div>

          {loadingPriorities ? (
            <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">Carregando prioridades...</div>
          ) : focusItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum procedimento, CID ou combinação incluído na lista.</p>
          ) : (
            focusItems.map((item) => {
              const criteria = item.mode === "combined" ? parseCombinedValue(item.value) : null

              return (
                <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.mode === "procedure" ? "default" : item.mode === "cid" ? "secondary" : "outline"}>
                        {badgeText(item.mode)}
                      </Badge>
                      {criteria ? <Badge variant="outline">{countCriteria(criteria)} critérios</Badge> : null}
                      {!isPriorityItemActive(item) && <Badge variant="destructive">Expirado</Badge>}
                    </div>

                    <p className="mt-2 text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{describePriorityItem(item)}</p>
                  </div>

                  <Button type="button" variant="outline" className="bg-transparent" onClick={() => removePriorityItem(item.id)}>
                    Remover
                  </Button>
                </div>
              )
            })
          )}
        </div>

        <Button onClick={applyPriorityFocus} disabled={savingPriorities}>
          <Settings2 className="mr-2 h-4 w-4" />
          {savingPriorities ? "Salvando..." : "Aplicar prioridades"}
        </Button>
      </CardContent>
    </Card>
  )
}

function PriorityExpiresInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs">Vigente até</Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
