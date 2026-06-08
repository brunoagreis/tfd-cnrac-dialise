// @ts-nocheck
"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function LocalIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a9 9 0 0 1-15.5 6.3" />
      <path d="M3 12A9 9 0 0 1 18.5 5.7" />
      <path d="M18 2v5h-5" />
      <path d="M6 22v-5h5" />
    </svg>
  )
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

type Perfil = {
  id: string
  nome: string
  codigo?: string | null
  ativo?: boolean
}

type PermissaoItem = {
  modulo: string
  acao: string
  permitido: boolean
}

type ApiPerfisResponse = {
  ok?: boolean
  perfis?: Perfil[]
  profiles?: Perfil[]
  error?: string
}

type ApiPerfilResponse = {
  ok?: boolean
  perfil?: Perfil
  profile?: Perfil
  error?: string
}

type ApiPermissoesResponse = {
  ok?: boolean
  permissoes?: PermissaoItem[]
  permissions?: PermissaoItem[]
  error?: string
}

const PERMISSION_CATALOG: Array<{ modulo: string; acoes: string[] }> = [
  {
    modulo: "TFD",
    acoes: [
      "visualizar",
      "criar",
      "editar",
      "excluir",
      "imprimir",
      "interagir",
      "remover_doc",
    ],
  },
  {
    modulo: "PACIENTES",
    acoes: [
      "visualizar",
      "criar",
      "editar",
      "excluir",
      "imprimir",
      "interagir",
      "remover_doc",
    ],
  },
  {
    modulo: "PROTOCOLO",
    acoes: ["visualizar", "criar", "editar", "excluir", "imprimir"],
  },
  {
    modulo: "RELATORIOS",
    acoes: ["visualizar", "imprimir", "exportar"],
  },
  {
    modulo: "JUDICIAL",
    acoes: ["visualizar", "criar", "editar", "encerrar", "interagir", "notificar"],
  },
  {
    modulo: "PRE_JUDICIAL",
    acoes: ["visualizar", "criar", "editar", "encerrar", "interagir", "notificar"],
  },
  {
    modulo: "AGENDAMENTO",
    acoes: ["visualizar", "criar", "editar", "reservar", "imprimir"],
  },
  {
    modulo: "CNRAC",
    acoes: ["visualizar", "criar", "editar", "imprimir"],
  },
  {
    modulo: "HEMODIALISE",
    acoes: ["visualizar", "criar", "editar", "imprimir"],
  },
  {
    modulo: "USUARIOS",
    acoes: ["visualizar", "criar", "editar", "ativar_inativar"],
  },
  {
    modulo: "UNIDADES",
    acoes: ["visualizar", "criar", "editar", "ativar_inativar"],
  },
  {
    modulo: "PERMISSOES",
    acoes: ["visualizar", "criar_perfil", "editar_permissoes"],
  },
  {
    modulo: "ADMIN_JUDICIAL",
    acoes: ["visualizar", "editar_municipios", "editar_emails", "editar_prioridades"],
  },
]

