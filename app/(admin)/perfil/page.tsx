"use client"

import React from "react"
import { useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Upload, User as UserIcon, Camera, Lock, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { useAuth, getInitials } from "@/lib/auth-context"
import { useStore } from "@/lib/store-context"
import { perfilSchema, passwordChangeSchema, type PerfilFormData, type PasswordChangeData, ROLE_LABELS } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function PerfilPage() {
  const { user, updateUser } = useAuth()
  const store = useStore()
  const [loading, setLoading] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(
    user?.assinaturaMedicoUrl || null,
  )
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    user?.fotoUrl || null,
  )
  const signatureRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PerfilFormData>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      nome: user?.nome ?? "",
      cpf: user?.cpf ?? "",
      email: user?.email ?? "",
      telefone: user?.telefone ?? "",
    },
  })

  const {
    register: regPwd,
    handleSubmit: handlePwd,
    formState: { errors: pwdErrors },
    reset: resetPwd,
  } = useForm<PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
  })

  if (!user) return null

  async function onSubmit(data: PerfilFormData) {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 500))
    updateUser(data)
    store.updateUserInStore(user!.id, data)
    toast.success("Perfil atualizado com sucesso")
    setLoading(false)
  }

  async function onPasswordChange(data: PasswordChangeData) {
    setPwdLoading(true)
    await new Promise((r) => setTimeout(r, 500))
    const valid = store.verifyPassword(user!.id, data.senhaAtual)
    if (!valid) {
      toast.error("Senha atual incorreta.")
      setPwdLoading(false)
      return
    }
    store.changePassword(user!.id, data.novaSenha)
    toast.success("Senha alterada com sucesso!")
    resetPwd()
    setPwdLoading(false)
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem valida.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no maximo 2MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      setPhotoPreview(url)
      updateUser({ fotoUrl: url })
      store.updateUserInStore(user!.id, { fotoUrl: url })
      toast.success("Foto atualizada")
    }
    reader.readAsDataURL(file)
  }

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem valido.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no maximo 2MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      setSignaturePreview(url)
      updateUser({ assinaturaMedicoUrl: url })
      store.updateUserInStore(user!.id, { assinaturaMedicoUrl: url })
      toast.success("Assinatura enviada com sucesso")
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Meu Perfil
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie suas informacoes pessoais, foto e senha.
        </p>
      </div>

      {/* Profile header with photo */}
      <Card className="border-border">
        <CardContent className="flex flex-col items-center gap-4 pt-6 sm:flex-row sm:items-start">
          <div className="relative group">
            <Avatar className="h-20 w-20 bg-primary text-primary-foreground">
              {photoPreview ? (
                <AvatarImage src={photoPreview} alt={user.nome} />
              ) : null}
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                {getInitials(user.nome)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100"
              aria-label="Alterar foto de perfil"
            >
              <Camera className="h-5 w-5 text-background" />
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="sr-only"
              aria-label="Selecionar foto de perfil"
            />
          </div>
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <h2 className="text-lg font-semibold text-card-foreground">{user.nome}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge variant="secondary" className="mt-1">
              {ROLE_LABELS[user.role]}
            </Badge>
            {user.role !== "UNIDADE_HOSPITALAR" && (
              <p className="mt-1 text-xs text-muted-foreground">CPF: {user.cpf}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal data form */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-card-foreground">Dados Pessoais</CardTitle>
          <CardDescription>Atualize suas informacoes cadastrais.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" aria-invalid={!!errors.nome} {...register("nome")} />
                {errors.nome && (
                  <p className="text-sm text-destructive" role="alert">{errors.nome.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" placeholder="000.000.000-00" aria-invalid={!!errors.cpf} {...register("cpf")} />
                {errors.cpf && (
                  <p className="text-sm text-destructive" role="alert">{errors.cpf.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
                {errors.email && (
                  <p className="text-sm text-destructive" role="alert">{errors.email.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" placeholder="(00) 00000-0000" aria-invalid={!!errors.telefone} {...register("telefone")} />
                {errors.telefone && (
                  <p className="text-sm text-destructive" role="alert">{errors.telefone.message}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Salvar alteracoes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
            <Lock className="h-4 w-4" aria-hidden="true" />
            Alterar Senha
          </CardTitle>
          <CardDescription>
            Escolha uma senha forte com pelo menos 6 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePwd(onPasswordChange)} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="senhaAtual">Senha atual</Label>
              <div className="relative">
                <Input
                  id="senhaAtual"
                  type={showCurrentPwd ? "text" : "password"}
                  className="pr-10"
                  aria-invalid={!!pwdErrors.senhaAtual}
                  {...regPwd("senhaAtual")}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showCurrentPwd ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwdErrors.senhaAtual && (
                <p className="text-sm text-destructive" role="alert">{pwdErrors.senhaAtual.message}</p>
              )}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="novaSenha">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="novaSenha"
                    type={showNewPwd ? "text" : "password"}
                    className="pr-10"
                    aria-invalid={!!pwdErrors.novaSenha}
                    {...regPwd("novaSenha")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showNewPwd ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwdErrors.novaSenha && (
                  <p className="text-sm text-destructive" role="alert">{pwdErrors.novaSenha.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  aria-invalid={!!pwdErrors.confirmarSenha}
                  {...regPwd("confirmarSenha")}
                />
                {pwdErrors.confirmarSenha && (
                  <p className="text-sm text-destructive" role="alert">{pwdErrors.confirmarSenha.message}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={pwdLoading}>
                {pwdLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Alterar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Signature upload - only for MEDICO_SES */}
      {user.role === "MEDICO_SES" && (
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-card-foreground">
              Assinatura Medica SES
            </CardTitle>
            <CardDescription>
              Envie a imagem da sua assinatura para uso em laudos e documentos oficiais impressos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {signaturePreview ? (
                <div className="overflow-hidden rounded-lg border border-border bg-muted/50 p-4">
                  <img
                    src={signaturePreview}
                    alt="Assinatura do medico"
                    className="mx-auto max-h-32 object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-10 text-center">
                  <UserIcon className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma assinatura enviada.
                  </p>
                </div>
              )}
              <input
                ref={signatureRef}
                type="file"
                accept="image/*"
                onChange={handleSignatureUpload}
                className="sr-only"
                id="signature-upload"
                aria-label="Enviar imagem da assinatura"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => signatureRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                {signaturePreview ? "Trocar assinatura" : "Enviar assinatura"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
