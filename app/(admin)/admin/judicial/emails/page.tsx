"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Italic,
  List,
  ListOrdered,
  Save,
  Strikethrough,
  Underline,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import type { EmailTemplate } from "@/lib/judicial-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const DEFAULT_HTML = "<p>Prezados,</p><p><br></p><p>Atenciosamente,</p><p>$user_sistema</p>"
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
const FONT_FAMILIES = ["Arial", "Verdana", "Tahoma", "Times New Roman", "Georgia", "Courier New"]
const FONT_SIZES = [
  ["2", "10"],
  ["3", "12"],
  ["4", "14"],
  ["5", "18"],
  ["6", "24"],
]

function htmlHasContent(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim().length > 0
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function bodyToHtml(value: string) {
  if (/<[^>]+>/.test(value)) return value
  const lines = value.split(/\r?\n/)
  return lines.map((line) => line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>").join("")
}

export default function EmailsJudiciaisPage() {
  const { user } = useAuth()
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState("")
  const [type, setType] = useState(TYPES[0][0])
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState(DEFAULT_HTML)
  const [fontFamily, setFontFamily] = useState("Arial")
  const [fontSize, setFontSize] = useState("3")

  async function loadItems() {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/judicial/emails", { method: "GET", cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar modelos de e-mail.")
      const next = Array.isArray(json.items) ? json.items : []
      setItems([...next].sort((a, b) => String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "pt-BR")))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar modelos de e-mail.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadItems() }, [])

  useEffect(() => {
    const html = bodyToHtml(body || DEFAULT_HTML)
    if (editorRef.current && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html
    }
  }, [body])

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar esta página.</div>
  }

  function syncEditor() {
    setBody(editorRef.current?.innerHTML || "")
  }

  function command(name: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand("styleWithCSS", false, true)
    document.execCommand(name, false, value)
    syncEditor()
  }

  function resetForm() {
    setEditingId("")
    setType(TYPES[0][0])
    setTitle("")
    setSubject("")
    setBody(DEFAULT_HTML)
    if (editorRef.current) editorRef.current.innerHTML = DEFAULT_HTML
  }

  function loadItem(item: EmailTemplate) {
    const html = bodyToHtml(item.body || DEFAULT_HTML)
    setEditingId(item.id)
    setType(item.type)
    setTitle(item.title)
    setSubject(item.subject)
    setBody(html)
    if (editorRef.current) editorRef.current.innerHTML = html
  }

  async function saveItem() {
    const html = editorRef.current?.innerHTML || body
    if (!title.trim() || !subject.trim() || !htmlHasContent(html)) return toast.error("Título, assunto e corpo são obrigatórios.")
    try {
      setSaving(true)
      const response = await fetch("/api/admin/judicial/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId || undefined, type, title, subject, body: html }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar modelo de e-mail.")
      toast.success("Modelo de e-mail salvo.")
      resetForm()
      await loadItems()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar modelo de e-mail.")
    } finally {
      setSaving(false)
    }
  }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-2xl font-bold tracking-tight">E-mails</h1><p className="text-sm text-muted-foreground">Configurar modelos de e-mail do módulo judicial.</p></div>
      <Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin Judicial</Link></Button>
    </div>

    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader><CardTitle>Modelo de e-mail</CardTitle><CardDescription>Use placeholders como $ficha_core, $cpf, $nome_paciente, $numero_processo e $user_sistema.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Label>Tipo</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <Label>Título interno</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Label>Assunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} />

          <Label>Corpo do e-mail</Label>
          <div className="space-y-2 rounded-xl border border-border bg-muted/10 p-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
              <select value={fontFamily} onChange={(e) => { setFontFamily(e.target.value); command("fontName", e.target.value) }} className="h-9 rounded-md border border-input bg-background px-2 text-xs">
                {FONT_FAMILIES.map((font) => <option key={font} value={font}>{font}</option>)}
              </select>
              <select value={fontSize} onChange={(e) => { setFontSize(e.target.value); command("fontSize", e.target.value) }} className="h-9 rounded-md border border-input bg-background px-2 text-xs">
                {FONT_SIZES.map(([value, label]) => <option key={value} value={value}>{label}px</option>)}
              </select>
              <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Negrito" onClick={() => command("bold")}><Bold className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Itálico" onClick={() => command("italic")}><Italic className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Sublinhado" onClick={() => command("underline")}><Underline className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Tachado" onClick={() => command("strikeThrough")}><Strikethrough className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Alinhar à esquerda" onClick={() => command("justifyLeft")}><AlignLeft className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Centralizar" onClick={() => command("justifyCenter")}><AlignCenter className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Alinhar à direita" onClick={() => command("justifyRight")}><AlignRight className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Lista" onClick={() => command("insertUnorderedList")}><List className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="outline" className="bg-transparent" title="Lista numerada" onClick={() => command("insertOrderedList")}><ListOrdered className="h-4 w-4" /></Button>
            </div>
            <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncEditor} className="min-h-[320px] overflow-auto rounded-lg border border-input bg-background p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-wrap gap-2"><Button onClick={saveItem} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : editingId ? "Atualizar modelo" : "Salvar modelo"}</Button>{editingId ? <Button variant="outline" className="bg-transparent" onClick={resetForm}>Cancelar edição</Button> : null}</div>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Modelos cadastrados</CardTitle><CardDescription>Clique em um modelo para editar.</CardDescription></CardHeader><CardContent className="space-y-2">{loading ? <div className="rounded-xl border p-3 text-sm text-muted-foreground">Carregando modelos...</div> : items.length === 0 ? <div className="rounded-xl border p-3 text-sm text-muted-foreground">Nenhum modelo cadastrado.</div> : items.map((item) => <button key={item.id} type="button" onClick={() => loadItem(item)} className="w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.subject}</p><p className="text-xs text-muted-foreground">{item.type}</p></button>)}</CardContent></Card>
    </div>
  </div>
}
