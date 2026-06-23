"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Edit3, Inbox, MailCheck, Play, RefreshCcw, Save, Search, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AttachmentItem = { filename: string; contentType: string; size: number }
type PreviewItem = {
  uid: number
  messageId: string
  subject: string
  from: string
  date: string
  classifier: string
  pgeNet: string
  processo: string
  detectedIn?: string
  allProcessNumbers?: string[]
  attachments: AttachmentItem[]
  simulatedAction: { type: string; label: string; demanda: null | { id: string; protocolo: string; pacienteNome: string } }
}
type ConnectionResult = {
  ok: boolean
  error?: string
  config?: { host: string; port: number; secure: boolean; user: string; mailbox: string; configured: boolean }
  mailbox?: { exists: number; path: string }
}
type UserItem = { id: string; nome: string; email: string }
type RuleItem = { id: string; nome: string; palavras: string[]; ativo: boolean; usuarios: UserItem[] }

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

function fixText(value: string) {
  return String(value || "")
    .replace(/solicita��o/gi, "solicitação")
    .replace(/informa��es/gi, "informações")
    .replace(/informa��o/gi, "informação")
    .replace(/GonÃ§alves/g, "Gonçalves")
    .replace(/Ã§/g, "ç")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã‰/g, "É")
}

export default function EmailIntegracaoPage() {
  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [items, setItems] = useState<PreviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [rules, setRules] = useState<RuleItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [editingRuleId, setEditingRuleId] = useState("")
  const [ruleName, setRuleName] = useState("")
  const [ruleWords, setRuleWords] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  const selectedUserSet = useMemo(() => new Set(selectedUsers), [selectedUsers])

  useEffect(() => {
    void loadRules()
  }, [])

  async function loadRules() {
    const response = await fetch("/api/admin/judicial/email-integracao/regras", { cache: "no-store" })
    const json = await response.json().catch(() => ({}))
    if (response.ok && json?.ok) {
      setRules(Array.isArray(json.rules) ? json.rules : [])
      setUsers(Array.isArray(json.users) ? json.users : [])
    }
  }

  function clearForm() {
    setEditingRuleId("")
    setRuleName("")
    setRuleWords("")
    setSelectedUsers([])
  }

  function editRule(rule: RuleItem) {
    setEditingRuleId(rule.id)
    setRuleName(fixText(rule.nome))
    setRuleWords(rule.palavras.map(fixText).join(", "))
    setSelectedUsers((rule.usuarios || []).map((user) => user.id))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function saveRule() {
    if (!ruleName.trim()) return toast.error("Informe o nome do grupo.")
    if (!ruleWords.trim()) return toast.error("Informe as palavras-chave.")

    const response = await fetch("/api/admin/judicial/email-integracao/regras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingRuleId || undefined, nome: ruleName, palavras: ruleWords, usuarioIds: selectedUsers }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) return toast.error(json?.error || "Erro ao salvar regra.")
    toast.success(editingRuleId ? "Regra atualizada." : "Regra salva.")
    clearForm()
    await loadRules()
  }

  function toggleUser(userId: string) {
    setSelectedUsers((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId])
  }

  async function testConnection() {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/judicial/email-integracao/teste?action=connection", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      setConnection(json)
      if (!response.ok || !json?.ok) return toast.error(json?.error || "Falha na conexão.")
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
      if (!response.ok || !json?.ok) return toast.error(json?.error || "Falha ao ler e-mails.")
      setItems(Array.isArray(json.items) ? json.items : [])
      toast.success("Prévia carregada.")
    } finally {
      setLoading(false)
    }
  }

  async function runTriageNow() {
    try {
      setRunning(true)
      const response = await fetch("/api/admin/judicial/email-integracao/processar?limit=10", { method: "POST", cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) return toast.error(json?.error || "Falha ao executar triagem.")
      if (json.processing) toast.success(json.message || "Triagem iniciada.")
      else toast.success(`${json.processed || 0} mensagem(ns) nova(s) tratada(s).`)
      await previewEmails()
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integração de e-mail</h1>
          <p className="text-sm text-muted-foreground">Configure grupos, responsáveis e teste a leitura da caixa sigajus.ses.ms@gmail.com.</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link></Button>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4" /> Teste e execução</CardTitle><CardDescription>A prévia não altera dados. A execução trata mensagens não lidas, grava movimentações/anexos, cria OS quando necessário e marca o e-mail como lido.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={testConnection} disabled={loading || running}><MailCheck className="mr-2 h-4 w-4" /> Testar conexão</Button>
            <Button type="button" variant="outline" className="bg-transparent" onClick={previewEmails} disabled={loading || running}><Search className="mr-2 h-4 w-4" /> Ler últimas 10 mensagens</Button>
            <Button type="button" onClick={runTriageNow} disabled={loading || running}><Play className="mr-2 h-4 w-4" /> Executar triagem agora</Button>
            {loading || running ? <Badge variant="outline"><RefreshCcw className="mr-1 h-3 w-3 animate-spin" /> Processando</Badge> : null}
          </div>
          {connection ? <div className="rounded-xl border border-border p-4 text-sm"><p><strong>Status:</strong> {connection.ok ? "Conectado" : "Falha"}</p>{connection.error ? <p className="text-destructive"><strong>Erro:</strong> {connection.error}</p> : null}{connection.config ? <p><strong>Conta:</strong> {connection.config.user} • {connection.config.host}:{connection.config.port} • {connection.config.mailbox}</p> : null}{connection.mailbox ? <p><strong>Mensagens IMAP na INBOX:</strong> {connection.mailbox.exists}</p> : null}{connection.mailbox ? <p className="mt-2 text-xs text-muted-foreground">Observação: o Gmail pode exibir a caixa como conversas agrupadas. O IMAP conta mensagens individuais.</p> : null}</div> : null}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-base">Grupos de palavras-chave e responsáveis</CardTitle><CardDescription>Quando uma palavra do grupo for encontrada no assunto ou corpo do e-mail, o caso será direcionado para os responsáveis selecionados.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
            <div className="space-y-2"><Label>Grupo</Label><Input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="Ex.: Inicial" /></div>
            <div className="space-y-2"><Label>Palavras-chave</Label><Input value={ruleWords} onChange={(event) => setRuleWords(event.target.value)} placeholder="Ex.: inicial, solicitação de informações" /></div>
          </div>
          <div className="space-y-2"><Label>Responsáveis</Label><div className="grid max-h-56 gap-2 overflow-auto rounded-xl border border-border p-3 md:grid-cols-2 lg:grid-cols-3">{users.map((user) => <label key={user.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-muted"><input type="checkbox" checked={selectedUserSet.has(user.id)} onChange={() => toggleUser(user.id)} className="mt-1" /><span><strong>{fixText(user.nome)}</strong><br /><span className="text-xs text-muted-foreground">{user.email || "Sem e-mail"}</span></span></label>)}</div></div>
          <div className="flex flex-wrap gap-2"><Button type="button" onClick={saveRule}><Save className="mr-2 h-4 w-4" /> {editingRuleId ? "Atualizar regra" : "Salvar regra"}</Button>{editingRuleId ? <Button type="button" variant="outline" className="bg-transparent" onClick={clearForm}><X className="mr-2 h-4 w-4" /> Cancelar edição</Button> : null}</div>
          <div className="space-y-2">{rules.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada ainda.</p> : rules.map((rule) => <div key={rule.id} className="rounded-xl border border-border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge>{fixText(rule.nome)}</Badge><span className="text-muted-foreground">{rule.palavras.map(fixText).join(", ")}</span><Button type="button" size="sm" variant="outline" className="ml-auto bg-transparent" onClick={() => editRule(rule)}><Edit3 className="mr-1 h-3 w-3" /> Editar</Button></div><p className="mt-2 text-xs text-muted-foreground">Responsáveis: {rule.usuarios?.length ? rule.usuarios.map((user) => fixText(user.nome)).join(", ") : "nenhum"}</p></div>)}</div>
        </CardContent>
      </Card>

      <Card className="border-border"><CardHeader><CardTitle className="text-base">Prévia da triagem</CardTitle><CardDescription>Mostra assunto, PGE.net/processo detectado no assunto ou corpo, classificador, anexos e ação simulada.</CardDescription></CardHeader><CardContent>{items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma mensagem carregada ainda. Clique em “Ler últimas 10 mensagens”.</p> : <div className="space-y-3">{items.map((item) => <div key={`${item.uid}-${item.messageId}`} className="rounded-xl border border-border p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><Badge variant={item.simulatedAction.type === "vincular_processo" ? "default" : "secondary"}>{fixText(item.classifier)}</Badge><span className="text-xs text-muted-foreground">{formatDate(item.date)}</span></div><h2 className="font-semibold">{item.subject || "Sem assunto"}</h2><p className="mt-1 text-sm text-muted-foreground">Remetente: {item.from || "-"}</p><div className="mt-3 grid gap-2 text-sm md:grid-cols-4"><div><strong>PGE.net:</strong> {item.pgeNet || "Não detectado"}</div><div><strong>Processo:</strong> {item.processo || "Não detectado"}</div><div><strong>Detectado em:</strong> {item.detectedIn || "-"}</div><div><strong>Anexos:</strong> {item.attachments.length}</div></div>{item.allProcessNumbers?.length ? <p className="mt-2 text-xs text-muted-foreground">Números localizados: {item.allProcessNumbers.join(", ")}</p> : null}{item.attachments.length ? <div className="mt-3 rounded-lg bg-muted p-3 text-sm">{item.attachments.map((attachment, index) => <div key={`${attachment.filename}-${index}`}>{attachment.filename} • {attachment.contentType || "tipo não informado"} • {formatSize(attachment.size)}</div>)}</div> : null}<div className="mt-3 rounded-lg border border-dashed border-border p-3 text-sm"><strong>Ação simulada:</strong> {item.simulatedAction.label}{item.simulatedAction.demanda ? <div>Protocolo encontrado: {item.simulatedAction.demanda.protocolo}</div> : null}</div></div>)}</div>}</CardContent></Card>
    </div>
  )
}
