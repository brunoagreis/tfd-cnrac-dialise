"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ShieldCheck, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { resetPasswordSchema, type PasswordChangeData } from "@/lib/types"
import { useStore } from "@/lib/store-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function ResetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const store = useStore()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const token = searchParams.get("token") || ""
  const tokenValid = token ? store.validateResetToken(token) : null

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ novaSenha: string; confirmarSenha: string }>({
    resolver: zodResolver(resetPasswordSchema),
  })

  async function onSubmit(data: { novaSenha: string; confirmarSenha: string }) {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 500))
    const ok = store.useResetToken(token, data.novaSenha)
    if (ok) {
      setDone(true)
      toast.success("Senha redefinida com sucesso!")
    } else {
      toast.error("Token invalido ou expirado.")
    }
    setLoading(false)
  }

  if (done) {
    return (
      <Card className="border-border shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Senha redefinida!</h2>
          <p className="text-sm text-muted-foreground text-center">
            Sua senha foi alterada com sucesso. Faca login com a nova senha.
          </p>
          <Button asChild>
            <Link href="/login">Ir para Login</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!token || !tokenValid) {
    return (
      <Card className="border-border shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <XCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold text-card-foreground">Link invalido</h2>
          <p className="text-sm text-muted-foreground text-center">
            Este link de redefinicao e invalido ou ja expirou. Solicite um novo.
          </p>
          <Button asChild variant="outline">
            <Link href="/login">Voltar ao Login</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg text-card-foreground">Nova senha</CardTitle>
        <CardDescription>
          Defina uma nova senha para sua conta ({tokenValid.email}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="novaSenha">Nova senha</Label>
            <Input
              id="novaSenha"
              type="password"
              placeholder="Minimo 6 caracteres"
              aria-invalid={!!errors.novaSenha}
              {...register("novaSenha")}
            />
            {errors.novaSenha && (
              <p className="text-sm text-destructive" role="alert">{errors.novaSenha.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
            <Input
              id="confirmarSenha"
              type="password"
              placeholder="Repita a nova senha"
              aria-invalid={!!errors.confirmarSenha}
              {...register("confirmarSenha")}
            />
            {errors.confirmarSenha && (
              <p className="text-sm text-destructive" role="alert">{errors.confirmarSenha.message}</p>
            )}
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Redefinir senha
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function ResetarSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Redefinir Senha</h1>
        </div>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  )
}
