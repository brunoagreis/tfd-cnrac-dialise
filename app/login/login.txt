"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { loginSchema, type LoginFormData, resetRequestSchema } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { useStore } from "@/lib/store-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const store = useStore()
  const [loading, setLoading] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetLoading, setResetLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", senha: "", lembrarMe: false },
  })

  const lembrarMe = watch("lembrarMe")

  async function onSubmit(data: LoginFormData) {
    setLoading(true)
    try {
      const ok = await login(data.email, data.senha, data.lembrarMe)
      if (ok) {
        toast.success("Login realizado com sucesso")
        router.push("/dashboard")
      } else {
        toast.error("Credenciais invalidas. Verifique e tente novamente.")
      }
    } catch {
      toast.error("Ocorreu um erro. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    const parsed = resetRequestSchema.safeParse({ email: resetEmail })
    if (!parsed.success) {
      toast.error("Informe um e-mail valido.")
      return
    }
    setResetLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    const token = store.createResetToken(resetEmail)
    if (token) {
      // In a real app this would send an email. For demo we show the link.
      toast.success("Link de redefinicao enviado! Verifique seu e-mail.", { duration: 6000 })
      toast.info(`Demo: /resetar-senha?token=${token}`, { duration: 12000 })
      // Try to send real email
      try {
        await fetch("/api/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resetEmail, token }),
        })
      } catch {
        // Email send may fail in demo, token still works
      }
    } else {
      // Generic message - don't reveal if email exists
      toast.success("Se o e-mail estiver cadastrado, voce recebera o link de redefinicao.")
    }
    setResetLoading(false)
    setResetOpen(false)
    setResetEmail("")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              SIS Regulacao
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sistema de Regulacao em Saude
            </p>
          </div>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-card-foreground">Entrar</CardTitle>
            <CardDescription>
              Insira suas credenciais para acessar o sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
              {/* Email */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.gov.br"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                />
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Senha */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="senha">Senha</Label>
                  <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                    <DialogTrigger asChild>
                      <button type="button" className="text-xs font-medium text-primary hover:underline">
                        Esqueceu a senha?
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Redefinir senha</DialogTitle>
                        <DialogDescription>
                          Informe seu e-mail cadastrado. Enviaremos um link para redefinir sua senha.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="reset-email">E-mail</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="seu@email.gov.br"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                          />
                        </div>
                        <Button onClick={handleResetPassword} disabled={resetLoading}>
                          {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                          Enviar link
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  aria-invalid={!!errors.senha}
                  aria-describedby={errors.senha ? "senha-error" : undefined}
                  {...register("senha")}
                />
                {errors.senha && (
                  <p id="senha-error" className="text-sm text-destructive" role="alert">
                    {errors.senha.message}
                  </p>
                )}
              </div>

              {/* Lembrar-me */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lembrar"
                  checked={lembrarMe}
                  onCheckedChange={(checked) =>
                    setValue("lembrarMe", checked === true)
                  }
                />
                <Label htmlFor="lembrar" className="text-sm font-normal text-muted-foreground cursor-pointer">
                  Lembrar-me neste dispositivo
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Entrar
              </Button>
            </form>

            {/* Links */}
            <div className="mt-4 flex flex-col items-center gap-2">
              <Link href="/solicitacao" className="text-sm font-medium text-primary hover:underline">
                Formulario de solicitacao (hospitais)
              </Link>
              <Link href="/acompanhamento" className="text-sm text-muted-foreground hover:underline">
                Acompanhar protocolo (unidades)
              </Link>
              <Link href="/consulta" className="text-sm text-muted-foreground hover:underline">
                Consultar protocolo (externo)
              </Link>
            </div>

            {/* Demo hint */}
            <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Contas de demonstracao:</p>
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                <li><span className="font-mono text-foreground">admin@saude.gov.br</span> / admin123</li>
                <li><span className="font-mono text-foreground">medico@saude.gov.br</span> / medico123</li>
                <li><span className="font-mono text-foreground">operador@saude.gov.br</span> / operador123</li>
                <li><span className="font-mono text-foreground">ubs.cidadenova@saude.am.gov.br</span> / unidade123</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
