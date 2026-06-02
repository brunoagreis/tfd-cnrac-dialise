"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Save, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export default function AdminJudicialSigTapPage() {
  const [especialidadeItems, setEspecialidadeItems] = useState<EspecialidadeSubItem[]>([])
  const [loadingEspecialidades, setLoadingEspecialidades] = useState(false)
  const [savingEspecialidade, setSavingEspecialidade] = useState(false)

  const [editingEspecialidadeId, setEditingEspecialidadeId] = useState("")
  const [editingSubespecialidadeId, setEditingSubespecialidadeId] = useState("")
  const [especialidadeNome, setEspecialidadeNome] = useState("")
  const [subespecialidadeNome, setSubespecialidadeNome] = useState("")

  const [sigtapItems, setSigTapItems] = useState<SigTapItem[]>([])
  const [loadingSigTap, setLoadingSigTap] = useState(false)
  const [savingSigTap, setSavingSigTap] = useState(false)

  const [editingSigTapId, setEditingSigTapId] = useState("")
  const [sigtapCodigo, setSigTapCodigo] = useState("")
  const [sigtapDescricao, setSigTapDescricao] = useState("")
  const [sigtapSearch, setSigTapSearch] = useState("")

  useEffect(() => {
    void fetchEspecialidades()
    void fetchSigTap()
  }, [])

  const groupedEspecialidades = useMemo(() => {
    const map = new Map<
      string,
      {
        especialidadeId: string
        especialidadeNome: string
        subs: EspecialidadeSubItem[]
      }
    >()

    for (const item of especialidadeItems) {
      const key = item.especialidadeId
      const existing = map.get(key)

      if (existing) {
        existing.subs.push(item)
      } else {
        map.set(key, {
          especialidadeId: item.especialidadeId,
          especialidadeNome: item.especialidadeNome,
          subs: [item],
        })
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.especialidadeNome.localeCompare(b.especialidadeNome, "pt-BR"),
    )
  }, [especialidadeItems])

  async function fetchEspecialidades() {
    try {
      setLoadingEspecialidades(true)

      const response = await fetch("/api/admin/judicial/especialidades", {
        method: "GET",
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar especialidades.")
        return
      }

      setEspecialidadeItems(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_ESPECIALIDADES_ERROR", error)
      toast.error("Erro ao carregar especialidades.")
    } finally {
      setLoadingEspecialidades(false)
    }
  }

  async function handleSaveEspecialidadeSub() {
    if (!especialidadeNome.trim()) {
      toast.error("Informe a especialidade.")
      return
    }

    if (!subespecialidadeNome.trim()) {
      toast.error("Informe a subespecialidade.")
      return
    }

    try {
      setSavingEspecialidade(true)

      const response = await fetch("/api/admin/judicial/especialidades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          especialidadeId: editingEspecialidadeId || undefined,
          subespecialidadeId: editingSubespecialidadeId || undefined,
          especialidadeNome,
          subespecialidadeNome,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok || !json?.item) {
        toast.error(json?.error || "Erro ao salvar especialidade e subespecialidade.")
        return
      }

      toast.success("Especialidade e subespecialidade salvas com sucesso.")
      setEditingEspecialidadeId("")
      setEditingSubespecialidadeId("")
      setEspecialidadeNome("")
      setSubespecialidadeNome("")
      await fetchEspecialidades()
    } catch (error) {
      console.error("SAVE_ESPECIALIDADE_SUB_ERROR", error)
      toast.error("Erro ao salvar especialidade e subespecialidade.")
    } finally {
      setSavingEspecialidade(false)
    }
  }

  function loadEspecialidadeSub(item: EspecialidadeSubItem) {
    setEditingEspecialidadeId(item.especialidadeId)
    setEditingSubespecialidadeId(item.subespecialidadeId)
    setEspecialidadeNome(item.especialidadeNome)
    setSubespecialidadeNome(item.subespecialidadeNome)
  }

  async function fetchSigTap() {
    try {
      setLoadingSigTap(true)

      const params = new URLSearchParams()
      if (sigtapSearch.trim()) {
        params.set("q", sigtapSearch.trim())
      }

      const response = await fetch(
        `/api/admin/judicial/sigtap${params.toString() ? `?${params.toString()}` : ""}`,
        {
          method: "GET",
          cache: "no-store",
        },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar SIGTAP.")
        return
      }

      setSigTapItems(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_SIGTAP_ERROR", error)
      toast.error("Erro ao carregar SIGTAP.")
    } finally {
      setLoadingSigTap(false)
    }
  }

  async function handleSaveSigTap() {
    if (!sigtapCodigo.trim()) {
      toast.error("Informe o código do SIGTAP.")
      return
    }

    if (!sigtapDescricao.trim()) {
      toast.error("Informe a descrição do SIGTAP.")
      return
    }

    try {
      setSavingSigTap(true)

      const response = await fetch("/api/admin/judicial/sigtap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingSigTapId || undefined,
          codigo: sigtapCodigo,
          descricao: sigtapDescricao,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok || !json?.item) {
        toast.error(json?.error || "Erro ao salvar SIGTAP.")
        return
      }

      toast.success("SIGTAP salvo com sucesso.")
      setEditingSigTapId("")
      setSigTapCodigo("")
      setSigTapDescricao("")
      await fetchSigTap()
    } catch (error) {
      console.error("SAVE_SIGTAP_ERROR", error)
      toast.error("Erro ao salvar SIGTAP.")
    } finally {
      setSavingSigTap(false)
    }
  }

  function loadSigTap(item: SigTapItem) {
    setEditingSigTapId(item.id)
    setSigTapCodigo(item.codigo)
    setSigTapDescricao(item.descricao)
  }

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Administrador Judicial - SIGTAP
        </h1>
        <p className="text-sm text-muted-foreground">
          Cadastro administrativo de SIGTAP, especialidade e subespecialidade.
        </p>
      </div>

      <Tabs defaultValue="sigtap" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="sigtap">SIGTAP</TabsTrigger>
          <TabsTrigger value="especialidades">Especialidade / Subespecialidade</TabsTrigger>
        </TabsList>

        <TabsContent value="sigtap" className="mt-0 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Cadastro de SIGTAP</CardTitle>
              <CardDescription>
                O SIGTAP é independente de especialidade e subespecialidade.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={sigtapCodigo}
                onChange={(e) => setSigTapCodigo(e.target.value)}
                placeholder="Código do SIGTAP"
              />

              <Input
                value={sigtapDescricao}
                onChange={(e) => setSigTapDescricao(e.target.value)}
                placeholder="Descrição do SIGTAP"
              />

              <Button onClick={handleSaveSigTap} disabled={savingSigTap}>
                <Save className="mr-2 h-4 w-4" />
                {savingSigTap ? "Salvando..." : "Salvar SIGTAP"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SIGTAP cadastrados</CardTitle>
              <CardDescription>Busca por código ou descrição.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={sigtapSearch}
                  onChange={(e) => setSigTapSearch(e.target.value)}
                  placeholder="Buscar SIGTAP"
                />
                <Button type="button" variant="outline" onClick={fetchSigTap}>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </Button>
              </div>

              {loadingSigTap ? (
                <div className="rounded-xl border p-3 text-sm text-muted-foreground">
                  Carregando SIGTAP...
                </div>
              ) : sigtapItems.length === 0 ? (
                <div className="rounded-xl border p-3 text-sm text-muted-foreground">
                  Nenhum SIGTAP cadastrado.
                </div>
              ) : (
                <div className="space-y-2">
                  {sigtapItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => loadSigTap(item)}
                      className="w-full rounded-xl border p-3 text-left hover:bg-muted/50"
                    >
                      <div className="font-medium">
                        {item.codigo} - {item.descricao}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="especialidades"
          className="mt-0 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <Card>
            <CardHeader>
              <CardTitle>Cadastro conjunto</CardTitle>
              <CardDescription>
                Cadastre a especialidade e a subespecialidade no mesmo salvamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={especialidadeNome}
                onChange={(e) => setEspecialidadeNome(e.target.value)}
                placeholder="Especialidade"
              />

              <Input
                value={subespecialidadeNome}
                onChange={(e) => setSubespecialidadeNome(e.target.value)}
                placeholder="Subespecialidade"
              />

              <Button onClick={handleSaveEspecialidadeSub} disabled={savingEspecialidade}>
                <Save className="mr-2 h-4 w-4" />
                {savingEspecialidade ? "Salvando..." : "Salvar especialidade e subespecialidade"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Especialidades cadastradas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingEspecialidades ? (
                <div className="rounded-xl border p-3 text-sm text-muted-foreground">
                  Carregando especialidades...
                </div>
              ) : groupedEspecialidades.length === 0 ? (
                <div className="rounded-xl border p-3 text-sm text-muted-foreground">
                  Nenhuma especialidade cadastrada.
                </div>
              ) : (
                groupedEspecialidades.map((group) => (
                  <div key={group.especialidadeId} className="rounded-xl border p-3">
                    <div className="font-semibold">{group.especialidadeNome}</div>

                    <div className="mt-2 space-y-2">
                      {group.subs.map((sub) => (
                        <button
                          key={sub.subespecialidadeId}
                          type="button"
                          onClick={() => loadEspecialidadeSub(sub)}
                          className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          {sub.subespecialidadeNome}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}