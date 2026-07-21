"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Tab = "assigned" | "unassigned"

type Row = {
  monitoramentoId: string
  protocolo: string
  nomePaciente: string
  cpf: string
  cns: string
  fichaCore?: string
  processoNumeros: string
  pgenetNumeros: string
  sigtapCodigo: string
  sigtapDescricao: string
  cidCodigo: string
  cidDescricao: string
  especialidade: string
  subespecialidade: string
  statusMonitoramentoAtual: string
  usuarioAtribuidoNome: string
  usuarioAtribuidoEmail: string
  origemAtribuicao: string
  atribuidoEm: string
}

type UserRow = {
  id: string
  nome: string
  email: string
}

type Suggestion = {
  value: string
  label: string
}

const filterKeys = ["q", "nome", "cpf", "cns", "processo", "pgenet", "cid", "sigtap", "especialidade", "subespecialidade", "atribuido"] as const
type FilterKey = typeof filterKeys[number]

const emptyFilters = Object.fromEntries(filterKeys.map((key) => [key, ""])) as Record<FilterKey, string>

const suggestionFieldByLabel: Record<string, string> = {
  "Busca geral": "q",
  Nome: "nome",
  CPF: "cpf",
  CNS: "cns",
  Processo: "processo",
  "PGE.net": "pgenet",
  CID: "cid",
  SIGTAP: "sigtap",
  Especialidade: "especialidade",
  Subespecialidade: "subespecialidade",
  "Atribuído para": "atribuido",
}

function formatDate(value: string) {
  if (!value) return "Não informado"

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? "Não informado" : date.toLocaleString("pt-BR")
}

function originLabel(value: string) {
  const key = String(value || "").toUpperCase()

  if (key === "MANUAL") return "Manual"
  if (key === "PRIORIDADE") return "Prioridade"
  if (key === "AUTOMATICA") return "Automática"

  return "Sem origem"
}

