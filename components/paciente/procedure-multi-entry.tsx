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

type SpecialtySubItem = {
  especialidadeId: string
  especialidadeNome: string
  subespecialidadeId: string
  subespecialidadeNome: string
}

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ")
}

function upper(value: unknown) {
  return clean(value).toUpperCase()
}

function normalizeSigtapCode(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
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
  const [selectedItem, setSelectedItem] = useState<ProcedureCatalogItem | null>(null)
  const [specialty, setSpecialty] = useState("")
  const [subSpecialty, setSubSpecialty] = useState("")
  const [situation, setSituation] = useState<ProcedureSituation>("determinado")
  const [remoteCatalog, setRemoteCatalog] = useState<ProcedureCatalogItem[]>([])
  const [specialtySubItems, setSpecialtySubItems] = useState<SpecialtySubItem[]>([])
  const [loadingSigtap, setLoadingSigtap] = useState(false)
  const [loadingSpecialties, setLoadingSpecialties] = useState(false)

  useEffect(() => {
    void fetchSpecialties()
  }, [])

  useEffect(() => {
    const q = query.trim()

    if (!q) {
      setRemoteCatalog([])
      setLoadingSigtap(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setLoadingSigtap(true)

        const params = new URLSearchParams()
        params.set("q", q)

        const response = await fetch(`/api/admin/judicial/sigtap?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Erro ao carregar SIGTAP.")
        }

        const items = Array.isArray(data?.items) ? data.items : []
        setRemoteCatalog(
          items
            .map((item: any) => ({
              sigtapCode: normalizeSigtapCode(item?.sigtapCode ?? item?.codigo),
              description: upper(item?.description ?? item?.descricao),
              specialty: upper(item?.specialty ?? item?.especialidade ?? item?.especialidadeNome),
              subSpecialty: upper(item?.subSpecialty ?? item?.subespecialidade ?? item?.subespecialidadeNome),
            }))
            .filter((item: ProcedureCatalogItem) => item.sigtapCode && item.description),
        )
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.error("[ProcedureMultiEntry] erro ao carregar SIGTAP:", error)
          setRemoteCatalog([])
        }
      } finally {
        if (!controller.signal.aborted) setLoadingSigtap(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  async function fetchSpecialties() {
    try {
      setLoadingSpecialties(true)

      const response = await fetch("/api/admin/judicial/especialidades", {
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "Erro ao carregar especialidades.")
      }

      const items = Array.isArray(data?.items) ? data.items : []
      setSpecialtySubItems(
        items
          .map((item: any) => ({
            especialidadeId: clean(item?.especialidadeId),
            especialidadeNome: upper(item?.especialidadeNome),
            subespecialidadeId: clean(item?.subespecialidadeId),
            subespecialidadeNome: upper(item?.subespecialidadeNome),
          }))
          .filter((item: SpecialtySubItem) => item.especialidadeNome && item.subespecialidadeNome),
      )
    } catch (error) {
      console.error("[ProcedureMultiEntry] erro ao carregar especialidades:", error)
      setSpecialtySubItems([])
    } finally {
      setLoadingSpecialties(false)
    }
  }

  const fallbackCatalog = useMemo(
    () =>
      catalog
        .map((item) => ({
          sigtapCode: normalizeSigtapCode(item.sigtapCode),
          description: upper(item.description),
          specialty: upper(item.specialty),
          subSpecialty: upper(item.subSpecialty),
        }))
        .filter((item) => item.sigtapCode && item.description),
    [catalog],
  )

  const sourceCatalog = remoteCatalog.length > 0 ? remoteCatalog : fallbackCatalog

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = sourceCatalog.filter((item) => item.sigtapCode && item.description)
    if (!q) return []
    return items
      .filter((item) => `${item.sigtapCode} ${item.description}`.toLowerCase().includes(q))
      .slice(0, 30)
  }, [sourceCatalog, query])

  const specialtyOptions = useMemo(() => {
    const fromSpecialtyTable = specialtySubItems.map((item) => item.especialidadeNome).filter(Boolean)
    const fromProcedureCatalog = sourceCatalog.map((item) => item.specialty).filter(Boolean)

    return Array.from(new Set([...fromSpecialtyTable, ...fromProcedureCatalog]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [sourceCatalog, specialtySubItems])

  const subSpecialties = useMemo(() => {
    if (!specialty) return []

    const fromSpecialtyTable = specialtySubItems
      .filter((item) => item.especialidadeNome === specialty)
      .map((item) => item.subespecialidadeNome)
      .filter(Boolean)

    const fromProcedureCatalog = sourceCatalog
      .filter((item) => item.specialty === specialty)
      .map((item) => item.subSpecialty)
      .filter(Boolean)

    return Array.from(new Set([...fromSpecialtyTable, ...fromProcedureCatalog]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [sourceCatalog, specialty, specialtySubItems])

  function selectItem(item: ProcedureCatalogItem) {
    setSelectedItem(item)
    setQuery(`${item.sigtapCode} - ${item.description}`)

    if (item.specialty) setSpecialty(item.specialty)
    if (item.subSpecialty) setSubSpecialty(item.subSpecialty)
  }

  function handleAdd() {
    if (!selectedItem || !specialty || !subSpecialty) return

    onChange([
      ...value,
      {
        sigtapCode: selectedItem.sigtapCode,
        description: selectedItem.description,
        specialty,
        subSpecialty,
        situation,
      },
    ])
    setQuery("")
    setSelectedItem(null)
    setSpecialty("")
    setSubSpecialty("")
    setSituation("determinado")
    setRemoteCatalog([])
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
                setSelectedItem(null)
              }}
              placeholder="Digite código ou descrição do procedimento"
            />
            {query.trim() ? (
              <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-border bg-background p-1">
                {loadingSigtap ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Carregando SIGTAP...</div>
                ) : filtered.length > 0 ? (
                  filtered.map((item) => (
                    <button
                      key={`${item.sigtapCode}-${item.description}`}
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => selectItem(item)}
                    >
                      <span className="font-medium">{item.sigtapCode}</span> - {item.description}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum procedimento encontrado.</div>
                )}
              </div>
            ) : null}
          </div>

          <div>
            <Label className="mb-1 block text-xs">Especialidade</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={specialty}
              onChange={(e) => {
                setSpecialty(e.target.value)
                setSubSpecialty("")
              }}
              disabled={loadingSpecialties}
            >
              <option value="">{loadingSpecialties ? "Carregando..." : "Selecione"}</option>
              {specialtyOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-1 block text-xs">Sub Especialidade</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={subSpecialty}
              onChange={(e) => setSubSpecialty(e.target.value)}
              disabled={!specialty || loadingSpecialties}
            >
              <option value="">{specialty ? "Selecione" : "Selecione a especialidade"}</option>
              {subSpecialties.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-1 block text-xs">Situação</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={situation}
              onChange={(e) => setSituation(e.target.value as ProcedureSituation)}
            >
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
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum procedimento adicionado.</p>
        ) : (
          value.map((item, index) => (
            <div key={`${item.sigtapCode}-${index}`} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{item.sigtapCode} - {item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.specialty}{item.subSpecialty ? ` • ${item.subSpecialty}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.situation}</Badge>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeAt(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
