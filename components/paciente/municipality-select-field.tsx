"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type MunicipalityItem = {
  id: string
  municipalityName: string
  emails: string[]
}

function normalize(value: string) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase()
}

export function MunicipalitySelectField({
  value,
  onChange,
  label = "Cidade",
}: {
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const [items, setItems] = useState<MunicipalityItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void fetchMunicipalities()
  }, [])

  const filteredItems = useMemo(() => {
    const q = normalize(value)
    if (!q) return items.slice(0, 20)
    return items
      .filter((item) => normalize(item.municipalityName).includes(q))
      .slice(0, 20)
  }, [items, value])

  async function fetchMunicipalities() {
    try {
      setLoading(true)

      const adminResponse = await fetch("/api/municipios", { cache: "no-store" })
      const adminJson = await adminResponse.json().catch(() => ({}))
      const adminRows = adminResponse.ok && adminJson?.ok && Array.isArray(adminJson?.items) ? adminJson.items : []

      const adminItems = adminRows
        .map((item: any) => ({
          id: String(item?.id ?? item?.municipalityName ?? ""),
          municipalityName: normalize(String(item?.municipalityName ?? "")),
          emails: Array.isArray(item?.emails) ? item.emails : [],
        }))
        .filter((item: MunicipalityItem) => item.municipalityName)

      if (adminItems.length > 0) {
        setItems(adminItems)
        return
      }

      const publicResponse = await fetch("/api/judicial/cadastro", { cache: "no-store" })
      const publicJson = await publicResponse.json().catch(() => ({}))

      const publicRows = publicResponse.ok && publicJson?.ok && Array.isArray(publicJson?.municipios)
        ? publicJson.municipios
            .map((name: unknown) => ({
              id: normalize(String(name ?? "")),
              municipalityName: normalize(String(name ?? "")),
              emails: [],
            }))
            .filter((item: MunicipalityItem) => item.municipalityName)
        : []

      setItems(publicRows)
    } catch (error) {
      console.error("LOAD_MUNICIPALITY_OPTIONS_ERROR", error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <Label className="mb-1 block text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(event) => {
          onChange(normalize(event.target.value))
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Digite e selecione o município cadastrado"
      />

      {open ? (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-background p-1 shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Carregando municípios...</p>
          ) : filteredItems.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum município cadastrado localizado.</p>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(item.municipalityName)
                  setOpen(false)
                }}
              >
                <span className="font-medium">{item.municipalityName}</span>
                {item.emails.length > 0 ? (
                  <span className="block text-xs text-muted-foreground">{item.emails.join(", ")}</span>
                ) : (
                  <span className="block text-xs text-muted-foreground">Sem e-mail cadastrado</span>
                )}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
