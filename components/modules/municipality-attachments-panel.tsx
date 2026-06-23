"use client"

import { useEffect, useState } from "react"
import { FileText, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type CaseResponse = {
  ok?: boolean
  item?: {
    originProtocol?: string
  }
}

type AttachmentItem = {
  id: string
  nomeArquivo: string
  tamanho: number
  criadoEm: string
  municipioNome: string
  email: string
  url: string
}

function formatSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-BR")
}

export function MunicipalityAttachmentsPanel({ caseId }: { caseId: string }) {
  const [protocol, setProtocol] = useState("")
  const [items, setItems] = useState<AttachmentItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void load()
  }, [caseId])

  async function load() {
    if (!caseId) return

    try {
      setLoading(true)

      let nextProtocol = protocol
      if (!nextProtocol) {
        const caseResponse = await fetch(`/api/judicial/casos/${encodeURIComponent(caseId)}`, { cache: "no-store" })
        const caseJson = (await caseResponse.json().catch(() => ({}))) as CaseResponse
        if (!caseResponse.ok || !caseJson?.ok || !caseJson?.item?.originProtocol) return
        nextProtocol = caseJson.item.originProtocol
        setProtocol(nextProtocol)
      }

      const response = await fetch(`/api/protocolo/${encodeURIComponent(nextProtocol)}/anexos-municipio`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar anexos municipais.")
        return
      }

      setItems(Array.isArray(json.items) ? json.items : [])
    } finally {
      setLoading(false)
    }
  }

  if (!items.length && !loading) return null

  return (
    <Card className="border-border">
      <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Anexos enviados pelo município
        </CardTitle>
        <Button type="button" size="sm" variant="outline" className="bg-transparent" onClick={load} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          {loading ? "Atualizando..." : "Atualizar"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-3">Arquivo</th>
                <th className="px-3 py-3">Município</th>
                <th className="px-3 py-3">Tamanho</th>
                <th className="px-3 py-3">Enviado em</th>
                <th className="px-3 py-3">Opções</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-3 font-medium">{item.nomeArquivo || "Anexo"}</td>
                  <td className="px-3 py-3">{item.municipioNome || "-"}</td>
                  <td className="px-3 py-3">{formatSize(item.tamanho)}</td>
                  <td className="px-3 py-3">{formatDate(item.criadoEm)}</td>
                  <td className="px-3 py-3">
                    {item.url ? (
                      <a className="inline-flex rounded-md border border-border px-3 py-1.5 hover:bg-muted" href={item.url} target="_blank" rel="noreferrer">
                        Abrir anexo
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Sem link</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
