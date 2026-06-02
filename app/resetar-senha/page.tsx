"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function ResetarSenhaPage() {
  const router = useRouter()

  const [token, setToken] = useState("")
  const [senha, setSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get("token") || "")
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!token) {
      toast.error("Token inválido.")
      return
    }

    if (senha.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (senha !== confirmarSenha) {
      toast.error("As senhas não conferem.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          senha,
          confirmarSenha,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.ok) {
        toast.error(data?.error || "Não foi possível redefinir a senha.")
        return
      }

      toast.success("Senha redefinida com sucesso.")
      router.push("/login")
    } catch {
      toast.error("Não foi possível redefinir a senha.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck
              className="h-7 w-7 text-primary-foreground"
              aria-hidden="true"
            />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              SIS Regulação
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Redefinição de senha
            </p>
          </div>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-card-foreground">
              Criar nova senha
            </CardTitle>
            <CardDescription>
              Informe sua nova senha para concluir a redefinição.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="senha">Nova senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Digite a nova senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                Salvar nova senha
              </Button>

              <Link
                href="/login"
                className="text-center text-sm text-muted-foreground hover:underline"
              >
                Voltar para o login
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}