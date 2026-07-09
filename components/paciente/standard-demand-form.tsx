"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/lib/store-context"
import { useAuth } from "@/lib/auth-context"
import type { Module, Paciente } from "@/lib/types"

type SigTapItem = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean
  updatedAt: string
}

type EspecialidadeSubItem = {
  especialidadeId: string
  especialidadeNome: string
  subespecialidadeId: string
  subespecialidadeNome: string
  updatedAt: string
}

type Cid10Item = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean
  createdAt: string
  updatedAt: string
}

function normalizeDigits(value: string) {
  return String(value ?? "").replace(/\D/g, "")
}

function normalizeCidInput(value: string) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, "")
}

function normalizeUpperInput(value: string) {
  return String(value ?? "").toUpperCase()
}

function formatPhone(value: string) {
  const digits = normalizeDigits(value).slice(0, 11)

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
}

function getApiPathByModule(modulo: Module) {
  if (modulo === "tfd") return "/api/tfd/demandas"
  if (modulo === "cnrac") return "/api/cnrac/demandas"
  if (modulo === "hemodialise") return "/api/hemodialise/demandas"
  return null
}

export function StandardDemandForm({
  modulo,
  patient,
  onBack,
  onSaved,
}: {
  modulo: Module
  patient: Paciente
  onBack: () => void
  onSaved: () => void
}) {
  const store = useStore()
  const { user } = useAuth()

  const [localSolicitante, setLocalSolicitante] = useState("")
  const [emailSolicitante, setEmailSolicitante] = useState("")
  const [telefoneSolicitante, setTelefoneSolicitante] = useState([""])

  const [codigoSigtap, setCodigoSigtap] = useState("")
  const [descricaoSigtap, setDescricaoSigtap] = useState("")
  const [cid10, setCid10] = useState("")

  const [especialidade, setEspecialidade] = useState("")
  const [subespecialidade, setSubespecialidade] = useState("")
  const [especialidadeSearchOpen, setEspecialidadeSearchOpen] = useState(false)
  const [subespecialidadeSearchOpen, setSubespecialidadeSearchOpen] = useState(false)

  const [tipoSolicitacao, setTipoSolicitacao] = useState<
    "transito" | "definitiva" | "nao_se_aplica"
  >(modulo === "cnrac" ? "nao_se_aplica" : "transito")

  const [localSolicitado, setLocalSolicitado] = useState("")
  const [observacoesUnidade, setObservacoesUnidade] = useState("")

  const [loadingSigtap, setLoadingSigtap] = useState(false)
  const [sigtapOptions, setSigTapOptions] = useState<SigTapItem[]>([])

  const [loadingCid10, setLoadingCid10] = useState(false)
  const [cid10Options, setCid10Options] = useState<Cid10Item[]>([])

  const [loadingEspecialidades, setLoadingEspecialidades] = useState(false)
  const [especialidadeSubItems, setEspecialidadeSubItems] = useState<EspecialidadeSubItem[]>([])

  const [saving, setSaving] = useState(false)

  const especialidades = useMemo(() => {
    const unique = new Map<string, string>()

    for (const item of especialidadeSubItems) {
      if (!unique.has(item.especialidadeNome)) {
        unique.set(item.especialidadeNome, item.especialidadeId)
      }
    }

    return Array.from(unique.entries())
      .map(([nome, id]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  }, [especialidadeSubItems])

  const subespecialidadesFiltradas = useMemo(() => {
    if (!especialidade) return []

    return especialidadeSubItems
      .filter((item) => item.especialidadeNome === especialidade)
      .sort((a, b) =>
        a.subespecialidadeNome.localeCompare(b.subespecialidadeNome, "pt-BR"),
      )
  }, [especialidadeSubItems, especialidade])

  const especialidadesSugeridas = useMemo(() => {
    const q = especialidade.trim().toLocaleLowerCase("pt-BR")

    if (!q) return especialidades.slice(0, 50)

    return especialidades
      .filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes(q))
      .slice(0, 50)
  }, [especialidades, especialidade])

  const subespecialidadesSugeridas = useMemo(() => {
    const q = subespecialidade.trim().toLocaleLowerCase("pt-BR")

    if (!q) return subespecialidadesFiltradas.slice(0, 50)

    return subespecialidadesFiltradas
      .filter((item) => item.subespecialidadeNome.toLocaleLowerCase("pt-BR").includes(q))
      .slice(0, 50)
  }, [subespecialidadesFiltradas, subespecialidade])

  useEffect(() => {
    void fetchEspecialidades()
  }, [])

  useEffect(() => {
    const normalized = normalizeDigits(codigoSigtap)

    if (!normalized || normalized.length < 2) {
      setSigTapOptions([])
      return
    }

    const timer = setTimeout(() => {
      void fetchSigtap(normalized)
    }, 250)

    return () => clearTimeout(timer)
  }, [codigoSigtap])

  useEffect(() => {
    const normalized = normalizeCidInput(cid10)

    if (!normalized || normalized.length < 2) {
      setCid10Options([])
      return
    }

    const timer = setTimeout(() => {
      void fetchCid10(normalized)
    }, 250)

    return () => clearTimeout(timer)
  }, [cid10])

  async function fetchSigtap(query: string) {
    try {
      setLoadingSigtap(true)

      const params = new URLSearchParams()
      params.set("q", query)
      params.set("limit", "1000")

      const response = await fetch(`/api/admin/judicial/sigtap?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar SIGTAP.")
        return
      }

      setSigTapOptions(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_SIGTAP_STANDARD_DEMAND_ERROR", error)
      toast.error("Erro ao carregar SIGTAP.")
    } finally {
      setLoadingSigtap(false)
    }
  }

  async function fetchCid10(query: string) {
    try {
      setLoadingCid10(true)

      const params = new URLSearchParams()
      params.set("q", query)
      params.set("limit", "1000")

      const response = await fetch(`/api/judicial/cid10?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar CID-10.")
        return
      }

      setCid10Options(
        Array.isArray(json?.items)
          ? json.items
              .map((item: any) => ({
                id: String(item?.id ?? item?.codigo ?? item?.code ?? ""),
                codigo: String(item?.codigo ?? item?.code ?? "").toUpperCase(),
                descricao: String(item?.descricao ?? item?.description ?? "").toUpperCase(),
                ativo: item?.ativo !== false,
                createdAt: String(item?.createdAt ?? ""),
                updatedAt: String(item?.updatedAt ?? ""),
              }))
              .filter((item: Cid10Item) => item.codigo && item.descricao)
          : [],
      )
    } catch (error) {
      console.error("LOAD_CID10_STANDARD_DEMAND_ERROR", error)
      toast.error("Erro ao carregar CID-10.")
    } finally {
      setLoadingCid10(false)
    }
  }

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

      setEspecialidadeSubItems(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_ESPECIALIDADES_STANDARD_DEMAND_ERROR", error)
      toast.error("Erro ao carregar especialidades.")
    } finally {
      setLoadingEspecialidades(false)
    }
  }

  function selectSigtap(item: SigTapItem) {
    setCodigoSigtap(normalizeDigits(item.codigo))
    setDescricaoSigtap(item.descricao)
    setSigTapOptions([])
  }

  function selectCid10(item: Cid10Item) {
    setCid10(item.codigo)
    setCid10Options([])
  }

  function updatePhone(index: number, value: string) {
    setTelefoneSolicitante((prev) =>
      prev.map((item, i) => (i === index ? formatPhone(value) : item)),
    )
  }

  function addPhone() {
    setTelefoneSolicitante((prev) => [...prev, ""])
  }

  function removePhone(index: number) {
    setTelefoneSolicitante((prev) => prev.filter((_, i) => i !== index))
  }

  function handleEspecialidadeChange(value: string) {
    setEspecialidade(value)
    setSubespecialidade("")
  }

  async function handleSubmit() {
    if (!user) return

    if (!localSolicitante || !codigoSigtap || !descricaoSigtap || !cid10 || !especialidade) {
      toast.error(
        "Campos obrigatórios: Local solicitante, Código SIGTAP, Descrição do procedimento, CID e Especialidade.",
      )
      return
    }

    const apiPath = getApiPathByModule(modulo)

    if (!apiPath) {
      const demanda = store.addDemanda({
        pacienteId: patient.id,
        modulo,
        localSolicitante,
        telefoneSolicitante: telefoneSolicitante.filter(Boolean),
        emailSolicitante,
        codigoSigtap,
        descricaoSigtap,
        cid10,
        especialidade,
        subespecialidade,
        peso: "",
        altura: "",
        tipoSanguineo: "",
        observacoesUnidade,
        tipoSolicitacao,
        localSolicitado,
        acaoJudicial: false,
        criadoPor: user.id,
        criadoPorNome: user.nome,
      })

      toast.success(`Demanda ${demanda.protocolo} cadastrada com sucesso.`)
      onSaved()
      return
    }

    try {
      setSaving(true)

      const response = await fetch(apiPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pacienteId: patient.id,
          localSolicitante,
          telefoneSolicitante: telefoneSolicitante.filter(Boolean),
          emailSolicitante,
          codigoSigtap,
          descricaoSigtap,
          cid10,
          especialidade,
          subespecialidade,
          observacoesUnidade,
          tipoSolicitacao,
          localSolicitado,
          acaoJudicial: false,
          criadoPor: user.id,
          criadoPorNome: user.nome,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(
          json?.error || `Erro ao salvar demanda do módulo ${modulo.toUpperCase()}.`,
        )
        return
      }

      toast.success(`Demanda ${json?.item?.protocolo ?? ""} cadastrada com sucesso.`)
      onSaved()
    } catch (error) {
      console.error(`SAVE_${modulo.toUpperCase()}_DEMANDA_ERROR`, error)
      toast.error(`Erro ao salvar demanda do módulo ${modulo.toUpperCase()}.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cadastro de demanda {modulo.toUpperCase()}
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs">
              Local solicitante <span className="text-destructive">*</span>
            </Label>
            <Input
              value={localSolicitante}
              onChange={(e) => setLocalSolicitante(normalizeUpperInput(e.target.value))}
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">E-mail do solicitante</Label>
            <Input
              value={emailSolicitante}
              onChange={(e) => setEmailSolicitante(e.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label className="mb-1 block text-xs">Telefone(s) do solicitante</Label>

            {telefoneSolicitante.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={phone}
                  onChange={(e) => updatePhone(index, e.target.value)}
                  placeholder="(00) 00000-0000"
                />
                {telefoneSolicitante.length > 1 && (
                  <Button type="button" variant="outline" onClick={() => removePhone(index)}>
                    Remover
                  </Button>
                )}
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addPhone}>
              Adicionar telefone
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="mb-1 block text-xs">
              Código SIGTAP <span className="text-destructive">*</span>
            </Label>
            <Input
              value={codigoSigtap}
              onChange={(e) => {
                setCodigoSigtap(normalizeDigits(e.target.value))
                setDescricaoSigtap("")
              }}
              placeholder="Digite o código SIGTAP"
            />

            {codigoSigtap.trim() ? (
              <div className="max-h-48 overflow-auto rounded-lg border border-border bg-background p-1">
                {loadingSigtap ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Carregando SIGTAP...
                  </p>
                ) : sigtapOptions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum SIGTAP localizado.
                  </p>
                ) : (
                  sigtapOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => selectSigtap(item)}
                    >
                      <span className="font-medium">{item.codigo}</span> - {item.descricao}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div>
            <Label className="mb-1 block text-xs">
              Descrição do procedimento <span className="text-destructive">*</span>
            </Label>
            <Input
              value={descricaoSigtap}
              readOnly
              placeholder="Selecionada automaticamente pelo SIGTAP"
            />
          </div>

          <div className="space-y-2">
            <Label className="mb-1 block text-xs">
              CID <span className="text-destructive">*</span>
            </Label>
            <Input
              value={cid10}
              onChange={(e) => setCid10(normalizeCidInput(e.target.value))}
              placeholder="Digite o CID"
            />

            {cid10.trim() ? (
              <div className="max-h-48 overflow-auto rounded-lg border border-border bg-background p-1">
                {loadingCid10 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Carregando CID-10...
                  </p>
                ) : cid10Options.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum CID-10 localizado.
                  </p>
                ) : (
                  cid10Options.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => selectCid10(item)}
                    >
                      <span className="font-medium">{item.codigo}</span> - {item.descricao}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <Label className="mb-1 block text-xs">
              Especialidade <span className="text-destructive">*</span>
            </Label>
            <Input
              value={especialidade}
              onChange={(e) => {
                handleEspecialidadeChange(e.target.value)
                setEspecialidadeSearchOpen(true)
              }}
              onFocus={() => setEspecialidadeSearchOpen(true)}
              onBlur={() => setTimeout(() => setEspecialidadeSearchOpen(false), 150)}
              placeholder={loadingEspecialidades ? "Carregando..." : "Digite para buscar a especialidade"}
              disabled={loadingEspecialidades}
            />

            {especialidadeSearchOpen && especialidadesSugeridas.length > 0 ? (
              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                {especialidadesSugeridas.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      handleEspecialidadeChange(item.nome)
                      setEspecialidadeSearchOpen(false)
                    }}
                  >
                    {item.nome}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <Label className="mb-1 block text-xs">Sub Especialidade</Label>
            <Input
              value={subespecialidade}
              onChange={(e) => {
                setSubespecialidade(e.target.value)
                setSubespecialidadeSearchOpen(true)
              }}
              onFocus={() => setSubespecialidadeSearchOpen(true)}
              onBlur={() => setTimeout(() => setSubespecialidadeSearchOpen(false), 150)}
              placeholder={
                especialidade
                  ? "Digite para buscar a subespecialidade, se houver"
                  : "Escolha a especialidade primeiro"
              }
              disabled={!especialidade || loadingEspecialidades}
            />

            {especialidade && subespecialidadeSearchOpen && subespecialidadesSugeridas.length > 0 ? (
              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                {subespecialidadesSugeridas.map((item) => (
                  <button
                    key={item.subespecialidadeId || item.subespecialidadeNome}
                    type="button"
                    className="w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSubespecialidade(item.subespecialidadeNome)
                      setSubespecialidadeSearchOpen(false)
                    }}
                  >
                    {item.subespecialidadeNome}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <Label className="mb-1 block text-xs">Tipo de solicitação</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tipoSolicitacao}
              onChange={(e) =>
                setTipoSolicitacao(
                  e.target.value as "transito" | "definitiva" | "nao_se_aplica",
                )
              }
            >
              {modulo === "cnrac" ? (
                <option value="nao_se_aplica">Não se aplica</option>
              ) : (
                <>
                  <option value="transito">Trânsito</option>
                  <option value="definitiva">Definitiva</option>
                  <option value="nao_se_aplica">Não se aplica</option>
                </>
              )}
            </select>
          </div>

          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs">Local solicitado</Label>
            <Input
              value={localSolicitado}
              onChange={(e) => setLocalSolicitado(normalizeUpperInput(e.target.value))}
            />
          </div>

          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs">Observações</Label>
            <Textarea
              rows={4}
              value={observacoesUnidade}
              onChange={(e) => setObservacoesUnidade(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <span className="font-medium">Campos obrigatórios:</span> Local solicitante, Código SIGTAP, Descrição do procedimento, CID e Especialidade.
      </div>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
          Voltar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? "Salvando..." : "Salvar demanda"}
        </Button>
      </div>
    </div>
  )
}