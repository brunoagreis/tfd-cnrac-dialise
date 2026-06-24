"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, History, Inbox, MailCheck, Play, RefreshCcw, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type FileItem = { name?: string; filename?: string; mimeType?: string; contentType?: string; size?: number; url?: string }
type UserItem = { id: string; nome: string; email: string }
type PreviewItem = { uid: string; messageId?: string; subject: string; from: string; date: string; classifier: string; pgeNet: string; processo: string; detectedIn: string; attachments: FileItem[]; simulatedAction?: { label?: string } }
type HistoryItem = { id: string; assunto: string; remetente: string; pgeNet: string; processo: string; status: string; monitoramentoId: string; osProtocolo: string; erro: string; processadoEm: string; attachments: FileItem[] }
type ConnectionResult = { ok: boolean; error?: string; config?: { host: string; port: number; user: string; mailbox: string }; mailbox?: { exists: number } }

const MODULES = [
  { value: "judicial", label: "Judicial" },
  { value: "tfd", label: "TFD" },
  { value: "cnrac", label: "CNRAC" },
  { value: "hemodialise", label: "Hemodiálise" },
]

function dateBr(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR") }
function fileName(file: FileItem) { return file.name || file.filename || "anexo" }
function fileMime(file: FileItem) { return file.mimeType || file.contentType || "tipo não informado" }
function size(value?: number) { const v = Number(value || 0); if (!v) return "-"; if (v < 1024) return `${v} B`; if (v < 1048576) return `${Math.round(v / 1024)} KB`; return `${(v / 1048576).toFixed(2)} MB` }
function anexoUrl(uid: string, index: number) { return `/api/admin/judicial/email-integracao/anexo?uid=${encodeURIComponent(uid)}&index=${index}` }
function inferModule(item: PreviewItem) { const t = `${item.subject} ${item.classifier}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); if (t.includes("cnrac")) return "cnrac"; if (t.includes("dialise") || t.includes("hemodialise")) return "hemodialise"; if (t.includes("tfd") || t.includes("tratamento fora")) return "tfd"; return "judicial" }

export function EmailIntegracaoPageV2() {
  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [preview, setPreview] = useState<PreviewItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [routing, setRouting] = useState<Record<string, { modulo: string; responsavelId: string }>>({})
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => { void loadUsers(); void loadHistory() }, [])

  async function loadUsers() {
    const r = await fetch("/api/admin/judicial/email-integracao/regras", { cache: "no-store" })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j?.ok) setUsers(Array.isArray(j.users) ? j.users : [])
  }
  async function loadHistory() {
    const r = await fetch("/api/admin/judicial/email-integracao/historico", { cache: "no-store" })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j?.ok) setHistory(Array.isArray(j.items) ? j.items : [])
  }
  async function testConnection() {
    try { setLoading(true); const r = await fetch("/api/admin/judicial/email-integracao/teste?action=connection", { cache: "no-store" }); const j = await r.json().catch(() => ({})); setConnection(j); if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha na conexão."); toast.success("Conectado.") } finally { setLoading(false) }
  }
  async function previewEmails() {
    try {
      setLoading(true)
      const r = await fetch("/api/admin/judicial/email-integracao/teste?action=preview", { cache: "no-store" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha ao ler e-mails.")
      const items = Array.isArray(j.items) ? j.items : []
      setPreview(items)
      setRouting((current) => { const next = { ...current }; for (const item of items) if (!next[String(item.uid)]) next[String(item.uid)] = { modulo: inferModule(item), responsavelId: "" }; return next })
      toast.success(`${items.length} mensagem(ns) carregada(s).`)
    } finally { setLoading(false) }
  }
  async function runTriageNow() {
    try {
      setRunning(true)
      const r = await fetch("/api/admin/judicial/email-integracao/processar", { method: "POST", cache: "no-store" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha ao executar triagem.")
      toast.success(`${j.processed || 0} mensagem(ns) processada(s).`)
      await loadHistory()
      await previewEmails()
    } finally { setRunning(false) }
  }
  function setRoute(uid: string, patch: Partial<{ modulo: string; responsavelId: string }>) { setRouting((current) => ({ ...current, [uid]: { modulo: current[uid]?.modulo || "judicial", responsavelId: current[uid]?.responsavelId || "", ...patch } })) }
  async function createServiceOrder(item: PreviewItem) {
    const selected = routing[String(item.uid)] || { modulo: inferModule(item), responsavelId: "" }
    if (!selected.responsavelId) return toast.error("Selecione o responsável.")
    const attachments = (item.attachments || []).map((file, index) => ({ ...file, name: fileName(file), url: anexoUrl(String(item.uid), index), mimeType: fileMime(file), size: Number(file.size || 0) }))
    const r = await fetch("/api/email-os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid: item.uid, messageId: item.messageId, subject: item.subject, from: item.from, date: item.date, classifier: item.classifier, pgeNet: item.pgeNet, processo: item.processo, detectedIn: item.detectedIn, modulo: selected.modulo, responsavelId: selected.responsavelId, attachments }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j?.ok) return toast.error(j?.error || "Erro ao criar ordem de serviço.")
    toast.success(`Ordem criada: ${j.os?.protocolo || "sem protocolo"}`)
    setPreview((current) => current.filter((row) => String(row.uid) !== String(item.uid)))
    setRouting((current) => { const next = { ...current }; delete next[String(item.uid)]; return next })
    await loadHistory()
  }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Integração de e-mail</h1><p className="text-sm text-muted-foreground">Leia a caixa, visualize anexos, processe e direcione mensagens.</p></div><Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4" />Teste e execução</CardTitle><CardDescription>Executar triagem processa todas as mensagens da INBOX e remove as já tratadas da caixa.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Button onClick={testConnection} disabled={loading || running}><MailCheck className="mr-2 h-4 w-4" />Testar conexão</Button><Button variant="outline" onClick={previewEmails} disabled={loading || running}><Search className="mr-2 h-4 w-4" />Ler mensagens</Button><Button onClick={runTriageNow} disabled={loading || running}><Play className="mr-2 h-4 w-4" />Executar triagem agora</Button><Button variant="outline" onClick={loadHistory} disabled={loading || running}><History className="mr-2 h-4 w-4" />Atualizar histórico</Button>{loading || running ? <Badge variant="outline"><RefreshCcw className="mr-1 h-3 w-3 animate-spin" />Processando</Badge> : null}</div>{connection ? <div className="rounded-xl border p-4 text-sm"><p><strong>Status:</strong> {connection.ok ? "Conectado" : "Falha"}</p>{connection.error ? <p className="text-destructive"><strong>Erro:</strong> {connection.error}</p> : null}{connection.config ? <p><strong>Conta:</strong> {connection.config.user} • {connection.config.host}:{connection.config.port} • {connection.config.mailbox}</p> : null}{connection.mailbox ? <p><strong>Mensagens IMAP na INBOX:</strong> {connection.mailbox.exists}</p> : null}</div> : null}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Prévia da triagem</CardTitle><CardDescription>Visualize anexos e direcione manualmente as mensagens sem processo detectado.</CardDescription></CardHeader><CardContent>{preview.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma mensagem carregada.</p> : <div className="space-y-3">{preview.map((item) => { const selected = routing[String(item.uid)] || { modulo: inferModule(item), responsavelId: "" }; return <div key={`${item.uid}-${item.subject}`} className="rounded-xl border p-4 text-sm"><p className="font-semibold">{item.subject}</p><p className="text-muted-foreground">{item.from}</p><div className="mt-2 grid gap-2 md:grid-cols-4"><div><strong>PGE.net:</strong> {item.pgeNet || "-"}</div><div><strong>Processo:</strong> {item.processo || "-"}</div><div><strong>Detectado:</strong> {item.detectedIn || "não detectado"}</div><div><strong>Anexos:</strong> {item.attachments?.length || 0}</div></div>{item.simulatedAction?.label ? <div className="mt-2 rounded-lg border border-dashed p-2 text-muted-foreground">{item.simulatedAction.label}</div> : null}{item.attachments?.length ? <div className="mt-3 rounded-lg bg-muted p-3">{item.attachments.map((file, index) => <div key={`${fileName(file)}-${index}`} className="flex flex-wrap items-center gap-2"><span>{fileName(file)} • {fileMime(file)} • {size(file.size)}</span><Button asChild size="sm" variant="outline"><a href={anexoUrl(String(item.uid), index)} target="_blank" rel="noreferrer"><Eye className="mr-1 h-3 w-3" />Visualizar</a></Button></div>)}</div> : null}<div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr_auto]"><select value={selected.modulo} onChange={(e) => setRoute(String(item.uid), { modulo: e.target.value })} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">{MODULES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select><select value={selected.responsavelId} onChange={(e) => setRoute(String(item.uid), { responsavelId: e.target.value })} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Selecione o responsável</option>{users.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.email ? ` (${u.email})` : ""}</option>)}</select><Button type="button" onClick={() => createServiceOrder(item)}>Criar OS</Button></div></div> })}</div>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Histórico de e-mails processados</CardTitle></CardHeader><CardContent>{history.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum e-mail processado.</p> : <div className="space-y-3">{history.map((item) => <div key={item.id} className="rounded-xl border p-4 text-sm"><div className="mb-2 flex justify-between gap-2"><Badge variant={item.status === "ERRO" ? "destructive" : item.status === "OS_CRIADA" ? "secondary" : "default"}>{item.status}</Badge><span className="text-xs text-muted-foreground">{dateBr(item.processadoEm)}</span></div><p className="font-semibold">{item.assunto}</p><p className="text-muted-foreground">Remetente: {item.remetente || "-"}</p><div className="mt-2 grid gap-2 md:grid-cols-4"><div><strong>PGE.net:</strong> {item.pgeNet || "-"}</div><div><strong>Processo:</strong> {item.processo || "-"}</div><div><strong>Monitoramento:</strong> {item.monitoramentoId || "-"}</div><div><strong>OS:</strong> {item.osProtocolo || "-"}</div></div>{item.erro ? <p className="mt-2 text-destructive">Erro: {item.erro}</p> : null}{item.attachments?.length ? <div className="mt-3 rounded-lg bg-muted p-3">{item.attachments.map((file, index) => <div key={`${fileName(file)}-${index}`} className="flex flex-wrap items-center gap-2"><span>{fileName(file)} • {fileMime(file)} • {size(file.size)}</span>{file.url ? <Button asChild size="sm" variant="outline"><a href={file.url} target="_blank" rel="noreferrer"><Eye className="mr-1 h-3 w-3" />Visualizar</a></Button> : null}</div>)}</div> : null}</div>)}</div>}</CardContent></Card>
  </div>
}