export default function JudicialAtribuicaoManualPage() {
  const { user } = useAuth()

  const [tab, setTab] = useState<Tab>("unassigned")
  const [filters, setFilters] = useState<Record<FilterKey, string>>({ ...emptyFilters })
  const [rows, setRows] = useState<Row[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [userId, setUserId] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = Math.min(total, page * pageSize)

  const filterSignature = useMemo(
    () => filterKeys.map((key) => key + ":" + filters[key]).join("|"),
    [filters],
  )

  const visiblePages = useMemo(() => {
    const items: number[] = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, page + 2)

    for (let current = start; current <= end; current++) {
      items.push(current)
    }

    return items
  }, [page, totalPages])

  useEffect(() => {
    void loadUsers()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRows()
    }, 250)

    return () => window.clearTimeout(timer)
  }, [tab, page, pageSize, filterSignature])

  if (!canAccessJudicialAdmin(user)) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Somente administradores podem acessar a atribuição manual.
      </div>
    )
  }

  function setFilter(key: FilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
    setSelected([])
  }

  function clearFilters() {
    setFilters({ ...emptyFilters })
    setPage(1)
    setSelected([])
  }

  function goToPage(nextPage: number) {
    const normalized = Math.min(totalPages, Math.max(1, nextPage))

    setPage(normalized)
    setSelected([])
  }

  async function loadUsers() {
    const response = await fetch("/api/admin/usuarios", {
      cache: "no-store",
      credentials: "include",
    })
    const json = await response.json().catch(() => ({}))

    setUsers(response.ok && json?.ok && Array.isArray(json?.users) ? json.users : [])
  }

  async function loadRows(pageOverride = page) {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        tab,
        page: String(pageOverride),
        pageSize: String(pageSize),
      })

      filterKeys.forEach((key) => {
        if (key === "atribuido" && tab === "unassigned") return

        const value = filters[key].trim()

        if (value) params.set(key, value)
      })

      const response = await fetch(
        "/api/admin/judicial/atribuicao-manual?" + params.toString(),
        {
          cache: "no-store",
          credentials: "include",
        },
      )
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar processos.")
        return
      }

      const nextRows = Array.isArray(json.items) ? json.items : []
      const nextTotal = Number(json.total || 0)
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize))

      setRows(nextRows)
      setTotal(nextTotal)

      if (pageOverride > nextTotalPages) {
        setPage(nextTotalPages)
      }
    } finally {
      setLoading(false)
    }
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  function selectPage() {
    const pageIds = rows.map((row) => row.monitoramentoId)
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id))

    setSelected((current) =>
      allSelected
        ? current.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...current, ...pageIds])),
    )
  }

  async function assign() {
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um processo.")
      return
    }

    if (!userId) {
      toast.error("Selecione um usuário.")
      return
    }

    try {
      setSaving(true)

      const response = await fetch("/api/admin/judicial/atribuicao-manual", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitoramentoIds: selected, usuarioId: userId }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao atribuir.")
        return
      }

      toast.success(String(json.quantidade || selected.length) + " processo(s) atribuído(s).")
      setSelected([])
      await loadRows()
    } finally {
      setSaving(false)
    }
  }

  const paginationControls = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={page <= 1} onClick={() => goToPage(1)}>
        Primeira
      </Button>
      <Button variant="outline" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
        Anterior
      </Button>

      {visiblePages.map((item) => (
        <Button
          key={"manual-page-" + item}
          variant={item === page ? "default" : "outline"}
          onClick={() => goToPage(item)}
        >
          {item}
        </Button>
      ))}

      <Button variant="outline" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
        Próxima
      </Button>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => goToPage(totalPages)}>
        Última
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atribuição manual de processos</h1>
          <p className="text-sm text-muted-foreground">
            Atribua processos atribuídos ou não atribuídos para qualquer usuário do sistema.
          </p>
        </div>

        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/judicial">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros e atribuição</CardTitle>
          <CardDescription>
            Os processos selecionados serão fixados para o usuário escolhido até a conclusão do monitoramento.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tab === "unassigned" ? "default" : "outline"}
              onClick={() => {
                setTab("unassigned")
                setPage(1)
                setSelected([])
              }}
            >
              Não atribuídos
            </Button>
            <Button
              variant={tab === "assigned" ? "default" : "outline"}
              onClick={() => {
                setTab("assigned")
                setPage(1)
                setSelected([])
              }}
            >
              Atribuídos
            </Button>
            <Badge variant="outline">Selecionados: {selected.length}</Badge>
            <Badge variant="outline">Total: {total}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Busca geral" value={filters.q} onChange={(value) => setFilter("q", value)} />
            <Field label="Nome" value={filters.nome} onChange={(value) => setFilter("nome", value)} />
            <Field label="CPF" value={filters.cpf} onChange={(value) => setFilter("cpf", value)} />
            <Field label="CNS" value={filters.cns} onChange={(value) => setFilter("cns", value)} />
            <Field label="Processo" value={filters.processo} onChange={(value) => setFilter("processo", value)} />
            <Field label="PGE.net" value={filters.pgenet} onChange={(value) => setFilter("pgenet", value)} />
            <Field label="CID" value={filters.cid} onChange={(value) => setFilter("cid", value)} />
            <Field label="SIGTAP" value={filters.sigtap} onChange={(value) => setFilter("sigtap", value)} />
            <Field label="Especialidade" value={filters.especialidade} onChange={(value) => setFilter("especialidade", value)} />
            <Field label="Subespecialidade" value={filters.subespecialidade} onChange={(value) => setFilter("subespecialidade", value)} />
            {tab === "assigned" ? (
              <Field label="Atribuído para" value={filters.atribuido} onChange={(value) => setFilter("atribuido", value)} />
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-80 flex-1">
              <Label className="mb-1 block text-xs">Usuário responsável</Label>
              <select
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione qualquer usuário</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome || item.email} {item.email ? "(" + item.email + ")" : ""}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={() => {
                setPage(1)
                setSelected([])
                void loadRows(1)
              }}
              disabled={loading}
            >
              Buscar
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Limpar
            </Button>
            <Button onClick={assign} disabled={saving || selected.length === 0 || !userId}>
              {saving ? "Atribuindo..." : "Atribuir selecionados"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">
                {tab === "assigned" ? "Atribuídos" : "Não atribuídos"}
              </CardTitle>
              <CardDescription>
                Exibindo {pageStart} a {pageEnd} de {total} registro(s) • Página {page} de {totalPages}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={selectPage} disabled={rows.length === 0}>
                Selecionar página
              </Button>

              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                  setSelected([])
                }}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={10}>10 por página</option>
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>

              {paginationControls}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando...</div>
          ) : null}

          {!loading && rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Nenhum processo encontrado.</div>
          ) : null}

          {!loading &&
            rows.map((row) => (
              <div key={row.monitoramentoId} className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.monitoramentoId)}
                        onChange={() => toggle(row.monitoramentoId)}
                      />
                      <span className="font-mono text-sm font-semibold">{row.protocolo}</span>
                      <Badge variant="outline">{originLabel(row.origemAtribuicao)}</Badge>
                      {row.usuarioAtribuidoNome ? (
                        <Badge variant="secondary">{row.usuarioAtribuidoNome}</Badge>
                      ) : (
                        <Badge variant="outline">Sem atribuição</Badge>
                      )}
                    </div>

                    <p className="text-lg font-semibold">{row.nomePaciente}</p>
                    <p className="text-sm text-muted-foreground">
                      CPF: {row.cpf || "Não informado"} | CNS: {row.cns || "Não informado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Processo: {row.processoNumeros || row.protocolo || "Não informado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PGE.net: {row.pgenetNumeros || "Não informado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      CID: {row.cidCodigo || "-"}{row.cidDescricao ? " - " + row.cidDescricao : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      SIGTAP: {row.sigtapCodigo || "-"}{row.sigtapDescricao ? " - " + row.sigtapDescricao : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Especialidade: {row.especialidade || "-"} | Subespecialidade: {row.subespecialidade || "-"}
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground lg:w-64">
                    <p>Status: {row.statusMonitoramentoAtual || "Não informado"}</p>
                    <p>Atribuído em: {formatDate(row.atribuidoEm)}</p>
                    <p>E-mail: {row.usuarioAtribuidoEmail || "Não informado"}</p>
                  </div>
                </div>
              </div>
            ))}

          {!loading && total > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Exibindo {pageStart} a {pageEnd} de {total} registro(s)
              </p>
              {paginationControls}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [options, setOptions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const field = suggestionFieldByLabel[label] || "q"

  useEffect(() => {
    const q = value.trim()

    if (q.length < 2) {
      setOptions([])
      setOpen(false)
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)

        const params = new URLSearchParams({ field, q })
        const response = await fetch(
          "/api/admin/judicial/atribuicao-manual/sugestoes?" + params.toString(),
          {
            cache: "no-store",
            credentials: "include",
          },
        )
        const json = await response.json().catch(() => ({}))
        const items = response.ok && json?.ok && Array.isArray(json?.items) ? json.items : []

        setOptions(items)
        setOpen(true)
      } catch (error) {
        console.error("LOAD_MANUAL_ASSIGNMENT_SUGGESTIONS_ERROR", error)
        setOptions([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [field, value])

  return (
    <div className="relative">
      <Label className="mb-1 block text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (options.length > 0) setOpen(true)
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150)
        }}
        placeholder={label}
      />

      {open && value.trim().length >= 2 ? (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-background p-1 shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Carregando...</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma sugestão localizada.</p>
          ) : (
            options.map((item) => (
              <button
                key={field + "-" + item.value + "-" + item.label}
                type="button"
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(item.value)
                  setOpen(false)
                  setOptions([])
                }}
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
