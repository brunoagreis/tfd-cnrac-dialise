"use client"

import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ReportItem = {
  source: string
  id: string
  monitoramentoId: string
  demandaId: string
  protocolo: string
  type: string
  typeLabel: string
  pacienteNome: string
  municipio: string
  valorEstado: number
  valorMunicipio: number
  valorTotal: number
  description: string
  reason: string
  createdByName: string
  createdAt: string
}

type MunicipalityTotal = {
  municipio: string
  valorEstado: number
  valorMunicipio: number
  valorTotal: number
  quantidade: number
}

type ReportResponse = {
  ok: boolean
  totals: {
    estado: number
    municipio: number
    total: number
    bloqueio: number
    sequestro: number
  }
  byMunicipality: MunicipalityTotal[]
  items: ReportItem[]
  error?: string
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function formatDate(value: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-BR")
}

function csvEscape(value: string | number | undefined) {
  const text = String(value ?? "")
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function JudicialBloqueioSequestroPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [report, setReport] = useState<ReportResponse | null>(null)

  useEffect(() => {
    let active = true

    async function loadReport() {
      try {
        setLoading(true)
        setError("")

        const response = await fetch("/api/admin/judicial/bloqueio-sequestro", {
          method: "GET",
          cache: "no-store",
        })

        const json = await response.json().catch(() => ({}))

        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || "Erro ao carregar relatório.")
        }

        if (active) setReport(json as ReportResponse)
      } catch (err) {
        if (!active) return
        console.error("LOAD_BLOQUEIO_SEQUESTRO_REPORT_ERROR", err)
        setError(err instanceof Error ? err.message : "Erro ao carregar relatório.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadReport()

    return () => {
      active = false
    }
  }, [])

  const items = report?.items ?? []
  const byMunicipality = report?.byMunicipality ?? []
  const totals = report?.totals ?? {
    estado: 0,
    municipio: 0,
    total: 0,
    bloqueio: 0,
    sequestro: 0,
  }

  const csv = useMemo(() => {
    const header = [
      "data",
      "tipo",
      "origem",
      "protocolo",
      "paciente",
      "municipio",
      "valor_estado",
      "valor_municipio",
      "valor_total",
      "responsavel",
      "observacao",
    ]

    const rows = items.map((item) => [
      formatDate(item.createdAt),
      item.typeLabel,
      item.source,
      item.protocolo,
      item.pacienteNome,
      item.municipio,
      item.valorEstado.toFixed(2),
      item.valorMunicipio.toFixed(2),
      item.valorTotal.toFixed(2),
      item.createdByName,
      item.reason || item.description,
    ])

    return [header, ...rows]
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n")
  }, [items])

  function exportCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "relatorio-bloqueio-sequestro-judicial.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total geral</CardDescription>
            <CardTitle>{formatMoney(totals.total)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Estado</CardDescription>
            <CardTitle>{formatMoney(totals.estado)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Município</CardDescription>
            <CardTitle>{formatMoney(totals.municipio)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bloqueios</CardDescription>
            <CardTitle>{formatMoney(totals.bloqueio)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sequestros</CardDescription>
            <CardTitle>{formatMoney(totals.sequestro)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo por município</CardTitle>
          <CardDescription>
            Dados alimentados pelas movimentações/finalizações de bloqueio e sequestro do Judicial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando relatório...</p>
          ) : byMunicipality.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum bloqueio ou sequestro localizado.</p>
          ) : (
            byMunicipality.map((item) => (
              <div key={item.municipio} className="rounded-xl border border-border p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{item.municipio}</p>
                    <p className="text-xs text-muted-foreground">{item.quantidade} registro(s)</p>
                  </div>
                  <div className="grid gap-2 text-sm md:grid-cols-3 md:text-right">
                    <span>Estado: {formatMoney(item.valorEstado)}</span>
                    <span>Município: {formatMoney(item.valorMunicipio)}</span>
                    <span className="font-semibold">Total: {formatMoney(item.valorTotal)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Registros</CardTitle>
              <CardDescription>
                Lista individual de bloqueios e sequestros registrados no Judicial.
              </CardDescription>
            </div>
            <Button onClick={exportCsv} disabled={items.length === 0} variant="outline" className="bg-transparent">
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando registros...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro localizado.</p>
          ) : (
            items.map((item) => (
              <div key={`${item.source}-${item.id}`} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={item.type === "bloqueio" ? "default" : "secondary"}>
                    {item.typeLabel}
                  </Badge>
                  <Badge variant="outline">{item.source}</Badge>
                </div>
                <p className="text-sm font-semibold">
                  {item.pacienteNome} • {item.protocolo || item.monitoramentoId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.municipio} • {formatDate(item.createdAt)} • {item.createdByName}
                </p>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded-lg border border-border p-2">
                    Estado: <strong>{formatMoney(item.valorEstado)}</strong>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    Município: <strong>{formatMoney(item.valorMunicipio)}</strong>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    Total: <strong>{formatMoney(item.valorTotal)}</strong>
                  </div>
                </div>
                {(item.reason || item.description) && (
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                    {item.reason || item.description}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
