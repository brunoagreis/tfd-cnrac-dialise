"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, MailCheck, RefreshCcw, Search, Send } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type EmailDispatchItem = {
  nomePaciente: string
  processo: string
  protocolo: string
  modulo: string
  municipio: string
  status: "enviado" | "nao_enviado"
  statusLabel: string
  enviadoEm: string | null
  ultimaTentativaEm: string | null
  erro: string
}

type Filters = {
  nome: string
  processo: string
  protocolo: string
  status: string
  dataInicio: string
  dataFim: string
}

const emptyFilters: Filters = {
  nome: "",
  processo: "",
  protocolo: "",
  status: "",
  dataInicio: "",
  dataFim: "",
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleString("pt-BR")
}

function moduleLabel(value: string) {
  const labels: Record<string, string> = {
    tfd: "TFD",
    cnrac: "CNRAC",
    hemodialise: "Hemodiálise",
    judicial: "Judicial",
    pre_judicial: "Pré Judicial",
  }
  return labels[value] ?? value.toUpperCase()
}

export default function JudicialEmailsEnviosPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [items, setItems] = useState<EmailDispatchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const selectedProtocols = useMemo(
    () => Object.entries(selected).filter(([, checked]) => checked).map(([protocolo]) => protocolo),
    [selected],
  )

  useEffect(() => {
    void loadItems()
  }, [])

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar o controle de envios.</div>
  }

  function updateFilter(field: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function buildParams() {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    return params
  }

  async function loadItems() {
    try {
      setLoading(true)
      const params = buildParams()
      const response = await fetch(`/api/admin/judicial/emails-envios?${params.toString()}`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar envios.")
        return
      }

      const nextItems = Array.isArray(json.items) ? json.items : []
      setItems(nextItems)
      setSelected({})
    } finally {
      setLoading(false)
    }
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected({})
      return
    }

    const next: Record<string, boolean> = {}
    for (const item of items) next[item.protocolo] = true
    setSelected(next)
  }

  async function resend(protocolos: string[], allFiltered = false) {
    if (!allFiltered && protocolos.length === 0) {
      toast.error("Selecione ao menos um protocolo.")
      return
    }

    try {
      setSending(true)
      const response = await fetch("/api/admin/judicial/emails-envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolos, allFiltered, filters }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao reenviar e-mails.")
        return
      }

      toast.success(`${json.total ?? protocolos.length} e-mail(s) processado(s).`)
      await loadItems()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Controle de envios de e-mail</h1>
          <p className="text-sm text-muted-foreground">Acompanhe se o e-mail de cadastro foi enviado para cada protocolo e reenvie quando necessário.</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/judicial">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div>
            <Label className="mb-1 block text-xs">Nome do paciente</Label>
            <Input value={filters.nome} onChange={(event) => updateFilter("nome", event.target.value)} placeholder="Nome" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Processo</Label>
            <Input value={filters.processo} onChange={(event) => updateFilter("processo", event.target.value)} placeholder="Processo" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Protocolo</Label>
            <Input value={filters.protocolo} onChange={(event) => updateFilter("protocolo", event.target.value)} placeholder="JUD-..." />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Status</Label>
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="enviado">Enviado</option>
              <option value="nao_enviado">Não enviado</option>
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Data início</Label>
            <Input type="date" value={filters.dataInicio} onChange={(event) => updateFilter("dataInicio", event.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Data fim</Label>
            <Input type="date" value={filters.dataFim} onChange={(event) => updateFilter("dataFim", event.target.value)} />
          </div>

          <div className="flex gap-2 md:col-span-3 lg:col-span-6">
            <Button type="button" onClick={loadItems} disabled={loading}>
              <Search className="mr-2 h-4 w-4" /> {loading ? "Buscando..." : "Pesquisar"}
            </Button>
            <Button type="button" variant="outline" className="bg-transparent" onClick={() => setFilters(emptyFilters)}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MailCheck className="h-4 w-4" /> Protocolos
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{items.length} protocolo(s) encontrado(s). {selectedProtocols.length} selecionado(s).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="bg-transparent" onClick={() => resend(selectedProtocols)} disabled={sending || selectedProtocols.length === 0}>
              <Send className="mr-2 h-4 w-4" /> Reenviar selecionados
            </Button>
            <Button type="button" onClick={() => resend([], true)} disabled={sending || items.length === 0}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Reenviar todos filtrados
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={items.length > 0 && selectedProtocols.length === items.length} onChange={(event) => toggleAll(event.target.checked)} />
                  </th>
                  <th className="px-3 py-3">Nome do paciente</th>
                  <th className="px-3 py-3">Processo</th>
                  <th className="px-3 py-3">Protocolo</th>
                  <th className="px-3 py-3">Módulo</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Data do envio</th>
                  <th className="px-3 py-3">Opções</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Carregando...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum protocolo encontrado.</td></tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.protocolo} className="border-t border-border">
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={Boolean(selected[item.protocolo])} onChange={(event) => setSelected((current) => ({ ...current, [item.protocolo]: event.target.checked }))} />
                      </td>
                      <td className="px-3 py-3 font-medium">{item.nomePaciente || "-"}</td>
                      <td className="px-3 py-3">{item.processo || "-"}</td>
                      <td className="px-3 py-3 font-mono text-xs">{item.protocolo}</td>
                      <td className="px-3 py-3">{moduleLabel(item.modulo)}</td>
                      <td className="px-3 py-3">
                        <Badge variant={item.status === "enviado" ? "default" : "destructive"}>{item.statusLabel}</Badge>
                        {item.erro ? <div className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground" title={item.erro}>{item.erro}</div> : null}
                      </td>
                      <td className="px-3 py-3">{formatDate(item.enviadoEm)}</td>
                      <td className="px-3 py-3">
                        <Button type="button" size="sm" variant="outline" className="bg-transparent" onClick={() => resend([item.protocolo])} disabled={sending}>
                          <Send className="mr-1 h-3.5 w-3.5" /> Reenviar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
