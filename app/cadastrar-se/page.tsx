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

const TERMS_VERSION = "2026-07-08-cadastro-termos"

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
  const [termosLidos, setTermosLidos] = useState(false)
  const [termosAceitos, setTermosAceitos] = useState(false)

  function handleTermsScroll(event: any) {
    const element = event.currentTarget
    const reachedEnd =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 12

    if (reachedEnd) {
      setTermosLidos(true)
    }
  }

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

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm">
            <div className="mb-3">
              <h3 className="font-semibold text-amber-950">
                Termo de uso, LGPD e sigilo da informação
              </h3>
              <p className="mt-1 text-xs text-amber-900">
                Leia o termo até o final. O aceite é obrigatório para enviar a solicitação de acesso.
              </p>
            </div>

            <div
              className="max-h-72 overflow-auto rounded-md border border-amber-200 bg-background p-4 text-justify text-xs leading-relaxed text-foreground"
              onScroll={handleTermsScroll}
            >
              <p className="font-semibold">
                TERMO DE RESPONSABILIDADE, USO DO SISTEMA, CONFIDENCIALIDADE, SIGILO DA INFORMAÇÃO E PROTEÇÃO DE DADOS PESSOAIS
              </p>

              <p className="mt-3">
                Ao solicitar acesso ao sistema, declaro estar ciente de que o ambiente contém informações administrativas,
                operacionais, regulatórias, judiciais, assistenciais e dados pessoais, inclusive dados pessoais sensíveis
                relacionados à saúde, identificação civil, documentos, demandas, processos, pacientes, usuários, unidades,
                municípios, anexos, comunicações e demais registros protegidos por sigilo legal, funcional e institucional.
              </p>

              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>
                  Comprometo-me a utilizar o sistema exclusivamente para finalidade institucional, funcional e autorizada,
                  limitada às atribuições do meu vínculo, cargo, setor, unidade ou atividade formalmente permitida.
                </li>
                <li>
                  Declaro ciência de que os dados pessoais tratados no sistema são protegidos pela Lei Geral de Proteção de
                  Dados Pessoais, Lei nº 13.709/2018, e que devo observar os princípios da finalidade, adequação, necessidade,
                  segurança, prevenção, responsabilização, transparência e confidencialidade.
                </li>
                <li>
                  Comprometo-me a não consultar, copiar, fotografar, imprimir, exportar, baixar, compartilhar, divulgar,
                  encaminhar, transmitir, publicar ou permitir acesso a informações do sistema sem necessidade de serviço,
                  autorização formal ou base institucional legítima.
                </li>
                <li>
                  Reconheço que é proibido compartilhar login, senha, token, sessão, tela aberta, navegador autenticado,
                  computador desbloqueado ou qualquer outro meio de acesso ao sistema com terceiros, colegas, familiares,
                  servidores, prestadores, superiores ou subordinados não autorizados.
                </li>
                <li>
                  Comprometo-me a manter minha senha em sigilo absoluto, não anotá-la em local visível, não salvá-la em
                  computadores compartilhados, navegadores, planilhas, mensagens, e-mails, aplicativos de conversa ou
                  qualquer meio inseguro, bem como alterá-la imediatamente se houver suspeita de exposição.
                </li>
                <li>
                  Comprometo-me a encerrar a sessão ao finalizar o uso, bloquear a estação de trabalho ao me ausentar,
                  impedir visualização por pessoas não autorizadas e adotar cautela especial em computadores públicos,
                  compartilhados, terceirizados ou de uso coletivo.
                </li>
                <li>
                  Estou ciente de que qualquer vazamento, divulgação indevida, uso abusivo, acesso sem necessidade,
                  tratamento irregular, exposição de dados, cópia não autorizada ou compartilhamento de credenciais poderá
                  gerar responsabilização administrativa, civil, funcional, contratual e, quando aplicável, criminal.
                </li>
                <li>
                  Declaro ciência de que minhas ações no sistema poderão ser registradas, auditadas, rastreadas e analisadas
                  para fins de segurança, conformidade, prevenção a incidentes, investigação de uso indevido e atendimento a
                  obrigações legais e institucionais.
                </li>
                <li>
                  Comprometo-me a comunicar imediatamente ao administrador do sistema qualquer suspeita de incidente de
                  segurança, acesso indevido, perda de senha, uso não autorizado, erro de permissão, exposição de dados ou
                  vazamento de informação.
                </li>
                <li>
                  Reconheço que a aprovação do cadastro não concede propriedade sobre os dados nem autorização ampla de uso,
                  sendo o acesso pessoal, intransferível, revogável, auditável e condicionado à necessidade de serviço e às
                  políticas internas de segurança da informação.
                </li>
                <li>
                  Declaro que as informações prestadas neste cadastro são verdadeiras e que assumo responsabilidade por
                  acessos, ações, registros, consultas e operações realizadas com minhas credenciais, salvo comprovada falha
                  técnica ou fraude comunicada tempestivamente.
                </li>
                <li>
                  Confirmo que li, compreendi e aceito cumprir este termo, as normas de segurança da informação, a LGPD, os
                  deveres de sigilo e as orientações de uso responsável do sistema.
                </li>
              </ol>

              <p className="mt-3 font-medium">
                Versão do termo: {TERMS_VERSION}
              </p>
            </div>

            {!termosLidos ? (
              <p className="mt-2 text-xs text-amber-900">
                Role o termo até o final para liberar o aceite.
              </p>
            ) : (
              <p className="mt-2 text-xs text-emerald-700">
                Termo lido até o final. Agora marque o aceite para enviar a solicitação.
              </p>
            )}

            <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={termosAceitos}
                disabled={!termosLidos || saving}
                onChange={(event) => setTermosAceitos(event.target.checked)}
              />
              <span>
                Declaro que li integralmente e aceito o termo de uso, LGPD, sigilo da informação e responsabilidade pelo uso
                das minhas credenciais e pelos dados acessados no sistema.
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>

            <Button onClick={handleSubmit} disabled={saving || !termosLidos || !termosAceitos}>
              {saving ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}