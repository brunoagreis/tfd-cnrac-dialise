"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, RefreshCw, Trash2, UserPlus } from "lucide-react"

import { useAuth } from "@/lib/auth-context"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type SolicitacaoAcesso = {
  id: string
  nome: string
  email: string
  cpf: string
  telefone: string
  vinculo: string
  perfilSolicitado: string
  perfilSolicitadoLabel: string
  justificativa: string
  status: string
  createdAt: string
}

function formatDateTime(value: string) {
  if (!value) return "Não informado"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("pt-BR")
}

export function UsuariosSolicitacoesAcesso() {
  const { user } = useAuth()

  const [items, setItems] = useState<SolicitacaoAcesso[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState("")

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)

      const response = await fetch("/api/admin/usuarios/solicitacoes", {
        cache: "no-store",
      })

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao carregar solicitações.")
      }

      setItems(data.items ?? [])
    } catch (error) {
      console.error("[UsuariosSolicitacoesAcesso] erro:", error)

      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao carregar solicitações.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  function adminPayload() {
    return {
      id: user?.id || "sistema",
      nome: user?.nome || "Sistema",
      email: user?.email || "",
    }
  }

  async function handleApprove(item: SolicitacaoAcesso) {
    const ok = window.confirm(
      `Aprovar o acesso de ${item.nome} como ${item.perfilSolicitadoLabel}?`,
    )

    if (!ok) return

    try {
      setSavingId(item.id)

      const response = await fetch(
        `/api/admin/usuarios/solicitacoes/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "aprovar",
            admin: adminPayload(),
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao aprovar solicitação.")
      }

      toast.success("Solicitação aprovada e usuário criado com sucesso.")
      await loadItems()

      window.setTimeout(() => {
        window.location.reload()
      }, 600)
    } catch (error) {
      console.error("[UsuariosSolicitacoesAcesso] erro ao aprovar:", error)

      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao aprovar solicitação.",
      )
    } finally {
      setSavingId("")
    }
  }

  async function handleReject(item: SolicitacaoAcesso) {
    const ok = window.confirm(
      `Recusar a solicitação de acesso de ${item.nome}?`,
    )

    if (!ok) return

    try {
      setSavingId(item.id)

      const response = await fetch(
        `/api/admin/usuarios/solicitacoes/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "recusar",
            motivo: "Recusada pelo administrador.",
            admin: adminPayload(),
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao recusar solicitação.")
      }

      toast.success("Solicitação recusada.")
      await loadItems()
    } catch (error) {
      console.error("[UsuariosSolicitacoesAcesso] erro ao recusar:", error)

      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao recusar solicitação.",
      )
    } finally {
      setSavingId("")
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Solicitações pendentes de acesso
              {items.length > 0 && (
                <Badge variant="secondary">{items.length}</Badge>
              )}
            </CardTitle>

            <CardDescription>
              Usuários que se cadastraram pela tela pública e aguardam análise do administrador.
            </CardDescription>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-transparent"
            onClick={loadItems}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Carregando solicitações...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma solicitação pendente.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {item.nome}
                      </p>

                      <Badge variant="secondary">Pendente</Badge>

                      <Badge variant="outline">
                        {item.perfilSolicitadoLabel}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">
                          E-mail:
                        </span>{" "}
                        {item.email}
                      </p>

                      <p>
                        <span className="font-medium text-foreground">
                          CPF:
                        </span>{" "}
                        {item.cpf || "Não informado"}
                        {" | "}
                        <span className="font-medium text-foreground">
                          Telefone:
                        </span>{" "}
                        {item.telefone || "Não informado"}
                      </p>

                      <p>
                        <span className="font-medium text-foreground">
                          Vínculo:
                        </span>{" "}
                        {item.vinculo || "Não informado"}
                      </p>

                      <p>
                        <span className="font-medium text-foreground">
                          Solicitado em:
                        </span>{" "}
                        {formatDateTime(item.createdAt)}
                      </p>

                      <p className="whitespace-pre-line">
                        <span className="font-medium text-foreground">
                          Justificativa:
                        </span>{" "}
                        {item.justificativa || "Não informada"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleApprove(item)}
                      disabled={savingId === item.id}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aprovar
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                      onClick={() => handleReject(item)}
                      disabled={savingId === item.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Recusar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}