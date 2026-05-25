"use client"

import { useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { usePermissions } from "@/lib/permissions"
import { useStore } from "@/lib/store-context"
import {
  ROLES,
  ACCESS_MODULES,
  ACTIONS,
  ROLE_LABELS,
  ACCESS_MODULE_LABELS,
  ACTION_LABELS,
  type Role,
} from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { ShieldAlert } from "lucide-react"

export default function PermissoesPage() {
  const { user } = useAuth()
  const { matrix, setPermission } = usePermissions()
  const store = useStore()
  const [selectedRole, setSelectedRole] = useState<Role>("ADMIN")

  if (!user || user.role !== "ADMIN") {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-16 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Acesso restrito</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Somente administradores podem gerenciar permissoes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Gerenciar Permissoes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure as permissoes de cada perfil por modulo e acao.
        </p>
      </div>

      {/* Role selector */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-card-foreground">Perfil</CardTitle>
          <CardDescription>
            Selecione o perfil para visualizar e editar suas permissoes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as Role)}
            >
              <SelectTrigger className="w-56" aria-label="Selecionar perfil">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              {selectedRole}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Permission matrix */}
      {ACCESS_MODULES.map((mod) => (
        <Card key={mod} className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-card-foreground">
              {ACCESS_MODULE_LABELS[mod]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Acao</TableHead>
                    <TableHead className="w-24 text-center">Permitido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ACTIONS.map((action) => {
                    const checked = !!matrix[selectedRole]?.[mod]?.[action]
                    const id = `perm-${selectedRole}-${mod}-${action}`
                    return (
                      <TableRow key={action}>
                        <TableCell>
                          <label htmlFor={id} className="text-sm font-medium text-card-foreground cursor-pointer">
                            {ACTION_LABELS[action]}
                          </label>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(v) => {
                              setPermission(selectedRole, mod, action, v === true)
                              toast.success(
                                `${ACTION_LABELS[action]} ${v ? "habilitado" : "desabilitado"} para ${ROLE_LABELS[selectedRole]} em ${ACCESS_MODULE_LABELS[mod]}`,
                              )
                            }}
                            disabled={selectedRole === "ADMIN"}
                            aria-label={`${ACTION_LABELS[action]} - ${ACCESS_MODULE_LABELS[mod]}`}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {selectedRole === "ADMIN" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Permissoes do Administrador nao podem ser alteradas.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Users table - real data from store */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-card-foreground">Usuarios Cadastrados</CardTitle>
          <CardDescription>Listagem de todos os usuarios do sistema ({store.users.length}).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-card-foreground">{u.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{u.cpf}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={u.ativo ? "default" : "destructive"} className="text-xs">
                        {u.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
