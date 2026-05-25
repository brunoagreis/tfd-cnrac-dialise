"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuth } from "@/lib/auth-context"
import { useStore } from "@/lib/store-context"
import { PermissionGate } from "@/components/permission-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { unidadeSchema, type UnidadeFormData } from "@/lib/types"
import { Building2, Plus, Search, Copy, Mail, Phone, MapPin } from "lucide-react"
import { copyTextToClipboard } from "@/lib/clipboard"

export default function UnidadesPage() {
  const { user } = useAuth()
  const store = useStore()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UnidadeFormData>({
    resolver: zodResolver(unidadeSchema),
  })

  const filtered = store.unidades.filter(
    (u) =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  )

  const onSubmit = (data: UnidadeFormData) => {
    // Check if email already exists
    const existing = store.unidades.find((u) => u.email.toLowerCase() === data.email.toLowerCase())
    if (existing) {
      toast.error("Ja existe uma unidade com este e-mail")
      return
    }
    store.addUnidade(data)
    toast.success("Unidade cadastrada com sucesso. Login criado automaticamente com senha padrao: unidade123")
    reset()
    setOpen(false)
  }

  if (!user) return null

  return (
    <PermissionGate module="tfd" action="criar" fallback={<div className="p-8 text-center text-muted-foreground">Sem permissao para acessar esta pagina.</div>}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Unidades</h1>
            <p className="text-muted-foreground">Cadastre e gerencie as unidades hospitalares do sistema</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova Unidade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Unidade</DialogTitle>
                <DialogDescription>A unidade recebera acesso automatico ao sistema com o e-mail informado</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <div>
                  <Label>Nome da Unidade *</Label>
                  <Input {...register("nome")} placeholder="Ex: Hospital Regional de Parintins" />
                  {errors.nome && <p className="text-sm text-destructive mt-1">{errors.nome.message}</p>}
                </div>
                <div>
                  <Label>E-mail (sera usado como login) *</Label>
                  <Input type="email" {...register("email")} placeholder="unidade@saude.gov.br" />
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <Label>Telefone *</Label>
                  <Input {...register("telefone")} placeholder="(00) 0000-0000" />
                  {errors.telefone && <p className="text-sm text-destructive mt-1">{errors.telefone.message}</p>}
                </div>
                <div>
                  <Label>Endereco *</Label>
                  <Input {...register("endereco")} placeholder="Endereco completo" />
                  {errors.endereco && <p className="text-sm text-destructive mt-1">{errors.endereco.message}</p>}
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">
                    Ao cadastrar, um usuario com perfil &quot;Unidade Hospitalar&quot; sera criado automaticamente com a senha padrao <strong>unidade123</strong>. A unidade devera trocar a senha no primeiro acesso.
                  </p>
                </div>
                <Button type="submit">Cadastrar Unidade</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9"
          />
        </div>

        {/* Unidades grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((u) => (
            <Card key={u.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm text-foreground">{u.nome}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={u.ativo ? "default" : "secondary"}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" /> {u.telefone}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {u.endereco}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const copied = await copyTextToClipboard(`${window.location.origin}/solicitacao`)
                      if (copied) {
                        toast.success("Link copiado!")
                        return
                      }
                      toast.error("Nao foi possivel copiar o link automaticamente.")
                    }}
                    className="flex-1 bg-transparent"
                  >
                    <Copy className="mr-1 h-3 w-3" /> Link Solicitacao
                  </Button>
                  <Button
                    variant={u.ativo ? "destructive" : "default"}
                    size="sm"
                    onClick={() => store.toggleUnidadeActive(u.id)}
                  >
                    {u.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-2 text-muted-foreground">Nenhuma unidade encontrada</p>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
