"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import type { EmailTemplate } from "@/lib/judicial-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const DEFAULT_HTML = "<p>Prezados,</p><p></p><p>Atenciosamente,</p><p>$user_sistema</p>"
const TYPES = [
  ["demanda_judicial_cadastrada", "Demanda judicial cadastrada"],
  ["solicitar_inclusao_ficha", "Solicitar inclusão de ficha"],
  ["reiteracao_municipio", "Reiteração ao município"],
  ["agendamento_informado", "Agendamento informado"],
  ["inercia_municipio", "Inércia do município"],
  ["demanda_prejudicial_cadastrada", "Demanda pré judicial cadastrada"],
  ["prazo_prejudicial_vencendo", "Prazo do pré judicial vencendo"],
  ["prazo_prejudicial_vencido", "Prazo do pré judicial vencido"],
]

export default function EmailsJudiciaisPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState("")
  const [type, setType] = useState(TYPES[0][0])
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState(DEFAULT_HTML)

  async function loadItems() {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/judicial/emails", { method: "GET", cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar modelos de e-mail.")
      const next = Array.isArray(json.items) ? json.items : []
      setItems([...next].sort((a, b) => String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "pt-BR")))
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao carregar modelos de e-mail.") }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadItems() }, [])

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar esta página.</div>
  }

  function resetForm() { setEditingId(""); setType(TYPES[0][0]); setTitle(""); setSubject(""); setBody(DEFAULT_HTML) }
  function loadItem(item: EmailTemplate) { setEditingId(item.id); setType(item.type); setTitle(item.title); setSubject(item.subject); setBody(item.body || DEFAULT_HTML) }

  async function saveItem() {
    if (!title.trim() || !subject.trim() || !body.trim()) return toast.error("Título, assunto e corpo são obrigatórios.")
    try {
      setSaving(true)
      const response = await fetch("/api/admin/judicial/emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId || undefined, type, title, subject, body }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar modelo de e-mail.")
      toast.success("Modelo de e-mail salvo.")
      resetForm()
      await loadItems()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar modelo de e-mail.") }
    finally { setSaving(false) }
  }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">E-mails</h1><p className="text-sm text-muted-foreground">Configurar modelos de e-mail do módulo judicial.</p></div><Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin Judicial</Link></Button></div>
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <Card><CardHeader><CardTitle>Modelo de e-mail</CardTitle><CardDescription>Use placeholders como $ficha_core, $cpf, $nome_paciente, $numero_processo e $user_sistema.</CardDescription></CardHeader><CardContent className="space-y-3"><Label>Tipo</Label><select value={type} onChange={(e) => setType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Label>Título interno</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /><Label>Assunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /><Label>Corpo HTML/texto</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} /><div className="flex flex-wrap gap-2"><Button onClick={saveItem} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : editingId ? "Atualizar modelo" : "Salvar modelo"}</Button>{editingId ? <Button variant="outline" className="bg-transparent" onClick={resetForm}>Cancelar edição</Button> : null}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Modelos cadastrados</CardTitle><CardDescription>Clique em um modelo para editar.</CardDescription></CardHeader><CardContent className="space-y-2">{loading ? <div className="rounded-xl border p-3 text-sm text-muted-foreground">Carregando modelos...</div> : items.length === 0 ? <div className="rounded-xl border p-3 text-sm text-muted-foreground">Nenhum modelo cadastrado.</div> : items.map((item) => <button key={item.id} type="button" onClick={() => loadItem(item)} className="w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.subject}</p><p className="text-xs text-muted-foreground">{item.type}</p></button>)}</CardContent></Card>
    </div>
  </div>
}
