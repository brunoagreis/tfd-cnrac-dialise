"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Settings2 } from "lucide-react"

import type { PriorityFocusItem } from "@/lib/judicial-types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

function isPriorityItemActive(item: PriorityFocusItem) {
  if (!item.expiresAt) return true
  const expiresAt = new Date(`${item.expiresAt}T23:59:59.999`)
  return expiresAt >= new Date()
}

function describePriorityItem(item: PriorityFocusItem) {
  const base = item.mode === "procedure" ? `Procedimento ${item.label}` : `CID ${item.label}`

  return item.expiresAt
    ? `${base} • até ${new Date(`${item.expiresAt}T00:00:00`).toLocaleDateString("pt-BR")}`
    : `${base} • sem prazo final`
}

export function JudicialPrioritiesPanel() {
  const [focusMode, setFocusMode] = useState<"none" | "procedure" | "cid">("procedure")
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

  const filteredPriorityCidOptions = useMemo(() => priorityCidOptions, [priorityCidOptions])

  useEffect(() => {
    void fetchPriorityFocus()
  }, [])

  useEffect(() => {
    if (focusMode !== "procedure") return

    const timer = setTimeout(() => {
      void fetchPriorityProcedureOptions(priorityProcedureQuery)
    }, 250)

    return () => clearTimeout(timer)
  }, [focusMode, priorityProcedureQuery])

  useEffect(() => {
    if (focusMode !== "cid") return

    const timer = setTimeout(() => {
      void fetchPriorityCidOptions(priorityCidQuery)
    }, 250)

    return () => clearTimeout(timer)
  }, [focusMode, priorityCidQuery])

  async function fetchPriorityFocus() {
    try {
      setLoadingPriorities(true)

      const response = await fetch(
        "/api/admin/judicial/prioridades?tipoPrioridade=monitoramento",
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar prioridades.")
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []
      setFocusItems(items)

      const lastMode = items[items.length - 1]?.mode
      if (lastMode === "procedure" || lastMode === "cid") {
        setFocusMode(lastMode)
      }
    } catch (error) {
      console.error("LOAD_PRIORIDADES_ERROR", error)
      toast.error("Erro ao carregar prioridades.")
    } finally {
      setLoadingPriorities(false)
    }
  }

  async function fetchPriorityProcedureOptions(query: string) {
    try {
      setLoadingPriorityProcedureOptions(true)

      const params = new URLSearchParams()
      const normalized = normalizeProcedureCode(query)

      if (normalized) {
        params.set("q", normalized)
      }

      const response = await fetch(
        `/api/admin/judicial/sigtap${params.toString() ? `?${params.toString()}` : ""}`,
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar procedimentos SIGTAP.")
        setPriorityProcedureOptions([])
        return
      }

      setPriorityProcedureOptions(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_PRIORITY_SIGTAP_ERROR", error)
      toast.error("Erro ao carregar procedimentos SIGTAP.")
      setPriorityProcedureOptions([])
    } finally {
      setLoadingPriorityProcedureOptions(false)
    }
  }

  async function fetchPriorityCidOptions(query: string) {
    try {
      setLoadingPriorityCidOptions(true)

      const params = new URLSearchParams()
      const normalized = normalizeCidCode(query)

      if (normalized) {
        params.set("q", normalized)
      }

      params.set("limit", "50")

      const response = await fetch(
        `/api/judicial/cid10${params.toString() ? `?${params.toString()}` : ""}`,
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar CID.")
        setPriorityCidOptions([])
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []

      setPriorityCidOptions(
        items
          .map((item: any) => ({
            code: String(item?.code ?? item?.codigo ?? "").trim(),
            description: String(item?.description ?? item?.descricao ?? "").trim(),
          }))
          .filter((item: CidCatalogItem) => item.code && item.description),
      )
    } catch (error) {
      console.error("LOAD_PRIORITY_CID_ERROR", error)
      toast.error("Erro ao carregar CID.")
      setPriorityCidOptions([])
    } finally {
      setLoadingPriorityCidOptions(false)
    }
  }

  function addProcedurePriority(item: SigTapCadastroItem) {
    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "procedure",
      value: item.codigo,
      label: `${item.codigo} - ${item.descricao}`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => upsertPriorityItem(prev, nextItem))
    setPriorityProcedureQuery("")
    setPriorityExpiresAt("")
    setPriorityProcedureOptions([])
    toast.success("Procedimento adicionado à lista de prioridade.")
  }

  function addManualProcedurePriority() {
    const code = normalizeProcedureCode(priorityProcedureQuery)

    if (!code) {
      toast.error("Informe o procedimento SIGTAP.")
      return
    }

    const exactMatch = priorityProcedureOptions.find(
      (item) => normalizeProcedureCode(item.codigo) === code,
    )

    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "procedure",
      value: code,
      label: exactMatch
        ? `${normalizeProcedureCode(exactMatch.codigo)} - ${exactMatch.descricao}`
        : `${code} - PROCEDIMENTO PRIORITÁRIO`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => upsertPriorityItem(prev, nextItem))
    setPriorityProcedureQuery("")
    setPriorityExpiresAt("")
    setPriorityProcedureOptions([])
    toast.success("Procedimento adicionado à lista de prioridade.")
  }

  function addCidPriority(item: CidCatalogItem) {
    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "cid",
      value: item.code,
      label: `${item.code} - ${item.description}`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => upsertPriorityItem(prev, nextItem))
    setPriorityCidQuery("")
    setPriorityExpiresAt("")
    setPriorityCidOptions([])
    toast.success("CID adicionado à lista de prioridade.")
  }

  function addManualCidPriority() {
    const code = formatCidCode(priorityCidQuery)

    if (!code) {
      toast.error("Informe o CID.")
      return
    }

    const exactMatch = priorityCidOptions.find(
      (item) => normalizeCidCode(item.code) === normalizeCidCode(code),
    )

    const nextItem: PriorityFocusItem = {
      id: makeUiId("prio"),
      mode: "cid",
      value: code,
      label: exactMatch
        ? `${exactMatch.code} - ${exactMatch.description}`
        : `${code} - CID prioritário`,
      expiresAt: priorityExpiresAt || undefined,
      createdAt: new Date().toISOString(),
    }

    setFocusItems((prev) => upsertPriorityItem(prev, nextItem))
    setPriorityCidQuery("")
    setPriorityExpiresAt("")
    setPriorityCidOptions([])
    toast.success("CID adicionado à lista de prioridade.")
  }

  function upsertPriorityItem(prev: PriorityFocusItem[], nextItem: PriorityFocusItem) {
    const existingIndex = prev.findIndex((entry) => {
      if (entry.mode !== nextItem.mode) return false
      if (entry.mode === "procedure") {
        return normalizeProcedureCode(entry.value) === normalizeProcedureCode(nextItem.value)
      }
      return normalizeCidCode(entry.value) === normalizeCidCode(nextItem.value)
    })

    if (existingIndex >= 0) {
      const next = [...prev]
      next[existingIndex] = {
        ...next[existingIndex],
        ...nextItem,
        id: next[existingIndex].id,
      }
      return next
    }

    return [...prev, nextItem]
  }

  function removePriorityItem(itemId: string) {
    setFocusItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  async function applyPriorityFocus() {
    if (focusItems.length === 0) {
      toast.error("Adicione pelo menos um procedimento ou CID antes de aplicar.")
      return
    }

    try {
      setSavingPriorities(true)

      const response = await fetch("/api/admin/judicial/prioridades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipoPrioridade: "monitoramento",
          items: focusItems,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao salvar prioridades.")
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []
      setFocusItems(items)
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
          Adicione procedimentos e CIDs com vigência. O destaque sai automaticamente da fila quando o prazo expira ou quando o item é removido.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1 block text-xs">Tipo de prioridade</Label>
          <select
            value={focusMode}
            onChange={(e) => setFocusMode(e.target.value as "none" | "procedure" | "cid")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="procedure">Priorizar por procedimento</option>
            <option value="cid">Priorizar por CID</option>
            <option value="none">Somente visualizar lista</option>
          </select>
        </div>

        {focusMode === "procedure" && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <Label className="mb-1 block text-xs">Procedimento SIGTAP</Label>
              <Input
                value={priorityProcedureQuery}
                onChange={(e) => setPriorityProcedureQuery(e.target.value.replace(/\D/g, ""))}
                placeholder="0000000000"
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

              {priorityCidQuery.trim() && (
                <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-background p-1">
                  {loadingPriorityCidOptions ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Carregando CID...</p>
                  ) : filteredPriorityCidOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum CID localizado.</p>
                  ) : (
                    filteredPriorityCidOptions.map((item) => (
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
              Adicionar CID à lista
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
            <p className="text-sm text-muted-foreground">Nenhum procedimento ou CID incluído na lista.</p>
          ) : (
            focusItems.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.mode === "procedure" ? "default" : "secondary"}>
                      {item.mode === "procedure" ? "Procedimento" : "CID"}
                    </Badge>
                    {!isPriorityItemActive(item) && <Badge variant="destructive">Expirado</Badge>}
                  </div>

                  <p className="mt-2 text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{describePriorityItem(item)}</p>
                </div>

                <Button type="button" variant="outline" className="bg-transparent" onClick={() => removePriorityItem(item.id)}>
                  Remover
                </Button>
              </div>
            ))
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
