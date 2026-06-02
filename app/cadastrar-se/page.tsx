"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function CadastrarSePage() {
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [telefone, setTelefone] = useState("")
  const [vinculo, setVinculo] = useState("")
  const [perfilSolicitado, setPerfilSolicitado] = useState("OPERADOR")
  const [justificativa, setJustificativa] = useState("")
  const [senha, setSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    if (saving) return

    try {
      setSaving(true)

      const response = await fetch("/api/auth/cadastrar-se", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
          email,
          cpf,
          telefone,
          vinculo,
          perfilSolicitado,
          justificativa,
          senha,
          confirmarSenha,
        }),
      })

      const data = await response.json()

if (!response.ok || !data?.ok) {
  toast.error(data?.error || "Erro ao solicitar cadastro.")
  return
}

      setSuccess(true)
      toast.success("Solicitação enviada para análise.")

} catch (error) {
  console.error("[CadastrarSePage] erro:", error)

  toast.error(
    error instanceof Error
      ? error.message
      : "Erro ao solicitar cadastro.",
  )
} finally {
  setSaving(false)
}

  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
        <Card className="w-full max-w-lg border-border shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-700" />
            </div>

            <CardTitle>Solicitação enviada</CardTitle>

            <CardDescription>
              Seu cadastro foi recebido e ficará pendente até aprovação do
              administrador.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Quando o administrador aprovar, você poderá acessar o sistema com
              o e-mail e a senha informados.
            </div>

            <Button asChild className="w-full">
              <Link href="/login">Voltar para o login</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-2xl border-border shadow-lg">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>

            <div>
              <CardTitle>Solicitar acesso</CardTitle>
              <CardDescription>
                Preencha os dados abaixo. O acesso só será liberado após
                aprovação do administrador.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs">Nome completo</Label>
              <Input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu.email@instituicao.gov.br"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">CPF</Label>
              <Input
                value={cpf}
                onChange={(event) => setCpf(event.target.value)}
                placeholder="Somente números"
                maxLength={14}
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">Telefone</Label>
              <Input
                value={telefone}
                onChange={(event) => setTelefone(event.target.value)}
                placeholder="Telefone institucional ou celular"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">
                Perfil solicitado
              </Label>

              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={perfilSolicitado}
                onChange={(event) => setPerfilSolicitado(event.target.value)}
              >
                <option value="OPERADOR">Operador</option>
                <option value="REGULADOR">Regulador</option>
                <option value="MEDICO_SES">Médico SES</option>
                <option value="VISUALIZADOR">Visualizador</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs">
                Vínculo ou instituição
              </Label>
              <Input
                value={vinculo}
                onChange={(event) => setVinculo(event.target.value)}
                placeholder="Ex.: SES, município, hospital, setor, unidade..."
              />
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs">
                Justificativa do acesso
              </Label>
              <Textarea
                rows={4}
                value={justificativa}
                onChange={(event) => setJustificativa(event.target.value)}
                placeholder="Explique por que você precisa de acesso ao sistema."
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">Senha</Label>
              <Input
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">Confirmar senha</Label>
              <Input
                type="password"
                value={confirmarSenha}
                onChange={(event) => setConfirmarSenha(event.target.value)}
                placeholder="Repita a senha"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Esta solicitação não libera acesso automático. O administrador
            analisará seus dados antes da ativação.
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>

            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}