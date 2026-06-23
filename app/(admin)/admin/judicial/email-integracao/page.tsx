"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Inbox, MailCheck, RefreshCcw, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type AttachmentItem = {
  filename: string
  contentType: string
  size: number
}

type PreviewItem = {
  uid: number
  messageId: string
  subject: string
  from: string
  date: string
  classifier: string
  pgeNet: string
  processo: string
  attachments: AttachmentItem[]
  simulatedAction: {
    type: string
    label: string
    demanda: null | { id: string; protocolo: string; pacienteNome: string }
  }
}

type ConnectionResult = {
  ok: boolean
  error?: string
  config?: {
    host: string
    port: number
    secure: boolean
    user: string
    mailbox: string
    configured: boolean
  }
  mailbox?: {
    exists: number
    path: string
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-BR")
}

function formatSize(value: number) {
  if (!value) return "-"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export default function EmailIntegracaoPage() {
  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [items, setItems] = useState<PreviewItem[]>([])
  const [loading, setLoading] = useState(false)

  async function testConnection() {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/judicial/email-integracao/teste?action=connection", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      setConnection(json)
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Falha na conexão.")
        return
      }
      toast.success("Conexão realizada com sucesso.")
    } finally {
      setLoading(false)
    }
  }

  async function previewEmails() {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/judicial/email-integracao/teste?action=preview&limit=10", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Falha ao ler e-mails.")
        return
      }
      setItems(Array.isArray(json.items) ? json.items : [])
      toast.success("Prévia carregada.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integração de e-mail</h1>
          <p className="text-sm text-muted-foreground">Teste a leitura da caixa sigajus.ses.ms@gmail.com sem processar os e-mails.</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4" /> Teste de conexão</CardTitle>
          <CardDescription>Nesta fase o SIGAJUS apenas conecta e simula a triagem. Nenhuma demanda, OS, anexo ou monitoramento é criado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={testConnection} disabled={loading}><MailCheck className="mr-2 h-4 w-4" /> Testar conexão</Button>
            <Button type="button" variant="outline" className="bg-transparent" onClick={previewEmails} disabled={loading}><Search className="mr-2 h-4 w-4" /> Ler últimos 10 e-mails</Button>
            {loading ? <Badge variant="outline"><RefreshCcw className="mr-1 h-3 w-3 animate-spin" /> Processando</Badge> : null}
          </div>

          {connection ? (
            <div className="rounded-xl border border-border p-4 text-sm">
              <p><strong>Status:</strong> {connection.ok ? "Conectado" : "Falha"}</p>
              {connection.error ? <p className="text-destructive"><strong>Erro:</strong> {connection.error}</p> : null}
              {connection.config ? <p><strong>Conta:</strong> {connection.config.user} • {connection.config.host}:{connection.config.port} • {connection.config.mailbox}</p> : null}
              {connection.mailbox ? <p><strong>E-mails na caixa:</strong> {connection.mailbox.exists}</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Prévia da triagem</CardTitle>
          <CardDescription>Mostra assunto, PGE.net/processo detectado, classificador, anexos e ação simulada.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum e-mail carregado ainda.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={`${item.uid}-${item.messageId}`} className="rounded-xl border border-border p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={item.simulatedAction.type === "vincular_processo" ? "default" : "secondary"}>{item.classifier}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                  </div>
                  <h2 className="font-semibold">{item.subject || "Sem assunto"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Remetente: {item.from || "-"}</p>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                    <div><strong>PGE.net:</strong> {item.pgeNet || "Não detectado"}</div>
                    <div><strong>Processo:</strong> {item.processo || "Não detectado"}</div>
                    <div><strong>Anexos:</strong> {item.attachments.length}</div>
                  </div>
                  {item.attachments.length ? (
                    <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
                      {item.attachments.map((attachment, index) => (
                        <div key={`${attachment.filename}-${index}`}>{attachment.filename} • {attachment.contentType || "tipo não informado"} • {formatSize(attachment.size)}</div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-lg border border-dashed border-border p-3 text-sm">
                    <strong>Ação simulada:</strong> {item.simulatedAction.label}
                    {item.simulatedAction.demanda ? <div>Protocolo encontrado: {item.simulatedAction.demanda.protocolo}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
