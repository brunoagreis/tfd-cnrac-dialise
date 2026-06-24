"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Save, Search } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type EspecialidadeSubItem = {
  especialidadeId: string
  especialidadeNome: string
  subespecialidadeId: string
  subespecialidadeNome: string
  updatedAt: string
}

type SigTapItem = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean
  updatedAt: string
}

const PAGE_SIZE = 10

function normalizeUpper(value: string) {
  return value.toUpperCase()
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "")
}

function pageItems<T>(items: T[], page: number) {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

function totalPages(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE))
}

export function JudicialSigTapAdminPage({ initialTab = "sigtap" }: { initialTab?: "sigtap" | "especialidades" }) {
  const { user } = useAuth()
  const [tab, setTab] = useState(initialTab)

  const [especialidadeItems, setEspecialidadeItems] = useState<EspecialidadeSubItem[]>([])
  const [loadingEspecialidades, setLoadingEspecialidades] = useState(false)
  const [savingEspecialidade, setSavingEspecialidade] = useState(false)
  const [editingEspecialidadeId, setEditingEspecialidadeId] = useState("")
  const [editingSubespecialidadeId, setEditingSubespecialidadeId] = useState("")
  const [especialidadeNome, setEspecialidadeNome] = useState("")
  const [subespecialidadeNome, setSubespecialidadeNome] = useState("")
  const [especialidadePage, setEspecialidadePage] = useState(1)

  const [sigtapItems, setSigTapItems] = useState<SigTapItem[]>([])
  const [loadingSigTap, setLoadingSigTap] = useState(false)
  const [savingSigTap, setSavingSigTap] = useState(false)
  const [editingSigTapId, setEditingSigTapId] = useState("")
  const [sigtapCodigo, setSigTapCodigo] = useState("")
  const [sigtapDescricao, setSigTapDescricao] = useState("")
  const [sigtapSearch, setSigTapSearch] = useState("")
  const [sigtapPage, setSigTapPage] = useState(1)

  const groupedEspecialidades = useMemo(() => {
    const map = new Map<string, { especialidadeId: string; especialidadeNome: string; subs: EspecialidadeSubItem[] }>()
    for (const item of especialidadeItems) {
      const existing = map.get(item.especialidadeId)
      if (existing) existing.subs.push(item)
      else map.set(item.especialidadeId, { especialidadeId: item.especialidadeId, especialidadeNome: item.especialidadeNome, subs: [item] })
    }
    return Array.from(map.values()).sort((a, b) => a.especialidadeNome.localeCompare(b.especialidadeNome, "pt-BR"))
  }, [especialidadeItems])

  const sigtapPages = totalPages(sigtapItems.length)
  const especialidadePages = totalPages(groupedEspecialidades.length)

  useEffect(() => {
    void fetchEspecialidades()
    void fetchSigTap()
  }, [])

  useEffect(() => setSigTapPage(1), [sigtapSearch])

  async function fetchEspecialidades() {
    try {
      setLoadingEspecialidades(true)
      const response = await fetch("/api/admin/judicial/especialidades", { method: "GET", cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar especialidades.")
      setEspecialidadeItems(Array.isArray(json.items) ? json.items : [])
      setEspecialidadePage(1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar especialidades.")
    } finally {
      setLoadingEspecialidades(false)
    }
  }

  async function fetchSigTap() {
    try {
      setLoadingSigTap(true)
      const params = new URLSearchParams()
      if (sigtapSearch.trim()) params.set("q", sigtapSearch.trim())
      const response = await fetch(`/api/admin/judicial/sigtap${params.toString() ? `?${params.toString()}` : ""}`, { method: "GET", cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar SIGTAP.")
      setSigTapItems(Array.isArray(json.items) ? json.items : [])
      setSigTapPage(1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar SIGTAP.")
    } finally {
      setLoadingSigTap(false)
    }
  }

  async function handleSaveSigTap() {
    if (!sigtapCodigo.trim()) return toast.error("Informe o código do SIGTAP.")
    if (!sigtapDescricao.trim()) return toast.error("Informe a descrição do SIGTAP.")
    try {
      setSavingSigTap(true)
      const response = await fetch("/api/admin/judicial/sigtap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingSigTapId || undefined, codigo: sigtapCodigo, descricao: sigtapDescricao }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar SIGTAP.")
      toast.success("SIGTAP salvo com sucesso.")
      setEditingSigTapId("")
      setSigTapCodigo("")
      setSigTapDescricao("")
      await fetchSigTap()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar SIGTAP.")
    } finally {
      setSavingSigTap(false)
    }
  }

  async function handleSaveEspecialidadeSub() {
    if (!especialidadeNome.trim()) return toast.error("Informe a especialidade.")
    if (!subespecialidadeNome.trim()) return toast.error("Informe a subespecialidade.")
    try {
      setSavingEspecialidade(true)
      const response = await fetch("/api/admin/judicial/especialidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          especialidadeId: editingEspecialidadeId || undefined,
          subespecialidadeId: editingSubespecialidadeId || undefined,
          especialidadeNome,
          subespecialidadeNome,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar especialidade e subespecialidade.")
      toast.success("Especialidade e subespecialidade salvas com sucesso.")
      setEditingEspecialidadeId("")
      setEditingSubespecialidadeId("")
      setEspecialidadeNome("")
      setSubespecialidadeNome("")
      await fetchEspecialidades()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar especialidade e subespecialidade.")
    } finally {
      setSavingEspecialidade(false)
    }
  }

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar esta página.</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastro administrativo de SIGTAP</h1>
          <p className="text-sm text-muted-foreground">SIGTAP, especialidade e subespecialidade.</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin Judicial</Link></Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "sigtap" | "especialidades")} className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="sigtap">SIGTAP</TabsTrigger>
          <TabsTrigger value="especialidades">Especialidade / Subespecialidade</TabsTrigger>
        </TabsList>

        <TabsContent value="sigtap" className="mt-0 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card><CardHeader><CardTitle>Cadastro de SIGTAP</CardTitle><CardDescription>O SIGTAP é independente de especialidade e subespecialidade.</CardDescription></CardHeader><CardContent className="space-y-3"><Label>Código</Label><Input value={sigtapCodigo} onChange={(e) => setSigTapCodigo(normalizeDigits(e.target.value))} placeholder="Código do SIGTAP" /><Label>Descrição</Label><Input value={sigtapDescricao} onChange={(e) => setSigTapDescricao(normalizeUpper(e.target.value))} placeholder="Descrição do SIGTAP" /><Button onClick={handleSaveSigTap} disabled={savingSigTap}><Save className="mr-2 h-4 w-4" />{savingSigTap ? "Salvando..." : "Salvar SIGTAP"}</Button></CardContent></Card>
          <Card><CardHeader><CardTitle>SIGTAP cadastrados</CardTitle><CardDescription>Paginado em {PAGE_SIZE} registros por página.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input value={sigtapSearch} onChange={(e) => setSigTapSearch(e.target.value)} placeholder="Buscar SIGTAP" /><Button type="button" variant="outline" onClick={fetchSigTap}><Search className="mr-2 h-4 w-4" />Buscar</Button></div>{loadingSigTap ? <p className="text-sm text-muted-foreground">Carregando...</p> : sigtapItems.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum SIGTAP cadastrado.</p> : <div className="space-y-2">{pageItems(sigtapItems, sigtapPage).map((item) => <button key={item.id} type="button" onClick={() => { setEditingSigTapId(item.id); setSigTapCodigo(item.codigo); setSigTapDescricao(item.descricao) }} className="w-full rounded-xl border p-3 text-left hover:bg-muted/50"><div className="font-medium">{item.codigo} - {item.descricao}</div></button>)}</div>}<Pagination page={sigtapPage} pages={sigtapPages} setPage={setSigTapPage} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="especialidades" className="mt-0 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card><CardHeader><CardTitle>Cadastro conjunto</CardTitle><CardDescription>Cadastre especialidade e subespecialidade no mesmo salvamento.</CardDescription></CardHeader><CardContent className="space-y-3"><Label>Especialidade</Label><Input value={especialidadeNome} onChange={(e) => setEspecialidadeNome(normalizeUpper(e.target.value))} placeholder="Especialidade" /><Label>Subespecialidade</Label><Input value={subespecialidadeNome} onChange={(e) => setSubespecialidadeNome(normalizeUpper(e.target.value))} placeholder="Subespecialidade" /><Button onClick={handleSaveEspecialidadeSub} disabled={savingEspecialidade}><Save className="mr-2 h-4 w-4" />{savingEspecialidade ? "Salvando..." : "Salvar especialidade e subespecialidade"}</Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Especialidades cadastradas</CardTitle><CardDescription>Paginado em {PAGE_SIZE} especialidades por página.</CardDescription></CardHeader><CardContent className="space-y-3">{loadingEspecialidades ? <p className="text-sm text-muted-foreground">Carregando...</p> : groupedEspecialidades.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma especialidade cadastrada.</p> : <div className="space-y-2">{pageItems(groupedEspecialidades, especialidadePage).map((group) => <div key={group.especialidadeId} className="rounded-xl border p-3"><div className="font-semibold">{group.especialidadeNome}</div><div className="mt-2 space-y-2">{group.subs.map((sub) => <button key={sub.subespecialidadeId} type="button" onClick={() => { setEditingEspecialidadeId(sub.especialidadeId); setEditingSubespecialidadeId(sub.subespecialidadeId); setEspecialidadeNome(sub.especialidadeNome); setSubespecialidadeNome(sub.subespecialidadeNome) }} className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50">{sub.subespecialidadeNome}</button>)}</div></div>)}</div>}<Pagination page={especialidadePage} pages={especialidadePages} setPage={setEspecialidadePage} /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Pagination({ page, pages, setPage }: { page: number; pages: number; setPage: (page: number) => void }) {
  return <div className="flex items-center justify-between gap-2 pt-2 text-sm"><span className="text-muted-foreground">Página {page} de {pages}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" className="bg-transparent" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>Anterior</Button><Button type="button" variant="outline" size="sm" className="bg-transparent" disabled={page >= pages} onClick={() => setPage(Math.min(pages, page + 1))}>Próxima</Button></div></div>
}
