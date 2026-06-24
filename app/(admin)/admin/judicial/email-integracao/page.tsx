"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Edit3, Eye, History, Inbox, MailCheck, Play, RefreshCcw, Save, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type FileItem = { name?: string; filename?: string; mimeType?: string; contentType?: string; size?: number; url?: string }
type UserItem = { id: string; nome: string; email: string }
type RuleItem = { id: string; nome: string; palavras: string[]; usuarios: UserItem[] }
type HistoryItem = { id: string; assunto: string; remetente: string; pgeNet: string; processo: string; regraNome: string; status: string; monitoramentoId: string; osProtocolo: string; erro: string; processadoEm: string; attachments: FileItem[] }
type PreviewItem = { uid: string; subject: string; from: string; date: string; classifier: string; pgeNet: string; processo: string; detectedIn: string; attachments: FileItem[] }
type ConnectionResult = { ok: boolean; error?: string; config?: { host: string; port: number; user: string; mailbox: string }; mailbox?: { exists: number } }

function formatDate(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR") }
function fileName(file: FileItem) { return file.name || file.filename || "anexo" }
function fileMime(file: FileItem) { return file.mimeType || file.contentType || "tipo não informado" }
function formatSize(value?: number) { const v = Number(value || 0); if (!v) return "-"; if (v < 1024) return `${v} B`; if (v < 1024 * 1024) return `${Math.round(v / 1024)} KB`; return `${(v / 1048576).toFixed(2)} MB` }
function fixText(value: string) { return String(value || "").replace(/solicita��o/gi, "solicitação").replace(/informa��es/gi, "informações").replace(/informa��o/gi, "informação") }

export default function EmailIntegracaoPage() {
  const { user } = useAuth()
  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [preview, setPreview] = useState<PreviewItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [rules, setRules] = useState<RuleItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState("")
  const [ruleName, setRuleName] = useState("")
  const [ruleWords, setRuleWords] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const selectedUserSet = useMemo(() => new Set(selectedUsers), [selectedUsers])

  useEffect(() => { void loadRules(); void loadHistory() }, [])

  async function loadRules() {
    const r = await fetch("/api/admin/judicial/email-integracao/regras", { cache: "no-store" })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j?.ok) { setRules(Array.isArray(j.rules) ? j.rules : []); setUsers(Array.isArray(j.users) ? j.users : []) }
  }
  async function loadHistory() {
    const r = await fetch("/api/admin/judicial/email-integracao/historico", { cache: "no-store" })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j?.ok) setHistory(Array.isArray(j.items) ? j.items : [])
  }
  function clearForm() { setEditingRuleId(""); setRuleName(""); setRuleWords(""); setSelectedUsers([]) }
  function editRule(rule: RuleItem) { setEditingRuleId(rule.id); setRuleName(fixText(rule.nome)); setRuleWords(rule.palavras.map(fixText).join(", ")); setSelectedUsers((rule.usuarios || []).map((u) => u.id)); window.scrollTo({ top: 0, behavior: "smooth" }) }
  function toggleUser(userId: string) { setSelectedUsers((curr) => curr.includes(userId) ? curr.filter((id) => id !== userId) : [...curr, userId]) }
  async function saveRule() {
    if (!ruleName.trim()) return toast.error("Informe o grupo.")
    if (!ruleWords.trim()) return toast.error("Informe as palavras-chave.")
    const r = await fetch("/api/admin/judicial/email-integracao/regras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingRuleId || undefined, nome: ruleName, palavras: ruleWords, usuarioIds: selectedUsers }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j?.ok) return toast.error(j?.error || "Erro ao salvar grupo.")
    toast.success(editingRuleId ? "Grupo atualizado." : "Grupo salvo."); clearForm(); await loadRules()
  }
  async function deleteRule(rule: RuleItem) {
    if (!confirm(`Excluir o grupo ${fixText(rule.nome)}?`)) return
    const r = await fetch("/api/admin/judicial/email-integracao/regras", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, deletedById: user?.id, deletedByName: user?.nome, deletedByEmail: user?.email }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j?.ok) return toast.error(j?.error || "Erro ao excluir grupo.")
    toast.success("Grupo excluído com auditoria."); await loadRules()
  }
  async function testConnection() {
    try { setLoading(true); const r = await fetch("/api/admin/judicial/email-integracao/teste?action=connection", { cache: "no-store" }); const j = await r.json().catch(() => ({})); setConnection(j); if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha na conexão."); toast.success("Conectado.") } finally { setLoading(false) }
  }
  async function previewEmails() {
    try { setLoading(true); const r = await fetch("/api/admin/judicial/email-integracao/teste?action=preview&limit=10", { cache: "no-store" }); const j = await r.json().catch(() => ({})); if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha ao ler e-mails."); setPreview(Array.isArray(j.items) ? j.items : []); toast.success("Prévia carregada.") } finally { setLoading(false) }
  }
  async function runTriageNow() {
    try {
      setRunning(true)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 35000)
      const r = await fetch("/api/admin/judicial/email-integracao/processar?limit=10", { method: "POST", cache: "no-store", signal: controller.signal })
      clearTimeout(timer)
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha ao executar triagem.")
      toast.success(j.processing ? j.message : `${j.processed || 0} mensagem(ns) tratada(s).`)
      await loadHistory()
    } catch (error) {
      toast.error("A triagem demorou mais que o esperado. Atualize o histórico em alguns segundos.")
    } finally { setRunning(false) }
  }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Integração de e-mail</h1><p className="text-sm text-muted-foreground">Configure grupos, execute a triagem e acompanhe o histórico.</p></div><Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link></Button></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4" /> Teste e execução</CardTitle><CardDescription>A triagem cria movimentações/OS, salva histórico e tenta marcar o Gmail como lido.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Button onClick={testConnection} disabled={loading || running}><MailCheck className="mr-2 h-4 w-4" /> Testar conexão</Button><Button variant="outline" className="bg-transparent" onClick={previewEmails} disabled={loading || running}><Search className="mr-2 h-4 w-4" /> Ler últimas 10 mensagens</Button><Button onClick={runTriageNow} disabled={loading || running}><Play className="mr-2 h-4 w-4" /> Executar triagem agora</Button><Button variant="outline" className="bg-transparent" onClick={loadHistory} disabled={loading || running}><History className="mr-2 h-4 w-4" /> Atualizar histórico</Button>{loading || running ? <Badge variant="outline"><RefreshCcw className="mr-1 h-3 w-3 animate-spin" /> Processando</Badge> : null}</div>{connection ? <div className="rounded-xl border p-4 text-sm"><p><strong>Status:</strong> {connection.ok ? "Conectado" : "Falha"}</p>{connection.error ? <p className="text-destructive"><strong>Erro:</strong> {connection.error}</p> : null}{connection.config ? <p><strong>Conta:</strong> {connection.config.user} • {connection.config.host}:{connection.config.port} • {connection.config.mailbox}</p> : null}{connection.mailbox ? <p><strong>Mensagens IMAP na INBOX:</strong> {connection.mailbox.exists}</p> : null}</div> : null}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Grupos de palavras-chave e responsáveis</CardTitle><CardDescription>Você pode editar ou excluir grupos. A exclusão fica auditada.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 lg:grid-cols-[1fr_2fr]"><div className="space-y-2"><Label>Grupo</Label><Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} /></div><div className="space-y-2"><Label>Palavras-chave</Label><Input value={ruleWords} onChange={(e) => setRuleWords(e.target.value)} /></div></div><div className="space-y-2"><Label>Responsáveis</Label><div className="grid max-h-56 gap-2 overflow-auto rounded-xl border p-3 md:grid-cols-2 lg:grid-cols-3">{users.map((u) => <label key={u.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-muted"><input type="checkbox" checked={selectedUserSet.has(u.id)} onChange={() => toggleUser(u.id)} className="mt-1" /><span><strong>{u.nome}</strong><br /><span className="text-xs text-muted-foreground">{u.email || "Sem e-mail"}</span></span></label>)}</div></div><div className="flex gap-2"><Button onClick={saveRule}><Save className="mr-2 h-4 w-4" /> {editingRuleId ? "Atualizar regra" : "Salvar regra"}</Button>{editingRuleId ? <Button variant="outline" className="bg-transparent" onClick={clearForm}><X className="mr-2 h-4 w-4" /> Cancelar</Button> : null}</div><div className="space-y-2">{rules.map((rule) => <div key={rule.id} className="rounded-xl border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge>{fixText(rule.nome)}</Badge><span className="text-muted-foreground">{rule.palavras.map(fixText).join(", ")}</span><Button size="sm" variant="outline" className="ml-auto bg-transparent" onClick={() => editRule(rule)}><Edit3 className="mr-1 h-3 w-3" /> Editar</Button><Button size="sm" variant="destructive" onClick={() => deleteRule(rule)}><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button></div><p className="mt-2 text-xs text-muted-foreground">Responsáveis: {rule.usuarios?.length ? rule.usuarios.map((u) => u.nome).join(", ") : "nenhum"}</p></div>)}</div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Histórico de e-mails processados</CardTitle></CardHeader><CardContent>{history.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum e-mail processado.</p> : <div className="space-y-3">{history.map((item) => <div key={item.id} className="rounded-xl border p-4 text-sm"><div className="mb-2 flex justify-between gap-2"><Badge variant={item.status === "ERRO" ? "destructive" : item.status === "OS_CRIADA" ? "secondary" : "default"}>{item.status}</Badge><span className="text-xs text-muted-foreground">{formatDate(item.processadoEm)}</span></div><p className="font-semibold">{item.assunto}</p><p className="text-muted-foreground">Remetente: {item.remetente || "-"}</p><div className="mt-2 grid gap-2 md:grid-cols-4"><div><strong>PGE.net:</strong> {item.pgeNet || "-"}</div><div><strong>Processo:</strong> {item.processo || "-"}</div><div><strong>Monitoramento:</strong> {item.monitoramentoId || "-"}</div><div><strong>OS:</strong> {item.osProtocolo || "-"}</div></div>{item.erro ? <p className="mt-2 text-destructive">Erro: {item.erro}</p> : null}{item.attachments?.length ? <div className="mt-3 rounded-lg bg-muted p-3">{item.attachments.map((file, index) => <div key={`${fileName(file)}-${index}`} className="flex flex-wrap items-center gap-2"><span>{fileName(file)} • {fileMime(file)} • {formatSize(file.size)}</span>{file.url ? <Button asChild size="sm" variant="outline" className="bg-transparent"><a href={file.url} target="_blank" rel="noreferrer"><Eye className="mr-1 h-3 w-3" /> Visualizar</a></Button> : null}</div>)}</div> : null}</div>)}</div>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Prévia da triagem</CardTitle></CardHeader><CardContent>{preview.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma mensagem carregada.</p> : <div className="space-y-3">{preview.map((item) => <div key={`${item.uid}-${item.subject}`} className="rounded-xl border p-4 text-sm"><p className="font-semibold">{item.subject}</p><p className="text-muted-foreground">{item.from}</p><div className="mt-2 grid gap-2 md:grid-cols-4"><div><strong>PGE.net:</strong> {item.pgeNet || "-"}</div><div><strong>Processo:</strong> {item.processo || "-"}</div><div><strong>Detectado:</strong> {item.detectedIn || "-"}</div><div><strong>Anexos:</strong> {item.attachments?.length || 0}</div></div></div>)}</div>}</CardContent></Card>
  </div>
}
