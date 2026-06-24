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

type AttachmentItem = { filename?: string; name?: string; contentType?: string; mimeType?: string; size?: number; url?: string }
type PreviewItem = { uid: number; subject: string; from: string; date: string; classifier: string; pgeNet: string; processo: string; detectedIn?: string; attachments: AttachmentItem[]; simulatedAction?: { type: string; label: string; demanda?: null | { protocolo: string } } }
type ConnectionResult = { ok: boolean; error?: string; config?: { host: string; port: number; user: string; mailbox: string }; mailbox?: { exists: number } }
type UserItem = { id: string; nome: string; email: string }
type RuleItem = { id: string; nome: string; palavras: string[]; ativo: boolean; usuarios: UserItem[] }
type HistoryItem = { id: string; assunto: string; remetente: string; pgeNet: string; processo: string; regraNome: string; status: string; monitoramentoId: string; osProtocolo: string; erro: string; processadoEm: string; lidoEm: string; attachments: AttachmentItem[] }

function formatDate(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR") }
function formatSize(value?: number) { const v = Number(value || 0); if (!v) return "-"; if (v < 1024) return `${v} B`; if (v < 1024 * 1024) return `${Math.round(v / 1024)} KB`; return `${(v / (1024 * 1024)).toFixed(2)} MB` }
function fileName(file: AttachmentItem) { return file.name || file.filename || "anexo" }
function fileMime(file: AttachmentItem) { return file.mimeType || file.contentType || "tipo não informado" }
function fixText(value: string) { return String(value || "").replace(/solicita��o/gi, "solicitação").replace(/informa��es/gi, "informações").replace(/informa��o/gi, "informação").replace(/Ã§/g, "ç").replace(/Ã£/g, "ã").replace(/Ã¡/g, "á").replace(/Ã©/g, "é").replace(/Ãª/g, "ê").replace(/Ã­/g, "í").replace(/Ã³/g, "ó").replace(/Ãº/g, "ú") }

export default function EmailIntegracaoPage() {
  const { user } = useAuth()
  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [items, setItems] = useState<PreviewItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [rules, setRules] = useState<RuleItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [editingRuleId, setEditingRuleId] = useState("")
  const [ruleName, setRuleName] = useState("")
  const [ruleWords, setRuleWords] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const selectedUserSet = useMemo(() => new Set(selectedUsers), [selectedUsers])

  useEffect(() => { void loadRules(); void loadHistory() }, [])

  async function loadRules() {
    const response = await fetch("/api/admin/judicial/email-integracao/regras", { cache: "no-store" })
    const json = await response.json().catch(() => ({}))
    if (response.ok && json?.ok) { setRules(Array.isArray(json.rules) ? json.rules : []); setUsers(Array.isArray(json.users) ? json.users : []) }
  }
  async function loadHistory() {
    const response = await fetch("/api/admin/judicial/email-integracao/historico", { cache: "no-store" })
    const json = await response.json().catch(() => ({}))
    if (response.ok && json?.ok) setHistory(Array.isArray(json.items) ? json.items : [])
  }
  function clearForm() { setEditingRuleId(""); setRuleName(""); setRuleWords(""); setSelectedUsers([]) }
  function editRule(rule: RuleItem) { setEditingRuleId(rule.id); setRuleName(fixText(rule.nome)); setRuleWords(rule.palavras.map(fixText).join(", ")); setSelectedUsers((rule.usuarios || []).map((u) => u.id)); window.scrollTo({ top: 0, behavior: "smooth" }) }
  async function saveRule() {
    if (!ruleName.trim()) return toast.error("Informe o nome do grupo.")
    if (!ruleWords.trim()) return toast.error("Informe as palavras-chave.")
    const response = await fetch("/api/admin/judicial/email-integracao/regras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingRuleId || undefined, nome: ruleName, palavras: ruleWords, usuarioIds: selectedUsers }) })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) return toast.error(json?.error || "Erro ao salvar regra.")
    toast.success(editingRuleId ? "Regra atualizada." : "Regra salva."); clearForm(); await loadRules()
  }
  async function deleteRule(rule: RuleItem) {
    if (!confirm(`Excluir o grupo "${fixText(rule.nome)}"?`)) return
    const response = await fetch("/api/admin/judicial/email-integracao/regras", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, deletedById: user?.id, deletedByName: user?.nome, deletedByEmail: user?.email }) })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) return toast.error(json?.error || "Erro ao excluir grupo.")
    toast.success("Grupo excluído com auditoria."); if (editingRuleId === rule.id) clearForm(); await loadRules()
  }
  function toggleUser(userId: string) { setSelectedUsers((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]) }
  async function testConnection() { try { setLoading(true); const r = await fetch("/api/admin/judicial/email-integracao/teste?action=connection", { cache: "no-store" }); const j = await r.json().catch(() => ({})); setConnection(j); if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha na conexão."); toast.success("Conexão realizada.") } finally { setLoading(false) } }
  async function previewEmails() { try { setLoading(true); const r = await fetch("/api/admin/judicial/email-integracao/teste?action=preview&limit=10", { cache: "no-store" }); const j = await r.json().catch(() => ({})); if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha ao ler e-mails."); setItems(Array.isArray(j.items) ? j.items : []); toast.success("Prévia carregada.") } finally { setLoading(false) } }
  async function runTriageNow() { try { setRunning(true); const r = await fetch("/api/admin/judicial/email-integracao/processar?limit=10", { method: "POST", cache: "no-store" }); const j = await r.json().catch(() => ({})); if (!r.ok || !j?.ok) return toast.error(j?.error || "Falha ao executar triagem."); toast.success(`${j.processed || 0} mensagem(ns) tratada(s).`); await previewEmails(); await loadHistory() } finally { setRunning(false) } }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Integração de e-mail</h1><p className="text-sm text-muted-foreground">Configure grupos, execute a triagem e acompanhe o histórico.</p></div><Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link></Button></div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4" /> Teste e execução</CardTitle><CardDescription>A triagem lê mensagens recentes ainda não processadas, cria movimentações/OS, salva histórico e marca o Gmail como lido.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Button onClick={testConnection} disabled={loading || running}><MailCheck className="mr-2 h-4 w-4" /> Testar conexão</Button><Button variant="outline" className="bg-transparent" onClick={previewEmails} disabled={loading || running}><Search className="mr-2 h-4 w-4" /> Ler últimas 10 mensagens</Button><Button onClick={runTriageNow} disabled={loading || running}><Play className="mr-2 h-4 w-4" /> Executar triagem agora</Button><Button variant="outline" className="bg-transparent" onClick={loadHistory} disabled={loading || running}><History className="mr-2 h-4 w-4" /> Atualizar histórico</Button>{loading || running ? <Badge variant="outline"><RefreshCcw className="mr-1 h-3 w-3 animate-spin" /> Processando</Badge> : null}</div>{connection ? <div className="rounded-xl border p-4 text-sm"><p><strong>Status:</strong> {connection.ok ? "Conectado" : "Falha"}</p>{connection.error ? <p className="text-destructive"><strong>Erro:</strong> {connection.error}</p> : null}{connection.config ? <p><strong>Conta:</strong> {connection.config.user} • {connection.config.host}:{connection.config.port} • {connection.config.mailbox}</p> : null}{connection.mailbox ? <p><strong>Mensagens IMAP na INBOX:</strong> {connection.mailbox.exists}</p> : null}</div> : null}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Grupos de palavras-chave e responsáveis</CardTitle><CardDescription>Você pode editar ou excluir grupos. Exclusão fica auditada com usuário e data/hora.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 lg:grid-cols-[1fr_2fr]"><div className="space-y-2"><Label>Grupo</Label><Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Ex.: Inicial" /></div><div className="space-y-2"><Label>Palavras-chave</Label><Input value={ruleWords} onChange={(e) => setRuleWords(e.target.value)} placeholder="Ex.: inicial, solicitação de informações" /></div></div><div className="space-y-2"><Label>Responsáveis</Label><div className="grid max-h-56 gap-2 overflow-auto rounded-xl border p-3 md:grid-cols-2 lg:grid-cols-3">{users.map((u) => <label key={u.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-muted"><input type="checkbox" checked={selectedUserSet.has(u.id)} onChange={() => toggleUser(u.id)} className="mt-1" /><span><strong>{fixText(u.nome)}</strong><br /><span className="text-xs text-muted-foreground">{u.email || "Sem e-mail"}</span></span></label>)}</div></div><div className="flex flex-wrap gap-2"><Button onClick={saveRule}><Save className="mr-2 h-4 w-4" /> {editingRuleId ? "Atualizar regra" : "Salvar regra"}</Button>{editingRuleId ? <Button variant="outline" className="bg-transparent" onClick={clearForm}><X className="mr-2 h-4 w-4" /> Cancelar edição</Button> : null}</div><div className="space-y-2">{rules.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p> : rules.map((rule) => <div key={rule.id} className="rounded-xl border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge>{fixText(rule.nome)}</Badge><span className="text-muted-foreground">{rule.palavras.map(fixText).join(", ")}</span><Button size="sm" variant="outline" className="ml-auto bg-transparent" onClick={() => editRule(rule)}><Edit3 className="mr-1 h-3 w-3" /> Editar</Button><Button size="sm" variant="destructive" onClick={() => deleteRule(rule)}><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button></div><p className="mt-2 text-xs text-muted-foreground">Responsáveis: {rule.usuarios?.length ? rule.usuarios.map((u) => fixText(u.nome)).join(", ") : "nenhum"}</p></div>)}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Histórico de e-mails processados</CardTitle><CardDescription>Data, título, status, vínculo, OS e anexos.</CardDescription></CardHeader><CardContent>{history.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum e-mail processado.</p> : <div className="space-y-3">{history.map((item) => <div key={item.id} className="rounded-xl border p-4 text-sm"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge variant={item.status === "ERRO" || item.status === "ERRO_LEITURA" ? "destructive" : item.status === "OS_CRIADA" ? "secondary" : "default"}>{item.status}</Badge>{item.regraNome ? <Badge variant="outline">{fixText(item.regraNome)}</Badge> : null}</div><span className="text-xs text-muted-foreground">{formatDate(item.processadoEm)}</span></div><p className="font-semibold">{item.assunto || "Sem assunto"}</p><p className="text-muted-foreground">Remetente: {item.remetente || "-"}</p><div className="mt-2 grid gap-2 md:grid-cols-4"><div><strong>PGE.net:</strong> {item.pgeNet || "-"}</div><div><strong>Processo:</strong> {item.processo || "-"}</div><div><strong>Monitoramento:</strong> {item.monitoramentoId || "-"}</div><div><strong>OS:</strong> {item.osProtocolo || "-"}</div></div>{item.erro ? <p className="mt-2 text-destructive">Erro: {item.erro}</p> : null}{item.attachments?.length ? <div className="mt-3 rounded-lg bg-muted p-3">{item.attachments.map((file, index) => <div key={`${fileName(file)}-${index}`} className="flex flex-wrap items-center gap-2"><span>{fileName(file)} • {fileMime(file)} • {formatSize(file.size)}</span>{file.url ? <Button asChild size="sm" variant="outline" className="bg-transparent"><a href={file.url} target="_blank" rel="noreferrer"><Eye className="mr-1 h-3 w-3" /> Visualizar</a></Button> : null}</div>)}</div> : null}</div>)}</div>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Prévia da triagem</CardTitle><CardDescription>Consulta sem gravar dados.</CardDescription></CardHeader><CardContent>{items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma mensagem carregada.</p> : <div className="space-y-3">{items.map((item) => <div key={`${item.uid}-${item.subject}`} className="rounded-xl border p-4 text-sm"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><Badge>{fixText(item.classifier)}</Badge><span className="text-xs text-muted-foreground">{formatDate(item.date)}</span></div><p className="font-semibold">{item.subject || "Sem assunto"}</p><p className="text-muted-foreground">Remetente: {item.from || "-"}</p><div className="mt-2 grid gap-2 md:grid-cols-4"><div><strong>PGE.net:</strong> {item.pgeNet || "Não detectado"}</div><div><strong>Processo:</strong> {item.processo || "Não detectado"}</div><div><strong>Detectado em:</strong> {item.detectedIn || "-"}</div><div><strong>Anexos:</strong> {item.attachments?.length || 0}</div></div>{item.simulatedAction ? <div className="mt-3 rounded-lg border border-dashed p-3"><strong>Ação simulada:</strong> {item.simulatedAction.label}</div> : null}</div>)}</div>}</CardContent></Card>
    </div>
  )
}
