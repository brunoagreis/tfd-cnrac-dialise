"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, History, Inbox, MailCheck, Play, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type FileItem = { name?: string; filename?: string; mimeType?: string; contentType?: string; size?: number; url?: string }
type HistoryItem = { id: string; assunto: string; remetente: string; pgeNet: string; processo: string; status: string; monitoramentoId: string; osProtocolo: string; erro: string; processadoEm: string; corpoResumo?: string; attachments: FileItem[] }
type ConnectionResult = { ok: boolean; error?: string; config?: { host: string; port: number; user: string; mailbox: string }; mailbox?: { exists: number } }
type TriageStatus = { running: boolean; source: string; lastStartedAt: string; lastFinishedAt: string; nextRunAt: string; lastOk: boolean | null; lastMessage: string; lastProcessed: number; mailboxTotal: number; unreadTotal: number; readCount: number; triagedCount: number; linkedCount: number; osCount: number; errorCount: number; currentSubject: string; updatedAt: string }

const PAGE_SIZE = 10
const AUTO_INTERVAL_MS = 5 * 60 * 1000
const STATUS_INTERVAL_MS = 15 * 1000

function dateBr(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR") }
function isoPlusFive() { return new Date(Date.now() + AUTO_INTERVAL_MS).toISOString() }
function fileName(file: FileItem) { return file.name || file.filename || "anexo" }
function fileMime(file: FileItem) { return file.mimeType || file.contentType || "tipo não informado" }
function fileSize(value?: number) { const v = Number(value || 0); if (!v) return "-"; if (v < 1024) return `${v} B`; if (v < 1048576) return `${Math.round(v / 1024)} KB`; return `${(v / 1048576).toFixed(2)} MB` }

export function EmailIntegracaoPageV5() {
  const requestRef = useRef(false)
  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [status, setStatus] = useState<TriageStatus | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    void loadStatus()
    void loadHistory(1)
    const statusTimer = window.setInterval(() => void loadStatus(), STATUS_INTERVAL_MS)
    const autoTimer = window.setInterval(() => void triggerTriage("auto-pagina", true), AUTO_INTERVAL_MS)
    return () => { window.clearInterval(statusTimer); window.clearInterval(autoTimer) }
  }, [])

  async function loadHistory(page = historyPage) {
    const r = await fetch(`/api/admin/judicial/email-integracao/historico?page=${page}&perPage=${PAGE_SIZE}`, { cache: "no-store" })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j?.ok) {
      setHistory(Array.isArray(j.items) ? j.items : [])
      setHistoryPage(Number(j.page || page))
      setHistoryTotalPages(Math.max(1, Number(j.totalPages || 1)))
    }
  }

  async function loadStatus() {
    const r = await fetch("/api/admin/judicial/email-integracao/status", { cache: "no-store" })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j?.ok) {
      setStatus(j.status)
      if (!j.status?.running) await loadHistory(1)
    }
  }

  async function testConnection() {
    const r = await fetch("/api/admin/judicial/email-integracao/teste?action=connection", { cache: "no-store" })
    const j = await r.json().catch(() => ({}))
    setConnection(j)
    if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha na conexão.")
    toast.success("Conectado.")
  }

  async function triggerTriage(source = "manual", silent = false) {
    if (requestRef.current) return
    try {
      requestRef.current = true
      setRequesting(true)
      const nextRunAt = isoPlusFive()
      const r = await fetch(`/api/admin/judicial/email-integracao/processar?source=${encodeURIComponent(source)}&nextRunAt=${encodeURIComponent(nextRunAt)}`, { method: "POST", cache: "no-store" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.ok) {
        const message = j?.error || "Falha ao iniciar triagem."
        if (!silent) toast.error(message)
        return
      }
      if (j.alreadyRunning) {
        if (!silent) toast.info("A triagem já está em andamento. Atualizei o status na tela.")
      } else if (!silent) {
        toast.success("Triagem iniciada. O histórico será atualizado ao finalizar.")
      }
      await loadStatus()
    } finally {
      requestRef.current = false
      setRequesting(false)
    }
  }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-2xl font-bold tracking-tight">Integração de e-mail</h1><p className="text-sm text-muted-foreground">Triagem automática da caixa de entrada a cada 5 minutos.</p></div>
      <Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
    </div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4" />Triagem automática</CardTitle><CardDescription>O sistema lê mensagens novas, cria OS quando não encontra processo, ou registra interação quando encontra PGE.net/processo.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2"><Button onClick={testConnection} disabled={requesting}><MailCheck className="mr-2 h-4 w-4" />Testar conexão</Button><Button onClick={() => triggerTriage("manual", false)} disabled={requesting}><Play className="mr-2 h-4 w-4" />Executar agora</Button><Button variant="outline" onClick={() => { void loadStatus(); void loadHistory(historyPage) }} disabled={requesting}><History className="mr-2 h-4 w-4" />Atualizar histórico</Button>{status?.running ? <Badge variant="outline"><RefreshCcw className="mr-1 h-3 w-3 animate-spin" />Processando</Badge> : <Badge variant="secondary">Automático: 5 minutos</Badge>}</div>
        <div className="rounded-xl border p-4 text-sm">
          <p><strong>Última execução:</strong> {status?.lastFinishedAt ? dateBr(status.lastFinishedAt) : status?.lastStartedAt ? `${dateBr(status.lastStartedAt)} em andamento` : "Ainda não executou"}</p>
          <p><strong>Próxima execução:</strong> {status?.nextRunAt ? dateBr(status.nextRunAt) : "Aguardando agendamento"}</p>
          <p><strong>Resultado:</strong> {status?.lastMessage || "-"}</p>
          {status?.currentSubject ? <p><strong>E-mail atual:</strong> {status.currentSubject}</p> : null}
          <div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-7">
            <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Na caixa</p><p className="text-lg font-bold">{status?.mailboxTotal ?? 0}</p></div>
            <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Novos identificados</p><p className="text-lg font-bold">{status?.unreadTotal ?? 0}</p></div>
            <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Marcados como lidos</p><p className="text-lg font-bold">{status?.readCount ?? 0}</p></div>
            <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Triados</p><p className="text-lg font-bold">{status?.triagedCount ?? status?.lastProcessed ?? 0}</p></div>
            <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Vinculados</p><p className="text-lg font-bold">{status?.linkedCount ?? 0}</p></div>
            <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">OS criadas</p><p className="text-lg font-bold">{status?.osCount ?? 0}</p></div>
            <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Erros</p><p className="text-lg font-bold">{status?.errorCount ?? 0}</p></div>
          </div>
        </div>
        {connection ? <div className="rounded-xl border p-4 text-sm"><p><strong>Status:</strong> {connection.ok ? "Conectado" : "Falha"}</p>{connection.error ? <p className="text-destructive"><strong>Erro:</strong> {connection.error}</p> : null}{connection.config ? <p><strong>Conta:</strong> {connection.config.user} • {connection.config.host}:{connection.config.port} • {connection.config.mailbox}</p> : null}{connection.mailbox ? <p><strong>Mensagens IMAP na INBOX:</strong> {connection.mailbox.exists}</p> : null}</div> : null}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Histórico de e-mails processados</CardTitle><CardDescription>Registra OS criada, processo identificado, responsável direcionado, anexos e corpo do e-mail.</CardDescription></CardHeader>
      <CardContent>{history.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum e-mail processado.</p> : <div className="space-y-3">{history.map((item) => <div key={item.id} className="rounded-xl border p-4 text-sm"><div className="mb-2 flex justify-between gap-2"><Badge variant={item.status === "ERRO" ? "destructive" : item.status === "OS_CRIADA" ? "secondary" : "default"}>{item.status}</Badge><span className="text-xs text-muted-foreground">{dateBr(item.processadoEm)}</span></div><p className="font-semibold">{item.assunto}</p><p className="text-muted-foreground">Remetente: {item.remetente || "-"}</p><div className="mt-2 grid gap-2 md:grid-cols-4"><div><strong>PGE.net:</strong> {item.pgeNet || "-"}</div><div><strong>Processo:</strong> {item.processo || "-"}</div><div><strong>Monitoramento:</strong> {item.monitoramentoId || "-"}</div><div><strong>OS:</strong> {item.osProtocolo || "-"}</div></div>{item.corpoResumo ? <div className="mt-2 rounded-lg border p-2 text-xs text-muted-foreground"><strong>Corpo do e-mail:</strong> {item.corpoResumo.slice(0, 1200)}</div> : null}{item.erro ? <p className="mt-2 text-destructive">Erro: {item.erro}</p> : null}{item.attachments?.length ? <div className="mt-3 rounded-lg bg-muted p-3">{item.attachments.map((file, index) => <div key={`${fileName(file)}-${index}`} className="flex flex-wrap items-center gap-2"><span>{fileName(file)} • {fileMime(file)} • {fileSize(file.size)}</span>{file.url ? <Button asChild size="sm" variant="outline"><a href={file.url} target="_blank" rel="noreferrer"><Eye className="mr-1 h-3 w-3" />Visualizar</a></Button> : null}</div>)}</div> : null}</div>)}<div className="flex items-center justify-between pt-2 text-sm text-muted-foreground"><span>Página {historyPage} de {historyTotalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={historyPage <= 1} onClick={() => loadHistory(historyPage - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={historyPage >= historyTotalPages} onClick={() => loadHistory(historyPage + 1)}>Próxima</Button></div></div></div>}</CardContent>
    </Card>
  </div>
}