function prettifyAction(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizePerfil(item: any): Perfil {
  return {
    id: String(item?.id ?? ""),
    nome: String(item?.nome ?? item?.name ?? ""),
    codigo: item?.codigo ?? item?.code ?? null,
    ativo: item?.ativo ?? item?.active ?? true,
  }
}

function normalizePermissions(payload: any): PermissaoItem[] {
  const raw = Array.isArray(payload?.permissoes)
    ? payload.permissoes
    : Array.isArray(payload?.permissions)
      ? payload.permissions
      : []

  return raw
    .map((item: any) => ({
      modulo: String(item?.modulo ?? item?.module ?? "").toUpperCase(),
      acao: String(item?.acao ?? item?.action ?? "").toLowerCase(),
      permitido: Boolean(item?.permitido ?? item?.allowed ?? item?.ativo ?? false),
    }))
    .filter((item: PermissaoItem) => item.modulo && item.acao)
}

function buildDefaultPermissions(): PermissaoItem[] {
  return PERMISSION_CATALOG.flatMap((group) =>
    group.acoes.map((acao) => ({
      modulo: group.modulo,
      acao,
      permitido: false,
    })),
  )
}

function mergePermissions(apiPermissions: PermissaoItem[]) {
  const defaults = buildDefaultPermissions()

  return defaults.map((base) => {
    const found = apiPermissions.find(
      (item) => item.modulo === base.modulo && item.acao === base.acao,
    )

    return found ? found : base
  })
}

function isProtectedProfile(perfil?: Perfil | null) {
  if (!perfil) return false

  const nome = (perfil.nome || "").trim().toLowerCase()
  const codigo = (perfil.codigo || "").trim().toLowerCase()

  return nome === "administrador" || codigo === "admin"
}

export default function PermissoesPage() {
  const [loadingPerfis, setLoadingPerfis] = useState(true)
  const [loadingPermissoes, setLoadingPermissoes] = useState(false)
  const [savingPerfil, setSavingPerfil] = useState(false)
  const [savingPermissoes, setSavingPermissoes] = useState(false)

  const [perfis, setPerfis] = useState([] as Perfil[])
  const [perfilId, setPerfilId] = useState("")
const [permissoes, setPermissoes] = useState(
  buildDefaultPermissions() as PermissaoItem[],
)

  const [openCreateModal, setOpenCreateModal] = useState(false)
  const [openPermissionsModal, setOpenPermissionsModal] = useState(false)

  const [novoPerfilNome, setNovoPerfilNome] = useState("")
  const [novoPerfilCodigo, setNovoPerfilCodigo] = useState("")

const perfilSelecionado = useMemo(
  () => perfis.find((item: Perfil) => item.id === perfilId) ?? null,
  [perfis, perfilId],
)

  const permissoesAgrupadas = useMemo(() => {
    return PERMISSION_CATALOG.map((group) => ({
      modulo: group.modulo,
      items: group.acoes.map((acao) => {
const found = permissoes.find(
  (item: PermissaoItem) =>
    item.modulo === group.modulo && item.acao === acao,
)

        return (
          found ?? {
            modulo: group.modulo,
            acao,
            permitido: false,
          }
        )
      }),
    }))
  }, [permissoes])

  const totalPermissoes = permissoes.length
const totalMarcadas = permissoes.filter((item: PermissaoItem) => item.permitido).length

  async function loadPerfis() {
    try {
      setLoadingPerfis(true)

      const response = await fetch("/api/admin/perfis", {
        cache: "no-store",
      })

      const json: ApiPerfisResponse = await response.json()

      if (!response.ok || json.ok === false) {
        toast.error(json.error || "Erro ao carregar perfis.")
        setPerfis([])
        return
      }

      const lista = Array.isArray(json.perfis)
        ? json.perfis.map(normalizePerfil)
        : Array.isArray(json.profiles)
          ? json.profiles.map(normalizePerfil)
          : []

      setPerfis(lista)

      if (lista.length > 0) {
        setPerfilId((prev: string) => prev || lista[0].id)
      } else {
        setPerfilId("")
      }
    } catch {
      toast.error("Erro ao carregar perfis.")
      setPerfis([])
    } finally {
      setLoadingPerfis(false)
    }
  }

  async function loadPermissoes(currentPerfilId: string) {
    if (!currentPerfilId) {
      setPermissoes(buildDefaultPermissions())
      return
    }

    try {
      setLoadingPermissoes(true)

      const response = await fetch(
        `/api/admin/perfis/${currentPerfilId}/permissoes`,
        {
          cache: "no-store",
        },
      )

      const json: ApiPermissoesResponse = await response.json()

      if (!response.ok || json.ok === false) {
        toast.error(json.error || "Erro ao carregar permissões.")
        setPermissoes(buildDefaultPermissions())
        return
      }

      const apiPermissions = normalizePermissions(json)
      setPermissoes(mergePermissions(apiPermissions))
    } catch {
      toast.error("Erro ao carregar permissões.")
      setPermissoes(buildDefaultPermissions())
    } finally {
      setLoadingPermissoes(false)
    }
  }

  useEffect(() => {
    void loadPerfis()
  }, [])

  useEffect(() => {
    if (!perfilId) return
    void loadPermissoes(perfilId)
  }, [perfilId])

  function togglePermission(modulo: string, acao: string) {
    if (isProtectedProfile(perfilSelecionado)) return

setPermissoes((prev: PermissaoItem[]) =>
  prev.map((item: PermissaoItem) =>
    item.modulo === modulo && item.acao === acao
      ? { ...item, permitido: !item.permitido }
      : item,
  ),
)
  }

  async function handleCreateProfile() {
    if (!novoPerfilNome.trim()) {
      toast.error("Informe o nome do perfil.")
      return
    }

    try {
      setSavingPerfil(true)

      const response = await fetch("/api/admin/perfis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: novoPerfilNome,
          codigo: novoPerfilCodigo || undefined,
        }),
      })

      const json: ApiPerfilResponse = await response.json()

      if (!response.ok || json.ok === false) {
        toast.error(json.error || "Erro ao criar perfil.")
        return
      }

      const perfilCriado = normalizePerfil(json.perfil ?? json.profile)

      setPerfis((prev) => [perfilCriado, ...prev])
      setPerfilId(perfilCriado.id)
      setOpenCreateModal(false)
      setNovoPerfilNome("")
      setNovoPerfilCodigo("")
      setPermissoes(buildDefaultPermissions())
      toast.success("Perfil criado com sucesso.")
    } catch {
      toast.error("Erro ao criar perfil.")
    } finally {
      setSavingPerfil(false)
    }
  }

  async function handleSavePermissions() {
    if (!perfilId) {
      toast.error("Selecione um perfil.")
      return
    }

    if (isProtectedProfile(perfilSelecionado)) {
      toast.error("As permissões do Administrador não podem ser alteradas.")
      return
    }

    try {
      setSavingPermissoes(true)

      const response = await fetch(`/api/admin/perfis/${perfilId}/permissoes`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          permissoes,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || json?.ok === false) {
        toast.error(json?.error || "Erro ao salvar permissões.")
        return
      }

      toast.success("Permissões salvas com sucesso.")
      setOpenPermissionsModal(false)
    } catch {
      toast.error("Erro ao salvar permissões.")
    } finally {
      setSavingPermissoes(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Gerenciar Permissões
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie perfis e configure as permissões por módulo e ação com
              persistência no banco.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void loadPerfis()}>
              <RefreshIcon className="mr-2 h-4 w-4" />
              Atualizar
            </Button>

            <Button onClick={() => setOpenCreateModal(true)}>
              <LocalIcon className="mr-2 h-4 w-4" />
              Novo Perfil
            </Button>

            <Button
              variant="default"
              disabled={!perfilSelecionado}
              onClick={() => setOpenPermissionsModal(true)}
            >
              <ShieldIcon className="mr-2 h-4 w-4" />
              Editar Permissões
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Perfil selecionado</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="w-full max-w-md">
              <Label className="mb-2 block">Perfil</Label>
              <Select
                value={perfilId}
                onValueChange={setPerfilId}
                disabled={loadingPerfis || perfis.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>

                <SelectContent>
                  {perfis.map((perfil) => (
                    <SelectItem key={perfil.id} value={perfil.id}>
                      {perfil.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {perfilSelecionado?.codigo ? (
                <Badge variant="outline">{perfilSelecionado.codigo}</Badge>
              ) : null}

              <Badge
                variant={
                  isProtectedProfile(perfilSelecionado) ? "default" : "secondary"
                }
              >
                {isProtectedProfile(perfilSelecionado) ? "Protegido" : "Editável"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Módulos
              </div>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {PERMISSION_CATALOG.length}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Permissões marcadas
              </div>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {totalMarcadas}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Total de ações
              </div>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {totalPermissoes}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldIcon className="h-4 w-4" />
            Visão geral das permissões
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {permissoesAgrupadas.map((group) => {
            const enabledCount = group.items.filter((item) => item.permitido).length

            return (
              <div
                key={group.modulo}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{group.modulo}</h3>
                  <Badge variant="secondary">
                    {enabledCount}/{group.items.length}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <Badge
                      key={`${item.modulo}_${item.acao}`}
                      variant={item.permitido ? "default" : "outline"}
                    >
                      {prettifyAction(item.acao)}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar novo perfil</DialogTitle>
            <DialogDescription>
              Cadastre um perfil para depois configurar as permissões dele.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="perfil-nome">Nome do perfil</Label>
              <Input
                id="perfil-nome"
                value={novoPerfilNome}
                onChange={(event) => setNovoPerfilNome(event.target.value)}
                placeholder="Ex.: Auditor, Coordenador, Apoio"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="perfil-codigo">Código do perfil</Label>
              <Input
                id="perfil-codigo"
                value={novoPerfilCodigo}
                onChange={(event) =>
                  setNovoPerfilCodigo(event.target.value.toUpperCase())
                }
                placeholder="Ex.: AUDITOR"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenCreateModal(false)
                setNovoPerfilNome("")
                setNovoPerfilCodigo("")
              }}
            >
              Cancelar
            </Button>

            <Button
              onClick={() => void handleCreateProfile()}
              disabled={savingPerfil}
            >
              {savingPerfil ? "Salvando..." : "Criar perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openPermissionsModal} onOpenChange={setOpenPermissionsModal}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Editar permissões{" "}
              {perfilSelecionado ? `- ${perfilSelecionado.nome}` : ""}
            </DialogTitle>
            <DialogDescription>
              Marque ou desmarque as permissões por módulo e ação.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto pr-2">
            <div className="grid gap-4">
              {permissoesAgrupadas.map((group) => (
                <div
                  key={group.modulo}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">
                      {group.modulo}
                    </h3>
                    <Badge variant="secondary">
                      {group.items.filter((item) => item.permitido).length}/
                      {group.items.length}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {group.items.map((item) => (
                      <label
                        key={`${item.modulo}_${item.acao}`}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                      >
                        <span className="text-sm text-foreground">
                          {prettifyAction(item.acao)}
                        </span>

                        <input
                          type="checkbox"
                          checked={item.permitido}
                          disabled={isProtectedProfile(perfilSelecionado)}
                          onChange={() => togglePermission(item.modulo, item.acao)}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            {isProtectedProfile(perfilSelecionado) ? (
              <p className="mr-auto text-sm text-muted-foreground">
                As permissões do Administrador não podem ser alteradas.
              </p>
            ) : null}

            <Button
              variant="outline"
              onClick={() => setOpenPermissionsModal(false)}
            >
              Fechar
            </Button>

            <Button
              onClick={() => void handleSavePermissions()}
              disabled={
                savingPermissoes || isProtectedProfile(perfilSelecionado)
              }
            >
              <SaveIcon className="mr-2 h-4 w-4" />
              {savingPermissoes ? "Salvando..." : "Salvar permissões"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loadingPermissoes ? (
        <div className="text-sm text-muted-foreground">
          Carregando permissões...
        </div>
      ) : null}
    </div>
  )
}
