"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { loginSchema, type LoginFormData } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

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
        toast.success("Login realizado com sucesso.")
        router.push("/dashboard")
      } else {
        toast.error("Credenciais inválidas. Verifique e tente novamente.")
      }
    } catch {
      toast.error("Ocorreu um erro. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    const email = resetEmail.trim().toLowerCase()

    if (!isValidEmail(email)) {
      toast.error("Informe um e-mail válido.")
      return
    }

    setResetLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.ok) {
        toast.error(data?.error || "Não foi possível processar a solicitação.")
        return
      }

      toast.success(
        "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
      )
      setResetOpen(false)
      setResetEmail("")
    } catch {
      toast.error("Não foi possível processar a solicitação.")
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
      <div className="w-full max-w-md">
        <div className="mb-2 flex justify-center">
          <Image
            src="/logo-sigajus.png"
            alt="SIGAJUS"
            width={220}
            height={90}
            priority
            className="h-auto w-auto max-w-[220px] object-contain"
          />
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-card-foreground">
              Entrar
            </CardTitle>
            <CardDescription>
              Insira suas credenciais para acessar o sistema.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-5"
              noValidate
            >
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
                  <p
                    id="email-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="senha">Senha</Label>

                  <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Esqueceu a senha?
                      </button>
                    </DialogTrigger>

                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Redefinir senha</DialogTitle>
                        <DialogDescription>
                          Informe seu e-mail cadastrado. Se ele existir no
                          sistema, enviaremos um link para redefinir sua senha.
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

                        <Button
                          type="button"
                          onClick={handleResetPassword}
                          disabled={resetLoading}
                        >
                          {resetLoading && (
                            <Loader2
                              className="mr-2 h-4 w-4 animate-spin"
                              aria-hidden="true"
                            />
                          )}
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
                  <p
                    id="senha-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.senha.message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="lembrar"
                  checked={lembrarMe}
                  onCheckedChange={(checked) =>
                    setValue("lembrarMe", checked === true)
                  }
                />
                <Label
                  htmlFor="lembrar"
                  className="cursor-pointer text-sm font-normal text-muted-foreground"
                >
                  Lembrar-me neste dispositivo
                </Label>
              </div>

              <div className="flex flex-col gap-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Entrar
                </Button>

                <Button asChild type="button" variant="outline" className="w-full bg-transparent">
                  <Link href="/cadastrar-se">Cadastrar-se</Link>
                </Button>
              </div>
            </form>

            <div className="mt-5 grid gap-2 border-t border-border pt-4">
              <Button asChild type="button" variant="secondary" className="w-full">
                <Link href="/consulta">Consulta pública de protocolo</Link>
              </Button>
              <Button asChild type="button" variant="outline" className="w-full bg-transparent">
                <Link href="/municipio/login">Login do Município</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
