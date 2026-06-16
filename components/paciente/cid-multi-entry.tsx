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
  return String(value ?? "").trim()
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
  const [selectedCode, setSelectedCode] = useState("")
  const [remoteCatalog, setRemoteCatalog] = useState<CidCatalogItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/judicial/cid10?q=${encodeURIComponent(query.trim())}&limit=50`, {
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
              description: normalizeText(item?.description ?? item?.descricao),
            }))
            .filter((item: CidCatalogItem) => item.code && item.description),
        )
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
  }, [query])

  const sourceCatalog = remoteCatalog.length > 0 ? remoteCatalog : catalog

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = sourceCatalog.filter((item) => item.code && item.description)
    if (!q) return items.slice(0, 8)
    return items
      .filter((item) => `${item.code} ${item.description}`.toLowerCase().includes(q))
      .slice(0, 20)
  }, [sourceCatalog, query])

  const selected = sourceCatalog.find((item) => item.code === selectedCode)

  function selectItem(item: CidCatalogItem) {
    setSelectedCode(item.code)
    setQuery(`${item.code} - ${item.description}`)
  }

  function handleAdd() {
    if (!selected) return
    onChange([...value, { code: selected.code, description: selected.description }])
    setQuery("")
    setSelectedCode("")
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
            setSelectedCode("")
          }}
          placeholder="Digite o CID ou a descrição"
        />
        {query && (
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
        )}

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
