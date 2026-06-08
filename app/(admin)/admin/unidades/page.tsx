// @ts-nocheck
"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function IconBase({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
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
      {children}
    </svg>
  )
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 8h2a2 2 0 0 1 2 2v11" />
      <path d="M3 21h18" />
      <path d="M8 7h4" />
      <path d="M8 11h4" />
      <path d="M8 15h4" />
    </IconBase>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M21 12a9 9 0 0 1-15.5 6.3" />
      <path d="M3 12A9 9 0 0 1 18.5 5.7" />
      <path d="M18 2v5h-5" />
      <path d="M6 22v-5h5" />
    </IconBase>
  )
}

function ToggleOnIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <rect x="3" y="7" width="18" height="10" rx="5" />
      <circle cx="16" cy="12" r="3" />
    </IconBase>
  )
}

function ToggleOffIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <rect x="3" y="7" width="18" height="10" rx="5" />
      <circle cx="8" cy="12" r="3" />
    </IconBase>
  )
}

type UnidadeRow = {
  id: string
  nome: string
  email: string
  telefone: string
  ativo: boolean
  createdAt?: string
  updatedAt?: string
}

type ApiListResponse = {
  ok: boolean
  unidades?: UnidadeRow[]
  error?: string
}

type ApiMutationResponse = {
  ok: boolean
  unidade?: UnidadeRow
  error?: string
}

const EMPTY_FORM = {
  nome: "",
  email: "",
  telefone: "",
}

export default function UnidadesPage() {
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([] as UnidadeRow[])
  const [form, setForm] = useState(EMPTY_FORM)

  async function loadUnidades(currentSearch = "") {
    try {
      setLoading(true)

      const response = await fetch(
        `/api/admin/unidades?q=${encodeURIComponent(currentSearch)}`,
        {
          cache: "no-store",
        },
      )

      const json: ApiListResponse = await response.json()

      if (!response.ok || !json.ok) {
        toast.error(json.error || "Erro ao carregar unidades.")
        setRows([])
        return
      }

      setRows(Array.isArray(json.unidades) ? json.unidades : [])
    } catch {
      toast.error("Erro ao carregar unidades.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUnidades(search)
  }, [search])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return rows

    return rows.filter((item) => {
      return (
        item.nome.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        (item.telefone || "").toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  function updateForm(field: "nome" | "email" | "telefone", value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
  }

  async function handleCreate() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da unidade.")
      return
    }

    if (!form.email.trim()) {
      toast.error("Informe o e-mail da unidade.")
      return
    }

    try {
      setSaving(true)

      const response = await fetch("/api/admin/unidades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone,
        }),
      })

      const json: ApiMutationResponse = await response.json()

      if (!response.ok || !json.ok || !json.unidade) {
        toast.error(json.error || "Erro ao cadastrar unidade.")
        return
      }

      setRows((prev) => [json.unidade as UnidadeRow, ...prev])
      toast.success("Unidade cadastrada com sucesso.")
      setOpen(false)
      resetForm()
    } catch {
      toast.error("Erro ao cadastrar unidade.")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(unidade: UnidadeRow) {
    try {
      const response = await fetch("/api/admin/unidades", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: unidade.id,
          ativo: !unidade.ativo,
        }),
      })

      const json: ApiMutationResponse = await response.json()

      if (!response.ok || !json.ok || !json.unidade) {
        toast.error(json.error || "Erro ao atualizar unidade.")
        return
      }

      setRows((prev) =>
        prev.map((item) =>
          item.id === unidade.id ? { ...item, ativo: json.unidade!.ativo } : item,
        ),
      )

      toast.success(
        unidade.ativo
          ? "Unidade desativada com sucesso."
          : "Unidade ativada com sucesso.",
      )
    } catch {
      toast.error("Erro ao atualizar unidade.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Unidades
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastro e gerenciamento de unidades com persistência em banco de dados.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void loadUnidades(search)}>
              <RefreshIcon className="mr-2 h-4 w-4" />
              Atualizar
            </Button>

            <Button
              onClick={() => {
                resetForm()
                setOpen(true)
              }}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Nova Unidade
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BuildingIcon className="h-4 w-4" />
              Lista de unidades
            </CardTitle>

            <div className="relative w-full max-w-sm">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
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
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhuma unidade encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>{item.telefone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={item.ativo ? "default" : "destructive"}>
                        {item.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleToggle(item)}
                        aria-label={item.ativo ? "Desativar unidade" : "Ativar unidade"}
                      >
                        {item.ativo ? (
                          <ToggleOnIcon className="h-4 w-4 text-primary" />
                        ) : (
                          <ToggleOffIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Unidade</DialogTitle>
            <DialogDescription>
              Cadastre a unidade usando os campos existentes na tabela unidades.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(event) => updateForm("nome", event.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(event) => updateForm("telefone", event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Salvando..." : "Salvar unidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}