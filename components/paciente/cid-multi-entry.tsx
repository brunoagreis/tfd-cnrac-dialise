"use client"

import { useMemo, useState } from "react"
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalog.slice(0, 8)
    return catalog
      .filter((item) => `${item.code} ${item.description}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [catalog, query])

  const selected = catalog.find((item) => item.code === selectedCode)

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
        {filtered.length > 0 && query && (
          <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-border bg-background p-1">
            {filtered.map((item) => (
              <button
                key={`${item.code}-${item.description}`}
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => selectItem(item)}
              >
                <span className="font-medium">{item.code}</span> - {item.description}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          <Button type="button" onClick={handleAdd}>
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