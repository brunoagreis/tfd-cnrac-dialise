"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus, ShieldAlert, Search, ToggleLeft, ToggleRight } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import {
  ROLE_LABELS,
  userRegistrationSchema,
  type UserRegistrationData,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SUPPORTED_ROLE_OPTIONS = ["ADMIN", "UNIDADE_HOSPITALAR"] as const;

type UiUser = {
  id: string;
  nome: string;
  email: string;
  role: string; // "ADMIN" | "UNIDADE_HOSPITALAR" | ...
  ativo: boolean;
  unidadeId?: string | null;
  cpf?: string | null; // seu front mostra, mas no banco ainda não existe (fica "-")
};

export default function UsuariosPage() {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [users, setUsers] = useState<UiUser[]>([]);
  const [loading, setLoading] = useState(true);

  // --- acesso ---
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
            Somente administradores podem gerenciar usuarios.
          </p>
        </div>
      </div>
    );
  }

  // --- carregar lista ---
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/usuarios?q=${encodeURIComponent(search)}`);
        const data = await res.json();
        if (!alive) return;

        if (!res.ok || !data?.ok) {
          setUsers([]);
          toast.error(data?.error ?? "Falha ao carregar usuários");
          return;
        }

        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch {
        if (!alive) return;
        setUsers([]);
        toast.error("Falha ao carregar usuários");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [search]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      return (
        u.nome.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.cpf ?? "").includes(q)
      );
    });
  }, [users, search]);

  async function createUser(data: UserRegistrationData & { senha: string }) {
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: data.nome,
          email: data.email,
          senha: (data as any).senha,
          role: data.role,
          // cpf/telefone não existem no banco nesse momento (se quiser, a gente cria colunas depois)
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        toast.error(json?.error ?? "Erro ao criar usuário");
        return;
      }

      toast.success("Usuario cadastrado com sucesso");
      setShowForm(false);

      // Recarrega lista
      setSearch((s) => s); // dispara efeito sem mudar valor
      // ou atualiza localmente:
      setUsers((prev) => [json.user as UiUser, ...prev]);
    } catch {
      toast.error("Erro ao criar usuário");
    }
  }

  async function toggleActive(u: UiUser) {
    try {
      const nextStatus = !u.ativo;
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, ativo: nextStatus }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.user) {
        toast.error(json?.error ?? "Erro ao atualizar usuário");
        return;
      }

      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, ativo: json.user.ativo } : item)),
      );
      toast.success(nextStatus ? "Usuario ativado com sucesso" : "Usuario desativado com sucesso");
    } catch {
      toast.error("Erro ao atualizar usuário");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Gerenciar Usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre, ative ou desative usuarios da plataforma.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base text-card-foreground">Usuarios ({users.length})</CardTitle>
              <CardDescription>Todos os usuarios cadastrados no sistema.</CardDescription>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              Novo Usuario
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Buscar por nome, e-mail ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Buscar usuarios"
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Acoes</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum usuario encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-card-foreground">{u.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{u.cpf ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {ROLE_LABELS[u.role as any] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={u.ativo ? "default" : "destructive"} className="text-xs">
                          {u.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(u)}
                          disabled={u.id === user.id}
                          aria-label={u.ativo ? "Desativar usuario" : "Ativar usuario"}
                        >
                          {u.ativo ? (
                            <ToggleRight className="h-4 w-4 text-primary" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UserFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={createUser}
      />
    </div>
  );
}

// ── User registration dialog ───────────────────────────
function UserFormDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UserRegistrationData & { senha: string }) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UserRegistrationData & { senha: string }>({
    resolver: zodResolver(userRegistrationSchema as any),
    defaultValues: {
      nome: "",
      cpf: "",
      email: "",
      telefone: "",
      role: "ADMIN" as any,
      senha: "",
    } as any,
  });

  function handle(data: any) {
    onSubmit(data);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Cadastrar Novo Usuario</DialogTitle>
          <DialogDescription>Preencha os dados para criar um novo usuario. Nesta base atual, o cadastro esta habilitado para Administrador e Unidade Hospitalar.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handle)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-nome">Nome completo</Label>
              <Input id="reg-nome" aria-invalid={!!errors.nome} {...register("nome")} />
              {errors.nome && <p className="text-xs text-destructive" role="alert">{String(errors.nome.message)}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-cpf">CPF</Label>
              <Input id="reg-cpf" placeholder="000.000.000-00" aria-invalid={!!errors.cpf} {...register("cpf")} />
              {errors.cpf && <p className="text-xs text-destructive" role="alert">{String(errors.cpf.message)}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-email">E-mail</Label>
              <Input id="reg-email" type="email" aria-invalid={!!errors.email} {...register("email")} />
              {errors.email && <p className="text-xs text-destructive" role="alert">{String(errors.email.message)}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-tel">Telefone</Label>
              <Input id="reg-tel" placeholder="(00) 00000-0000" aria-invalid={!!errors.telefone} {...register("telefone")} />
              {errors.telefone && <p className="text-xs text-destructive" role="alert">{String(errors.telefone.message)}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-role">Perfil</Label>
              <Controller
                control={control as any}
                name={"role" as any}
                render={({ field }: any) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="reg-role" aria-invalid={!!errors.role}>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && <p className="text-xs text-destructive" role="alert">{String((errors as any).role?.message)}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-senha">Senha</Label>
              <Input id="reg-senha" type="password" aria-invalid={!!(errors as any).senha} {...register("senha" as any)} />
              {(errors as any).senha && <p className="text-xs text-destructive" role="alert">{String((errors as any).senha?.message)}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onClose(); reset(); }}>
              Cancelar
            </Button>
            <Button type="submit">Cadastrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}