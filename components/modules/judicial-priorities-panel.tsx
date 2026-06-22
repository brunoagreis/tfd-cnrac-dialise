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

type SigTapCadastroItem = {
  id: string
  codigo: string
  descricao: string
  ativo?: boolean
  updatedAt?: string
}

type CidCatalogItem = {
  code: string
  description: string
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
  return [
    criteria.cid,
    criteria.procedure,
    criteria.specialty,
    criteria.subspecialty,
  ].filter(Boolean).length
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

function sigtapLabel(item: SigTapCadastroItem) {
  return `${normalizeProcedureCode(item.codigo)} - ${item.descricao}`
}

function cidLabel(item: CidCatalogItem) {
  return `${item.code} - ${item.description}`
}

function upsertPriorityItem(prev: PriorityFocusItem[], nextItem: PriorityFocusItem) {
  const existingIndex = prev.findIndex((entry) => {
    if (entry.mode !== nextItem.mode) return false
    if (entry.mode === "procedure") {
      return normalizeProcedureCode(entry.value) === normalizeProcedureCode(nextItem.value)
    }
    if (entry.mode === "cid") {
      return normalizeCidCode(entry.value) === normalizeCidCode(nextItem.value)
    }
    return entry.value === nextItem.value
  })

  if (existingIndex < 0) return [...prev, nextItem]

  const next = [...prev]
  next[existingIndex] = {
    ...next[existingIndex],
    ...nextItem,
    id: next[existingIndex].id,
  }
  return next
}

export function JudicialPrioritiesPanel() {
  const [focusMode, setFocusMode] = useState<FocusMode>("combined")
  const [priorityProcedureQuery, setPriorityProcedureQuery] = useState("")
  const [priorityCidQuery, setPriorityCidQuery] = useState("")
  const [priorityExpiresAt, setPriorityExpiresAt] = useState("")
  const [focusItems, setFocusItems] = useState<PriorityFocusItem[]>([])
  const [loadingPriorities, setLoadingPriorities] = useState(false)
  const [savingPriorities, setSavingPriorities] = useState(false)

  const [priorityProcedureOptions, setPriorityProcedureOptions] = useState<SigTapCadastroItem[]>([])
  const [loadingPriorityProcedureOptions, setLoadingPriorityProcedureOptions] = useState(false)
  const [priorityCidOptions, setPriorityCidOptions] = useState<CidCatalogItem[]>([])
  const [loadingPriorityCidOptions, setLoadingPriorityCidOptions] = useState(false)

  const [especialidadeSubItems, setEspecialidadeSubItems] = useState<EspecialidadeSubItem[]>([])

  const [priorityCombinedCidQuery, setPriorityCombinedCidQuery] = useState("")
  const [priorityCombinedCidItem, setPriorityCombinedCidItem] = useState<CidCatalogItem | null>(null)
  const [priorityCombinedProcedureQuery, setPriorityCombinedProcedureQuery] = useState("")
  const [priorityCombinedProcedureItem, setPriorityCombinedProcedureItem] = useState<SigTapCadastroItem | null>(null)
  const [priorityCombinedSpecialty, setPriorityCombinedSpecialty] = useState("")
  const [priorityCombinedSubspecialty, setPriorityCombinedSubspecialty] = useState("")
  const [combinedProcedureOptions, setCombinedProcedureOptions] = useState<SigTapCadastroItem[]>([])
  const [loadingCombinedProcedureOptions, setLoadingCombinedProcedureOptions] = useState(false)
  const [combinedCidOptions, setCombinedCidOptions] = useState<CidCatalogItem[]>([])
  const [loadingCombinedCidOptions, setLoadingCombinedCidOptions] = useState(false)

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

  useEffect(() => {
    if (focusMode !== "procedure") return

    const timer = setTimeout(() => {
      void fetchSigtapOptions(
        priorityProcedureQuery,
        setPriorityProcedureOptions,
        setLoadingPriorityProcedureOptions,
      )
    }, 250)

    return () => clearTimeout(timer)
  }, [focusMode, priorityProcedureQuery])

  useEffect(() => {
    if (focusMode !== "cid") return

    const timer = setTimeout(() => {
      void fetchCidOptions(priorityCidQuery, setPriorityCidOptions, setLoadingPriorityCidOptions)
    }, 250)

    return () => clearTimeout(timer)
  }, [focusMode, priorityCidQuery])

  useEffect(() => {
    if (focusMode !== "combined") return

    const timer = setTimeout(() => {
      void fetchSigtapOptions(
        priorityCombinedProcedureQuery,
        setCombinedProcedureOptions,
        setLoadingCombinedProcedureOptions,
      )
    }, 250)

    return () => clearTimeout(timer)
  }, [focusMode, priorityCombinedProcedureQuery])

  useEffect(() => {
    if (focusMode !== "combined") return

    const timer = setTimeout(() => {
      void fetchCidOptions(priorityCombinedCidQuery, setCombinedCidOptions, setLoadingCombinedCidOptions)
    }, 250)

    return () => clearTimeout(timer)
  }, [focusMode, priorityCombinedCidQuery])

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

      setFocusItems(Array.isArray(json?.items) ? json.items : [])
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

  async function fetchSigtapOptions(
    query: string,
    setOptions: (items: SigTapCadastroItem[]) => void,
    setLoading: (value: boolean) => void,
  ) {
    const normalized = normalizeProcedureCode(query)

    if (!normalized) {
      setOptions([])
      return
    }

    try {
      setLoading(true)

      const params = new URLSearchParams()
      params.set("q", normalized)

      const response = await fetch(
        `/api/admin/judicial/sigtap?${params.toString()}`,
        { method: "GET", cache: "no-store" },
      )
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        setOptions([])
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []
      setOptions(
        items
          .map((item: Record<string, unknown>) => ({
            id: String(item?.id ?? `${item?.codigo ?? ""}-${item?.descricao ?? ""}`),
            codigo: normalizeProcedureCode(String(item?.codigo ?? "")),
            descricao: normalizeName(String(item?.descricao ?? "")),
            ativo: Boolean(item?.ativo ?? true),
            updatedAt: String(item?.updatedAt ?? ""),
          }))
          .filter((item: SigTapCadastroItem) => item.codigo && item.descricao),
      )
    } catch (error) {
      console.error("LOAD_PRIORITY_SIGTAP_ERROR", error)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchCidOptions(
    query: string,
    setOptions: (items: CidCatalogItem[]) => void,
    setLoading: (value: boolean) => void,
  ) {
    const normalized = normalizeCidCode(query)

    if (!normalized) {
      setOptions([])
      return
    }

    try {
      setLoading(true)

      const params = new URLSearchParams()
      params.set("q", normalized)
      params.set("limit", "50")

      const response = await fetch(`/api/judicial/cid10?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        setOptions([])
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []
      setOptions(
        items
          .map((item: Record<string, unknown>) => ({
            code: String(item?.code ?? item?.codigo ?? "").trim(),
            description: normalizeName(String(item?.description ?? item?.descricao ?? "")),
          }))
          .filter((item: CidCatalogItem) => item.code && item.description),
      )
    } catch (error) {
      console.error("LOAD_PRIORITY_CID_ERROR", error)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }

  function addProcedurePriority(item: SigTapCadastroItem) {
    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "procedure",
      value: normalizeProcedureCode(item.codigo),
      label: sigtapLabel(item),
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => upsertPriorityItem(prev, nextItem))
    setPriorityProcedureQuery("")
    setPriorityProcedureOptions([])
    setPriorityExpiresAt("")
    toast.success("Procedimento adicionado à lista de prioridade.")
  }

  function addManualProcedurePriority() {
    const code = normalizeProcedureCode(priorityProcedureQuery)
    const item = priorityProcedureOptions.find(
      (option) => normalizeProcedureCode(option.codigo) === code,
    )

    if (!code || !item) {
      toast.error("Digite e selecione um procedimento SIGTAP da lista.")
      return
    }

    addProcedurePriority(item)
  }

  function addCidPriority(item: CidCatalogItem) {
    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "cid",
      value: item.code,
      label: cidLabel(item),
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => upsertPriorityItem(prev, nextItem))
    setPriorityCidQuery("")
    setPriorityCidOptions([])
    setPriorityExpiresAt("")
    toast.success("CID adicionado à lista de prioridade.")
  }

  function addManualCidPriority() {
    const code = normalizeCidCode(priorityCidQuery)
    const item = priorityCidOptions.find(
      (option) => normalizeCidCode(option.code) === code,
    )

    if (!code || !item) {
      toast.error("Digite e selecione um CID da lista.")
      return
    }

    addCidPriority(item)
  }

  function selectCombinedProcedure(item: SigTapCadastroItem) {
    setPriorityCombinedProcedureItem(item)
    setPriorityCombinedProcedureQuery(normalizeProcedureCode(item.codigo))
    setCombinedProcedureOptions([])
  }

  function selectCombinedCid(item: CidCatalogItem) {
    setPriorityCombinedCidItem(item)
    setPriorityCombinedCidQuery(formatCidCode(item.code))
    setCombinedCidOptions([])
  }

  function resolveCombinedProcedure() {
    const code = normalizeProcedureCode(priorityCombinedProcedureQuery)
    if (!code) return null

    if (
      priorityCombinedProcedureItem &&
      normalizeProcedureCode(priorityCombinedProcedureItem.codigo) === code
    ) {
      return priorityCombinedProcedureItem
    }

    return (
      combinedProcedureOptions.find(
        (item) => normalizeProcedureCode(item.codigo) === code,
      ) ?? null
    )
  }

  function resolveCombinedCid() {
    const code = normalizeCidCode(priorityCombinedCidQuery)
    if (!code) return null

    if (priorityCombinedCidItem && normalizeCidCode(priorityCombinedCidItem.code) === code) {
      return priorityCombinedCidItem
    }

    return combinedCidOptions.find((item) => normalizeCidCode(item.code) === code) ?? null
  }

  function addCombinedPriority() {
    const typedCid = normalizeCidCode(priorityCombinedCidQuery)
    const typedProcedure = normalizeProcedureCode(priorityCombinedProcedureQuery)
    const cidItem = resolveCombinedCid()
    const procedureItem = resolveCombinedProcedure()

    if (typedCid && !cidItem) {
      toast.error("Selecione o CID na lista antes de adicionar a combinação.")
      return
    }

    if (typedProcedure && !procedureItem) {
      toast.error("Selecione o procedimento SIGTAP na lista antes de adicionar a combinação.")
      return
    }

    const criteria: CombinedCriteria = {
      cid: cidItem ? normalizeCidCode(cidItem.code) : "",
      procedure: procedureItem ? normalizeProcedureCode(procedureItem.codigo) : "",
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
    setPriorityCombinedCidQuery("")
    setPriorityCombinedCidItem(null)
    setCombinedCidOptions([])
    setPriorityCombinedProcedureQuery("")
    setPriorityCombinedProcedureItem(null)
    setCombinedProcedureOptions([])
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
          A prioridade combinada abre como padrão. Nela, CID e SIGTAP precisam ser selecionados das tabelas oficiais; todos os campos preenchidos precisam bater e campos vazios são ignorados.
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
            <option value="combined">Prioridade combinada</option>
            <option value="procedure">Priorizar por procedimento</option>
            <option value="cid">Priorizar por CID</option>
            <option value="none">Somente visualizar lista</option>
          </select>
        </div>

        {focusMode === "combined" && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              Preencha pelo menos dois critérios. Se preencher CID + SIGTAP, os dois precisam bater. Se preencher SIGTAP + especialidade + subespecialidade, os três precisam bater.
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">CID</Label>
                <Input
                  value={priorityCombinedCidQuery}
                  onChange={(e) => {
                    setPriorityCombinedCidItem(null)
                    setPriorityCombinedCidQuery(formatCidCode(e.target.value))
                  }}
                  placeholder="Digite o CID e selecione na lista"
                />

                {priorityCombinedCidItem ? (
                  <p className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Selecionado: {cidLabel(priorityCombinedCidItem)}
                  </p>
                ) : priorityCombinedCidQuery.trim() ? (
                  <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-background p-1">
                    {loadingCombinedCidOptions ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Carregando CID...</p>
                    ) : combinedCidOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum CID localizado.</p>
                    ) : (
                      combinedCidOptions.map((item) => (
                        <button
                          key={`${item.code}-${item.description}`}
                          type="button"
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => selectCombinedCid(item)}
                        >
                          <span className="font-medium">{item.code}</span> - {item.description}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div>
                <Label className="mb-1 block text-xs">Procedimento SIGTAP</Label>
                <Input
                  value={priorityCombinedProcedureQuery}
                  onChange={(e) => {
                    setPriorityCombinedProcedureItem(null)
                    setPriorityCombinedProcedureQuery(normalizeProcedureCode(e.target.value))
                  }}
                  placeholder="Digite o SIGTAP e selecione na lista"
                />

                {priorityCombinedProcedureItem ? (
                  <p className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Selecionado: {sigtapLabel(priorityCombinedProcedureItem)}
                  </p>
                ) : priorityCombinedProcedureQuery.trim() ? (
                  <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-background p-1">
                    {loadingCombinedProcedureOptions ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Carregando procedimentos...</p>
                    ) : combinedProcedureOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum procedimento localizado.</p>
                    ) : (
                      combinedProcedureOptions.map((item) => (
                        <button
                          key={`${item.id}-${item.codigo}`}
                          type="button"
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => selectCombinedProcedure(item)}
                        >
                          <span className="font-medium">{normalizeProcedureCode(item.codigo)}</span> - {item.descricao}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
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

        {focusMode === "procedure" && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <Label className="mb-1 block text-xs">Procedimento SIGTAP</Label>
              <Input
                value={priorityProcedureQuery}
                onChange={(e) => setPriorityProcedureQuery(normalizeProcedureCode(e.target.value))}
                placeholder="Digite o SIGTAP e selecione na lista"
              />

              {priorityProcedureQuery.trim() && (
                <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-background p-1">
                  {loadingPriorityProcedureOptions ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Carregando procedimentos...</p>
                  ) : priorityProcedureOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum procedimento localizado.</p>
                  ) : (
                    priorityProcedureOptions.map((item) => (
                      <button
                        key={`${item.id}-${item.codigo}`}
                        type="button"
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => addProcedurePriority(item)}
                      >
                        <span className="font-medium">{normalizeProcedureCode(item.codigo)}</span> - {item.descricao}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <PriorityExpiresInput value={priorityExpiresAt} onChange={setPriorityExpiresAt} />
            <Button type="button" variant="outline" onClick={addManualProcedurePriority}>
              Adicionar procedimento selecionado
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
                placeholder="Digite o CID e selecione na lista"
              />

              {priorityCidQuery.trim() && (
                <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-background p-1">
                  {loadingPriorityCidOptions ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Carregando CID...</p>
                  ) : priorityCidOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum CID localizado.</p>
                  ) : (
                    priorityCidOptions.map((item) => (
                      <button
                        key={`${item.code}-${item.description}`}
                        type="button"
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => addCidPriority(item)}
                      >
                        <span className="font-medium">{item.code}</span> - {item.description}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <PriorityExpiresInput value={priorityExpiresAt} onChange={setPriorityExpiresAt} />
            <Button type="button" variant="outline" onClick={addManualCidPriority}>
              Adicionar CID selecionado
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
