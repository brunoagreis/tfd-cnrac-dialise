"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type CidCatalogItem = {
  code: string
  description: string
}

export type CidEntry = {
  code: string
  description: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ")
}

function normalizeCidCode(value: unknown) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function CidMultiEntry({
  catalog,
  value,
  onChange,
}: {
  catalog: CidCatalogItem[]
  value: CidEntry[]
  onChange: (next: CidEntry[]) => void
}) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<CidCatalogItem | null>(null)
  const [remoteCatalog, setRemoteCatalog] = useState<CidCatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = query.trim()

    if (!q || selected) {
      setRemoteCatalog([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)

        const params = new URLSearchParams()
        params.set("q", q)
        params.set("limit", "1000")

        const response = await fetch(`/api/judicial/cid10?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Erro ao carregar CID-10.")
        }

        const items = Array.isArray(data?.items) ? data.items : []
        setRemoteCatalog(
          items
            .map((item: any) => ({
              code: normalizeText(item?.code ?? item?.codigo),
              description: normalizeText(item?.description ?? item?.descricao).toUpperCase(),
            }))
            .filter((item: CidCatalogItem) => item.code && item.description),
        )
        setOpen(true)
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return
        console.error("[CidMultiEntry] erro ao carregar CID-10:", error)
        setRemoteCatalog([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, selected])

  const fallbackCatalog = useMemo(
    () =>
      catalog
        .map((item) => ({
          code: normalizeText(item.code),
          description: normalizeText(item.description).toUpperCase(),
        }))
        .filter((item) => item.code && item.description),
    [catalog],
  )

  const sourceCatalog = remoteCatalog.length > 0 ? remoteCatalog : fallbackCatalog

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const qCid = normalizeCidCode(query)
    const items = sourceCatalog.filter((item) => item.code && item.description)

    if (!q) return []

    return items
      .filter((item) => {
        const code = normalizeCidCode(item.code)
        const label = `${item.code} ${item.description}`.toLowerCase()
        return label.includes(q) || (!!qCid && code.includes(qCid))
      })
      .slice(0, 30)
  }, [sourceCatalog, query])

  function selectItem(item: CidCatalogItem) {
    setSelected(item)
    setQuery(`${item.code} - ${item.description}`)
    setOpen(false)
    setRemoteCatalog([])
  }

  function handleAdd() {
    if (!selected) return

    onChange([...value, { code: selected.code, description: selected.description }])
    setQuery("")
    setSelected(null)
    setRemoteCatalog([])
    setOpen(false)
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4">
        <Label className="mb-1 block text-xs">CID + descrição</Label>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
            setOpen(true)
          }}
          onFocus={() => {
            if (!selected && query.trim()) setOpen(true)
          }}
          placeholder="Digite o CID ou a descrição"
        />

        {selected ? (
          <div className="mt-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            Selecionado: <span className="font-medium text-foreground">{selected.code}</span> - {selected.description}
          </div>
        ) : null}

        {open && query.trim() && !selected ? (
          <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-border bg-background p-1">
            {loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Carregando CID...</div>
            ) : filtered.length > 0 ? (
              filtered.map((item) => (
                <button
                  key={`${item.code}-${item.description}`}
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => selectItem(item)}
                >
                  <span className="font-medium">{item.code}</span> - {item.description}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum CID encontrado.</div>
            )}
          </div>
        ) : null}

        <div className="mt-3">
          <Button type="button" onClick={handleAdd} disabled={!selected}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar CID
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum CID adicionado.</p>
        ) : (
          value.map((item, index) => (
            <div
              key={`${item.code}-${index}`}
              className="flex items-center justify-between rounded-xl border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {item.code} - {item.description}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeAt(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
