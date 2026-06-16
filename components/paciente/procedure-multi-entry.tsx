"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export type ProcedureSituation = "determinado" | "cumprido" | "encerrado"

export type ProcedureCatalogItem = {
  sigtapCode: string
  description: string
  specialty: string
  subSpecialty: string
}

export type ProcedureEntry = {
  sigtapCode: string
  description: string
  specialty: string
  subSpecialty: string
  situation: ProcedureSituation
}

function clean(value: unknown) {
  return String(value ?? "").trim()
}

export function ProcedureMultiEntry({
  catalog,
  value,
  onChange,
}: {
  catalog: ProcedureCatalogItem[]
  value: ProcedureEntry[]
  onChange: (next: ProcedureEntry[]) => void
}) {
  const [query, setQuery] = useState("")
  const [selectedCode, setSelectedCode] = useState("")
  const [specialty, setSpecialty] = useState("")
  const [subSpecialty, setSubSpecialty] = useState("")
  const [situation, setSituation] = useState<ProcedureSituation>("determinado")
  const [remoteCatalog, setRemoteCatalog] = useState<ProcedureCatalogItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/judicial/sigtap?q=${encodeURIComponent(query.trim())}&limit=50`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || data?.ok === false) throw new Error(data?.error || "Erro ao carregar SIGTAP.")
        const items = Array.isArray(data?.items) ? data.items : []
        setRemoteCatalog(items.map((item: any) => ({
          sigtapCode: clean(item?.sigtapCode ?? item?.codigo),
          description: clean(item?.description ?? item?.descricao),
          specialty: clean(item?.specialty ?? item?.especialidade ?? item?.especialidadeNome),
          subSpecialty: clean(item?.subSpecialty ?? item?.subespecialidade ?? item?.subespecialidadeNome),
        })).filter((item: ProcedureCatalogItem) => item.sigtapCode && item.description))
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.error("[ProcedureMultiEntry] erro ao carregar SIGTAP:", error)
          setRemoteCatalog([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const sourceCatalog = remoteCatalog.length > 0 ? remoteCatalog : catalog
  const selectedItem = sourceCatalog.find((item) => item.sigtapCode === selectedCode)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = sourceCatalog.filter((item) => item.sigtapCode && item.description)
    if (!q) return items.slice(0, 8)
    return items.filter((item) => `${item.sigtapCode} ${item.description}`.toLowerCase().includes(q)).slice(0, 20)
  }, [sourceCatalog, query])

  const specialtyOptions = useMemo(() => {
    return Array.from(new Set(sourceCatalog.map((item) => item.specialty).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [sourceCatalog])

  const subSpecialties = useMemo(() => {
    if (!specialty) return []
    return Array.from(new Set(sourceCatalog.filter((item) => item.specialty === specialty).map((item) => item.subSpecialty).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [sourceCatalog, specialty])

  function selectItem(item: ProcedureCatalogItem) {
    setSelectedCode(item.sigtapCode)
    setQuery(`${item.sigtapCode} - ${item.description}`)
    setSpecialty(item.specialty)
    setSubSpecialty(item.subSpecialty)
  }

  function handleAdd() {
    if (!selectedItem || !specialty || !subSpecialty) return
    onChange([...value, { sigtapCode: selectedItem.sigtapCode, description: selectedItem.description, specialty, subSpecialty, situation }])
    setQuery("")
    setSelectedCode("")
    setSpecialty("")
    setSubSpecialty("")
    setSituation("determinado")
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Label className="mb-1 block text-xs">SIGTAP + descrição</Label>
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedCode("")
              }}
              placeholder="Digite código ou descrição do procedimento"
            />
            {query && (
              <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-border bg-background p-1">
                {loading ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Carregando SIGTAP...</div>
                ) : filtered.length > 0 ? (
                  filtered.map((item) => (
                    <button key={`${item.sigtapCode}-${item.description}`} type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => selectItem(item)}>
                      <span className="font-medium">{item.sigtapCode}</span> - {item.description}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum procedimento encontrado.</div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-1 block text-xs">Especialidade</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={specialty} onChange={(e) => { setSpecialty(e.target.value); setSubSpecialty("") }}>
              <option value="">Selecione</option>
              {specialtyOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div>
            <Label className="mb-1 block text-xs">Sub Especialidade</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={subSpecialty} onChange={(e) => setSubSpecialty(e.target.value)}>
              <option value="">Selecione</option>
              {subSpecialties.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div>
            <Label className="mb-1 block text-xs">Situação</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={situation} onChange={(e) => setSituation(e.target.value as ProcedureSituation)}>
              <option value="determinado">Determinado</option>
              <option value="cumprido">Cumprido</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button type="button" onClick={handleAdd} disabled={!selectedItem || !specialty || !subSpecialty}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar procedimento
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {value.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum procedimento adicionado.</p> : value.map((item, index) => (
          <div key={`${item.sigtapCode}-${index}`} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{item.sigtapCode} - {item.description}</p>
                <p className="text-xs text-muted-foreground">{item.specialty}{item.subSpecialty ? ` • ${item.subSpecialty}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{item.situation}</Badge>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeAt(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
