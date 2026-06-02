"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Pencil,
  RefreshCw,
  Search,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  UserPlus,
} from "lucide-react"

import { UsuariosSolicitacoesAcesso } from "@/components/modules/usuarios-solicitacoes-acesso"
import { useAuth } from "@/lib/auth-context"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type UiUser = {
  id: string
  nome: string
  email: string
  role: string
  perfilCodigo?: string | null
  perfilNome?: string | null
  ativo: boolean
  unidadeId?: string | null
  unidadeNome?: string | null
  telefone?: string | null
  cargo?: string | null
}

type UnidadeOption = {
  id: string
  nome: string
}

type PerfilOption = {
  id: string
  nome: string
  codigo: string
  ativo: boolean
}

type NewUserForm = {
  nome: string
  email: string
  telefone: string
  cargo: string
  senha: string
  perfilCodigo: string
  unidadeId: string
}

const EMPTY_FORM: NewUserForm = {
  nome: "",
  email: "",
  telefone: "",
  cargo: "",
  senha: "",
  perfilCodigo: "",
  unidadeId: "",
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function normalizeAuthRole(value: unknown) {
  const raw = normalizeCode(value)

  if (raw === "ADMIN" || raw === "ADMINISTRADOR") return "ADMIN"
  if (raw === "JUDICIAL" || raw === "MEDICO" || raw === "MEDICO_SES") {
    return "MEDICO"
  }
  if (raw === "PRE_JUDICIAL" || raw === "OPERADOR") return "OPERADOR"
  if (raw === "UNIDADE" || raw === "UNIDADE_HOSPITALAR") return "UNIDADE"

  return raw
}

function isUnitProfile(value: unknown) {
  const code = normalizeCode(value)

  return code === "UNIDADE" || code === "UNIDADE_HOSPITALAR"
}

function normalizeUser(item: any): UiUser {
  const perfilCodigo = normalizeCode(
    item?.perfilCodigo || item?.role || item?.perfil?.codigo,
  )

  return {
    id: String(item?.id ?? ""),
    nome: String(item?.nome ?? ""),
    email: String(item?.email ?? ""),
    role: perfilCodigo,
    perfilCodigo,
    perfilNome: item?.perfilNome ? String(item.perfilNome) : null,
    ativo: item?.ativo !== false,
    unidadeId: item?.unidadeId ?? null,
    unidadeNome: item?.unidadeNome ?? item?.unidade?.nome ?? null,
    telefone: item?.telefone ?? null,
    cargo: item?.cargo ?? null,
  }
}

export default function UsuariosPage() {
  const { user } = useAuth()

  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [users, setUsers] = useState<UiUser[]>([])
  const [unidades, setUnidades] = useState<UnidadeOption[]>([])
  const [perfis, setPerfis] = useState<PerfilOption[]>([])
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM)

  const [editRoleOpen, setEditRoleOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UiUser | null>(null)
  const [editPerfilCodigo, setEditPerfilCodigo] = useState("")
  const [editUnidadeId, setEditUnidadeId] = useState("")
  const [savingRole, setSavingRole] = useState(false)

  const currentUserRole = normalizeAuthRole(user?.role)
  const isAdmin = currentUserRole === "ADMIN"

  const perfilLabelMap = useMemo(() => {
    return new Map(perfis.map((perfil) => [perfil.codigo, perfil.nome]))
  }, [perfis])

  function getPerfilLabel(item: UiUser) {
    const codigo = normalizeCode(item.perfilCodigo || item.role)

    return item.perfilNome || perfilLabelMap.get(codigo) || codigo || "-"
  }

  async function loadUsers(currentSearch = "") {
    try {
      setLoading(true)

      const response = await fetch(
        `/api/admin/usuarios?q=${encodeURIComponent(currentSearch)}`,
        { cache: "no-store" },
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        setUsers([])
        toast.error(json?.error ?? "Erro ao carregar usuários.")
        return
      }

      const rawUsers = Array.isArray(json.users) ? json.users : []
      setUsers(rawUsers.map(normalizeUser))
    } catch {
      setUsers([])
      toast.error("Erro ao carregar usuários.")
    } finally {
      setLoading(false)
    }
  }

  async function loadUnidades() {
    try {
      const response = await fetch("/api/admin/unidades", {
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        setUnidades([])
        return
      }

      setUnidades(
        Array.isArray(json.unidades)
          ? json.unidades.map((item: any) => ({
              id: String(item.id),
              nome: String(item.nome),
            }))
          : [],
      )
    } catch {
      setUnidades([])
    }
  }

  async function loadPerfis() {
    try {
      const response = await fetch("/api/admin/perfis", {
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        setPerfis([])
        return
      }

      setPerfis(
        Array.isArray(json.perfis)
          ? json.perfis
              .filter((item: any) => item.ativo !== false)
              .map((item: any) => ({
                id: String(item.id),
                nome: String(item.nome),
                codigo: normalizeCode(item.codigo),
                ativo: item.ativo !== false,
              }))
          : [],
      )
    } catch {
      setPerfis([])
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }

    void loadUsers(search)
  }, [search, isAdmin])

  useEffect(() => {
    if (!isAdmin) return

    void loadUnidades()
    void loadPerfis()
  }, [isAdmin])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return users

    return users.filter((item) => {
      return (
        item.nome.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        getPerfilLabel(item).toLowerCase().includes(q) ||
        (item.unidadeNome ?? "").toLowerCase().includes(q)
      )
    })
  }, [users, search, perfilLabelMap])

  function updateForm<K extends keyof NewUserForm>(
    field: K,
    value: NewUserForm[K],
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
  }

  function closeEditRoleModal() {
    setEditRoleOpen(false)
    setEditingUser(null)
    setEditPerfilCodigo("")
    setEditUnidadeId("")
  }

  function openEditRole(targetUser: UiUser) {
    const perfilCodigo = normalizeCode(targetUser.perfilCodigo || targetUser.role)

    setEditingUser(targetUser)
    setEditPerfilCodigo(perfilCodigo)
    setEditUnidadeId(targetUser.unidadeId ?? "")
    setEditRoleOpen(true)
  }

  async function handleCreateUser() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do usuário.")
      return
    }

    if (!form.email.trim()) {
      toast.error("Informe o e-mail do usuário.")
      return
    }

    if (!form.senha.trim() || form.senha.trim().length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (!form.perfilCodigo) {
      toast.error("Selecione o perfil do usuário.")
      return
    }

    if (isUnitProfile(form.perfilCodigo) && !form.unidadeId) {
      toast.error("Selecione a unidade do usuário.")
      return
    }

    try {
      setSaving(true)

      const response = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone || null,
          cargo: form.cargo || null,
          senha: form.senha,
          perfilCodigo: form.perfilCodigo,
          role: form.perfilCodigo,
          unidadeId: isUnitProfile(form.perfilCodigo) ? form.unidadeId : null,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok || !json?.user) {
        toast.error(json?.error ?? "Erro ao criar usuário.")
        return
      }

      setUsers((prev) => [normalizeUser(json.user), ...prev])
      toast.success("Usuário cadastrado com sucesso.")
      setShowForm(false)
      resetForm()
    } catch {
      toast.error("Erro ao criar usuário.")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(targetUser: UiUser) {
    try {
      const response = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: targetUser.id,
          ativo: !targetUser.ativo,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok || !json?.user) {
        toast.error(json?.error ?? "Erro ao atualizar usuário.")
        return
      }

      const normalized = normalizeUser(json.user)

      setUsers((prev) =>
        prev.map((item) => (item.id === targetUser.id ? normalized : item)),
      )

      toast.success(
        !targetUser.ativo
          ? "Usuário ativado com sucesso."
          : "Usuário desativado com sucesso.",
      )
    } catch {
      toast.error("Erro ao atualizar usuário.")
    }
  }

  async function handleUpdateRole() {
    if (!editingUser) return

    if (!editPerfilCodigo) {
      toast.error("Selecione o perfil.")
      return
    }

    if (isUnitProfile(editPerfilCodigo) && !editUnidadeId) {
      toast.error("Selecione a unidade do usuário.")
      return
    }

    try {
      setSavingRole(true)

      const response = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingUser.id,
          perfilCodigo: editPerfilCodigo,
          role: editPerfilCodigo,
          unidadeId: isUnitProfile(editPerfilCodigo) ? editUnidadeId : null,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok || !json?.user) {
        toast.error(json?.error ?? "Erro ao alterar perfil do usuário.")
        return
      }

      const normalized = normalizeUser(json.user)

      setUsers((prev) =>
        prev.map((item) => (item.id === editingUser.id ? normalized : item)),
      )

      toast.success("Perfil do usuário alterado com sucesso.")
      closeEditRoleModal()
    } catch {
      toast.error("Erro ao alterar perfil do usuário.")
    } finally {
      setSavingRole(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            Acesso restrito
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Somente administradores podem gerenciar usuários.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Perfil atual detectado: {String(user?.role ?? "não informado")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <UsuariosSolicitacoesAcesso />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Gerenciar Usuários
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre, ative, desative e altere perfis de usuários com
              persistência real em banco de dados.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void loadUsers(search)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>

            <Button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail, perfil ou unidade..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-card-foreground">
                      {item.nome}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {item.email}
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getPerfilLabel(item)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {item.unidadeNome ?? "-"}
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge
                        variant={item.ativo ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {item.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={item.id === user?.id}
                          onClick={() => openEditRole(item)}
                          aria-label="Alterar perfil"
                          title={
                            item.id === user?.id
                              ? "Não altere seu próprio perfil por segurança."
                              : "Alterar perfil"
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={item.id === user?.id}
                          onClick={() => void handleToggleActive(item)}
                          aria-label={
                            item.ativo ? "Desativar usuário" : "Ativar usuário"
                          }
                        >
                          {item.ativo ? (
                            <ToggleRight className="h-4 w-4 text-primary" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={editRoleOpen}
        onOpenChange={(open) => {
          setEditRoleOpen(open)

          if (!open) {
            closeEditRoleModal()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar perfil do usuário</DialogTitle>
            <DialogDescription>
              Altere o perfil administrativo do usuário. A mudança passa a valer
              no próximo login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium text-foreground">
                {editingUser?.nome}
              </p>
              <p className="text-muted-foreground">{editingUser?.email}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Perfil</Label>
              <Select
                value={editPerfilCodigo}
                onValueChange={(value) => {
                  setEditPerfilCodigo(value)

                  if (!isUnitProfile(value)) {
                    setEditUnidadeId("")
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>

                <SelectContent>
                  {perfis.length === 0 ? (
                    <SelectItem value="__sem_perfis__" disabled>
                      Nenhum perfil ativo cadastrado
                    </SelectItem>
                  ) : (
                    perfis.map((perfil) => (
                      <SelectItem key={perfil.id} value={perfil.codigo}>
                        {perfil.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {isUnitProfile(editPerfilCodigo) && (
              <div className="flex flex-col gap-1.5">
                <Label>Unidade vinculada</Label>
                <Select
                  value={editUnidadeId}
                  onValueChange={(value) => setEditUnidadeId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>

                  <SelectContent>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeEditRoleModal}
              disabled={savingRole}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={() => void handleUpdateRole()}
              disabled={savingRole}
            >
              {savingRole ? "Salvando..." : "Salvar perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open)

          if (!open) {
            resetForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
<DialogDescription>
  Selecione o perfil cadastrado em Administração &gt; Permissões.
</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="usuario-nome">Nome completo</Label>
              <Input
                id="usuario-nome"
                value={form.nome}
                onChange={(event) => updateForm("nome", event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="usuario-email">E-mail</Label>
              <Input
                id="usuario-email"
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="usuario-telefone">Telefone</Label>
              <Input
                id="usuario-telefone"
                value={form.telefone}
                onChange={(event) => updateForm("telefone", event.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="usuario-cargo">Cargo</Label>
              <Input
                id="usuario-cargo"
                value={form.cargo}
                onChange={(event) => updateForm("cargo", event.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Perfil</Label>
              <Select
                value={form.perfilCodigo}
                onValueChange={(value) => {
                  updateForm("perfilCodigo", value)

                  if (!isUnitProfile(value)) {
                    updateForm("unidadeId", "")
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>

                <SelectContent>
                  {perfis.length === 0 ? (
                    <SelectItem value="__sem_perfis__" disabled>
                      Nenhum perfil ativo cadastrado
                    </SelectItem>
                  ) : (
                    perfis.map((perfil) => (
                      <SelectItem key={perfil.id} value={perfil.codigo}>
                        {perfil.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {isUnitProfile(form.perfilCodigo) && (
              <div className="flex flex-col gap-1.5">
                <Label>Unidade vinculada</Label>
                <Select
                  value={form.unidadeId}
                  onValueChange={(value) => updateForm("unidadeId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>

                  <SelectContent>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="usuario-senha">Senha</Label>
              <Input
                id="usuario-senha"
                type="password"
                value={form.senha}
                onChange={(event) => updateForm("senha", event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={() => void handleCreateUser()}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}