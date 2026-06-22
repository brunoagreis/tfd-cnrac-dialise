"use client"

import { useEffect, useMemo, useState } from "react"
import { Settings2 } from "lucide-react"
import { toast } from "sonner"

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

type PriorityMode = "combined" | "procedure" | "cid"
type FocusMode = PriorityMode | "none"

type PriorityItem = {
  id: string
  mode: PriorityMode
  value: string
  label: string
  expiresAt?: string
  createdAt?: string
}

type CidItem = {
  code: string
  description: string
}

type SigtapItem = {
  id: string
  codigo: string
  descricao: string
}

type EspecialidadeItem = {
  especialidadeNome: string
  subespecialidadeNome: string
}

type CombinedCriteria = {
  cid: string
  procedure: string
  specialty: string
  subspecialty: string
}

function makeUiId() {
  return `prio_${Math.random().toString(36).slice(2, 10)}`
}

function text(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ")
}

function upper(value: unknown) {
  return text(value).toUpperCase()
}

function normalizeCid(value: unknown) {
  return upper(value).replace(/[^A-Z0-9]/g, "")
}

function normalizeSigtap(value: unknown) {
  return text(value).replace(/\D/g, "")
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
      cid: normalizeCid(parsed.cid),
      procedure: normalizeSigtap(parsed.procedure),
      specialty: upper(parsed.specialty),
      subspecialty: upper(parsed.subspecialty),
    }
  } catch {
    return { cid: "", procedure: "", specialty: "", subspecialty: "" }
  }
}

function isActive(item: PriorityItem) {
  if (!item.expiresAt) return true
  return new Date(`${item.expiresAt}T23:59:59.999`) >= new Date()
}

function upsertItem(items: PriorityItem[], nextItem: PriorityItem) {
  const idx = items.findIndex((item) => item.mode === nextItem.mode && item.value === nextItem.value)
  if (idx < 0) return [...items, nextItem]
  const next = [...items]
  next[idx] = { ...next[idx], ...nextItem, id: next[idx].id }
  return next
}

export function JudicialPrioritiesPanelCombined() {
  const [focusMode, setFocusMode] = useState<FocusMode>("combined")
  const [items, setItems] = useState<PriorityItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expiresAt, setExpiresAt] = useState("")

  const [cidQuery, setCidQuery] = useState("")
  const [cidOptions, setCidOptions] = useState<CidItem[]>([])
  const [cidLoading, setCidLoading] = useState(false)
  const [selectedCid, setSelectedCid] = useState<CidItem | null>(null)

  const [sigtapQuery, setSigtapQuery] = useState("")
  const [sigtapOptions, setSigtapOptions] = useState<SigtapItem[]>([])
  const [sigtapLoading, setSigtapLoading] = useState(false)
  const [selectedSigtap, setSelectedSigtap] = useState<SigtapItem | null>(null)

  const [singleCidQuery, setSingleCidQuery] = useState("")
  const [singleCidOptions, setSingleCidOptions] = useState<CidItem[]>([])
  const [singleSigtapQuery, setSingleSigtapQuery] = useState("")
  const [singleSigtapOptions, setSingleSigtapOptions] = useState<SigtapItem[]>([])

  const [especialidadeItems, setEspecialidadeItems] = useState<EspecialidadeItem[]>([])
  const [specialty, setSpecialty] = useState("")
  const [subspecialty, setSubspecialty] = useState("")

  const specialtyOptions = useMemo(
    () => Array.from(new Set(especialidadeItems.map((item) => upper(item.especialidadeNome)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [especialidadeItems],
  )

  const subspecialtyOptions = useMemo(
    () => Array.from(new Set(especialidadeItems
      .filter((item) => !specialty || upper(item.especialidadeNome) === specialty)
      .map((item) => upper(item.subespecialidadeNome))
      .filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [especialidadeItems, specialty],
  )

  useEffect(() => {
    void loadPriorities()
    void loadEspecialidades()
  }, [])

  useEffect(() => {
    if (focusMode !== "combined") return
    const timer = setTimeout(() => void searchCid(cidQuery, setCidOptions, setCidLoading), 250)
    return () => clearTimeout(timer)
  }, [cidQuery, focusMode])

  useEffect(() => {
    if (focusMode !== "combined") return
    const timer = setTimeout(() => void searchSigtap(sigtapQuery, setSigtapOptions, setSigtapLoading), 250)
    return () => clearTimeout(timer)
  }, [sigtapQuery, focusMode])

  useEffect(() => {
    if (focusMode !== "cid") return
    const timer = setTimeout(() => void searchCid(singleCidQuery, setSingleCidOptions), 250)
    return () => clearTimeout(timer)
  }, [singleCidQuery, focusMode])

  useEffect(() => {
    if (focusMode !== "procedure") return
    const timer = setTimeout(() => void searchSigtap(singleSigtapQuery, setSingleSigtapOptions), 250)
    return () => clearTimeout(timer)
  }, [singleSigtapQuery, focusMode])

  async function loadPriorities() {
    try {
      setLoadingItems(true)
      const response = await fetch("/api/admin/judicial/prioridades?tipoPrioridade=monitoramento", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar prioridades.")
        return
      }
      setItems(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_PRIORITIES_ERROR", error)
      toast.error("Erro ao carregar prioridades.")
    } finally {
      setLoadingItems(false)
    }
  }

  async function loadEspecialidades() {
    try {
      const response = await fetch("/api/admin/judicial/especialidades", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      setEspecialidadeItems(response.ok && json?.ok && Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_SPECIALTIES_ERROR", error)
      setEspecialidadeItems([])
    }
  }

  async function searchCid(query: string, setOptions: (items: CidItem[]) => void, setLoading?: (loading: boolean) => void) {
    const q = upper(query)
    if (!q) {
      setOptions([])
      setLoading?.(false)
      return
    }

    try {
      setLoading?.(true)
      const params = new URLSearchParams({ q })
      const response = await fetch(`/api/admin/judicial/cid10?${params.toString()}`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      const rawItems = response.ok && json?.ok && Array.isArray(json?.items) ? json.items : []
      setOptions(rawItems.map((item: any) => ({
        code: text(item?.code ?? item?.codigo),
        description: upper(item?.description ?? item?.descricao),
      })).filter((item: CidItem) => item.code && item.description))
    } catch (error) {
      console.error("SEARCH_CID_ERROR", error)
      setOptions([])
    } finally {
      setLoading?.(false)
    }
  }

  async function searchSigtap(query: string, setOptions: (items: SigtapItem[]) => void, setLoading?: (loading: boolean) => void) {
    const q = upper(query)
    if (!q) {
      setOptions([])
      setLoading?.(false)
      return
    }

    try {
      setLoading?.(true)
      const params = new URLSearchParams({ q })
      const response = await fetch(`/api/admin/judicial/sigtap?${params.toString()}`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      const rawItems = response.ok && json?.ok && Array.isArray(json?.items) ? json.items : []
      setOptions(rawItems.map((item: any) => ({
        id: text(item?.id ?? `${item?.codigo ?? ""}-${item?.descricao ?? ""}`),
        codigo: normalizeSigtap(item?.codigo),
        descricao: upper(item?.descricao),
      })).filter((item: SigtapItem) => item.codigo && item.descricao))
    } catch (error) {
      console.error("SEARCH_SIGTAP_ERROR", error)
      setOptions([])
    } finally {
      setLoading?.(false)
    }
  }

  function addCombinedPriority() {
    const typedCid = upper(cidQuery)
    const typedSigtap = upper(sigtapQuery)

    if (typedCid && !selectedCid) {
      toast.error("Selecione o CID retornado pela lista.")
      return
    }

    if (typedSigtap && !selectedSigtap) {
      toast.error("Selecione o procedimento SIGTAP retornado pela lista.")
      return
    }

    const criteria: CombinedCriteria = {
      cid: selectedCid ? normalizeCid(selectedCid.code) : "",
      procedure: selectedSigtap ? normalizeSigtap(selectedSigtap.codigo) : "",
      specialty,
      subspecialty,
    }

    if (countCriteria(criteria) < 2) {
      toast.error("Informe pelo menos dois critérios para criar uma prioridade combinada.")
      return
    }

    setItems((current) => upsertItem(current, {
      id: makeUiId(),
      mode: "combined",
      value: JSON.stringify(criteria),
      label: buildCombinedLabel(criteria),
      expiresAt: expiresAt || undefined,
      createdAt: new Date().toISOString(),
    }))

    setCidQuery("")
    setCidOptions([])
    setSelectedCid(null)
    setSigtapQuery("")
    setSigtapOptions([])
    setSelectedSigtap(null)
    setSpecialty("")
    setSubspecialty("")
    setExpiresAt("")
    toast.success("Prioridade combinada adicionada à lista.")
  }

  function addCidPriority(item: CidItem) {
    setItems((current) => upsertItem(current, {
      id: makeUiId(),
      mode: "cid",
      value: item.code,
      label: `${item.code} - ${item.description}`,
      expiresAt: expiresAt || undefined,
      createdAt: new Date().toISOString(),
    }))
    setSingleCidQuery("")
    setSingleCidOptions([])
    setExpiresAt("")
    toast.success("CID adicionado à lista.")
  }

  function addSigtapPriority(item: SigtapItem) {
    setItems((current) => upsertItem(current, {
      id: makeUiId(),
      mode: "procedure",
      value: item.codigo,
      label: `${item.codigo} - ${item.descricao}`,
      expiresAt: expiresAt || undefined,
      createdAt: new Date().toISOString(),
    }))
    setSingleSigtapQuery("")
    setSingleSigtapOptions([])
    setExpiresAt("")
    toast.success("Procedimento adicionado à lista.")
  }

  async function savePriorities() {
    if (items.length === 0) {
      toast.error("Adicione pelo menos uma prioridade antes de aplicar.")
      return
    }

    try {
      setSaving(true)
      const response = await fetch("/api/admin/judicial/prioridades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoPrioridade: "monitoramento", items }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao salvar prioridades.")
        return
      }
      setItems(Array.isArray(json?.items) ? json.items : [])
      toast.success("Prioridades aplicadas.")
    } catch (error) {
      console.error("SAVE_PRIORITIES_ERROR", error)
      toast.error("Erro ao salvar prioridades.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Prioridades do monitoramento</CardTitle>
        <CardDescription>
          A prioridade combinada abre como principal. CID e SIGTAP consultam as tabelas oficiais enquanto você digita e precisam ser selecionados na lista.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1 block text-xs">Tipo de prioridade</Label>
          <select
            value={focusMode}
            onChange={(event) => setFocusMode(event.target.value as FocusMode)}
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
              Campos vazios são ignorados. Todos os campos preenchidos precisam bater ao mesmo tempo.
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <SearchCidBox
                label="CID"
                query={cidQuery}
                loading={cidLoading}
                selected={selectedCid}
                options={cidOptions}
                onQueryChange={(value) => {
                  setCidQuery(value)
                  setSelectedCid(null)
                }}
                onSelect={(item) => {
                  setSelectedCid(item)
                  setCidQuery(item.code)
                  setCidOptions([])
                }}
              />

              <SearchSigtapBox
                label="Procedimento SIGTAP"
                query={sigtapQuery}
                loading={sigtapLoading}
                selected={selectedSigtap}
                options={sigtapOptions}
                onQueryChange={(value) => {
                  setSigtapQuery(value)
                  setSelectedSigtap(null)
                }}
                onSelect={(item) => {
                  setSelectedSigtap(item)
                  setSigtapQuery(item.codigo)
                  setSigtapOptions([])
                }}
              />

              <div>
                <Label className="mb-1 block text-xs">Especialidade</Label>
                <select
                  value={specialty}
                  onChange={(event) => {
                    setSpecialty(upper(event.target.value))
                    setSubspecialty("")
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Ignorar especialidade</option>
                  {specialtyOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>

              <div>
                <Label className="mb-1 block text-xs">Subespecialidade</Label>
                <select
                  value={subspecialty}
                  onChange={(event) => setSubspecialty(upper(event.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Ignorar subespecialidade</option>
                  {subspecialtyOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>

            <PriorityExpiresInput value={expiresAt} onChange={setExpiresAt} />
            <Button type="button" variant="outline" onClick={addCombinedPriority}>Adicionar combinação</Button>
          </div>
        )}

        {focusMode === "cid" && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <SearchCidBox
              label="CID"
              query={singleCidQuery}
              loading={false}
              selected={null}
              options={singleCidOptions}
              onQueryChange={setSingleCidQuery}
              onSelect={addCidPriority}
            />
            <PriorityExpiresInput value={expiresAt} onChange={setExpiresAt} />
          </div>
        )}

        {focusMode === "procedure" && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <SearchSigtapBox
              label="Procedimento SIGTAP"
              query={singleSigtapQuery}
              loading={false}
              selected={null}
              options={singleSigtapOptions}
              onQueryChange={setSingleSigtapQuery}
              onSelect={addSigtapPriority}
            />
            <PriorityExpiresInput value={expiresAt} onChange={setExpiresAt} />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Itens priorizados</Label>
            <Badge variant="outline">{items.length}</Badge>
          </div>

          {loadingItems ? (
            <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">Carregando prioridades...</div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma prioridade incluída.</p>
          ) : (
            items.map((item) => {
              const criteria = item.mode === "combined" ? parseCombinedValue(item.value) : null
              return (
                <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.mode === "combined" ? "outline" : item.mode === "cid" ? "secondary" : "default"}>
                        {item.mode === "combined" ? "Combinada" : item.mode === "cid" ? "CID" : "Procedimento"}
                      </Badge>
                      {criteria ? <Badge variant="outline">{countCriteria(criteria)} critérios</Badge> : null}
                      {!isActive(item) ? <Badge variant="destructive">Expirado</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.expiresAt ? `vigente até ${new Date(`${item.expiresAt}T00:00:00`).toLocaleDateString("pt-BR")}` : "sem prazo final"}
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="bg-transparent" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>Remover</Button>
                </div>
              )
            })
          )}
        </div>

        <Button onClick={savePriorities} disabled={saving}>
          <Settings2 className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Aplicar prioridades"}
        </Button>
      </CardContent>
    </Card>
  )
}

function SearchCidBox({
  label,
  query,
  loading,
  selected,
  options,
  onQueryChange,
  onSelect,
}: {
  label: string
  query: string
  loading: boolean
  selected: CidItem | null
  options: CidItem[]
  onQueryChange: (value: string) => void
  onSelect: (item: CidItem) => void
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      <Input value={query} onChange={(event) => onQueryChange(upper(event.target.value))} placeholder="Digite Z00, M16 ou parte da descrição" />
      {selected ? <p className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Selecionado: {selected.code} - {selected.description}</p> : null}
      {!selected && query.trim() ? <OptionsBox loading={loading} emptyText="Nenhum CID localizado.">{options.map((item) => <button key={`${item.code}-${item.description}`} type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onSelect(item)}><span className="font-medium">{item.code}</span> - {item.description}</button>)}</OptionsBox> : null}
    </div>
  )
}

function SearchSigtapBox({
  label,
  query,
  loading,
  selected,
  options,
  onQueryChange,
  onSelect,
}: {
  label: string
  query: string
  loading: boolean
  selected: SigtapItem | null
  options: SigtapItem[]
  onQueryChange: (value: string) => void
  onSelect: (item: SigtapItem) => void
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      <Input value={query} onChange={(event) => onQueryChange(upper(event.target.value))} placeholder="Digite código SIGTAP ou parte da descrição" />
      {selected ? <p className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Selecionado: {selected.codigo} - {selected.descricao}</p> : null}
      {!selected && query.trim() ? <OptionsBox loading={loading} emptyText="Nenhum procedimento localizado.">{options.map((item) => <button key={`${item.id}-${item.codigo}`} type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onSelect(item)}><span className="font-medium">{item.codigo}</span> - {item.descricao}</button>)}</OptionsBox> : null}
    </div>
  )
}

function OptionsBox({ loading, emptyText, children }: { loading: boolean; emptyText: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-background p-1">
      {loading ? <p className="px-3 py-2 text-sm text-muted-foreground">Carregando...</p> : hasChildren ? children : <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>}
    </div>
  )
}

function PriorityExpiresInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label className="mb-1 block text-xs">Vigente até</Label>
      <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
