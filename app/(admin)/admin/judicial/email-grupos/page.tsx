"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Save, Tags, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

type UserItem = { id: string; nome: string; email: string }
type RuleItem = { id: string; nome: string; palavras: string[]; usuarios: UserItem[] }

function splitWords(value: string) {
  return value.split(/[,;\n]+/g).map((item) => item.trim()).filter(Boolean)
}

export default function EmailGroupsPage() {
  const { user } = useAuth()
  const [rules, setRules] = useState<RuleItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [editingId, setEditingId] = useState("")
  const [nome, setNome] = useState("")
  const [palavras, setPalavras] = useState("")
  const [usuarioIds, setUsuarioIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const canAccess = useMemo(() => canAccessJudicialAdmin(user), [user])

  useEffect(() => { if (canAccess) void loadData() }, [canAccess])

  async function loadData() {
    const r = await fetch("/api/admin/judicial/email-integracao/regras", { cache: "no-store" })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j?.ok) return toast.error(j?.error || "Erro ao carregar grupos.")
    setRules(Array.isArray(j.rules) ? j.rules : [])
    setUsers(Array.isArray(j.users) ? j.users : [])
  }

  function resetForm() {
    setEditingId("")
    setNome("")
    setPalavras("")
    setUsuarioIds([])
  }

  function edit(rule: RuleItem) {
    setEditingId(rule.id)
    setNome(rule.nome)
    setPalavras((rule.palavras || []).join(", "))
    setUsuarioIds((rule.usuarios || []).map((u) => u.id))
  }

  function toggleUser(id: string) {
    setUsuarioIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function save() {
    const words = splitWords(palavras)
    if (!nome.trim()) return toast.error("Informe o nome do grupo.")
    if (words.length === 0) return toast.error("Informe ao menos uma palavra-chave.")
    if (usuarioIds.length === 0) return toast.error("Selecione ao menos um responsável.")
    try {
      setLoading(true)
      const r = await fetch("/api/admin/judicial/email-integracao/regras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId || undefined, nome, palavras: words, usuarioIds }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Erro ao salvar grupo.")
      toast.success("Grupo salvo.")
      resetForm()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar grupo.")
    } finally {
      setLoading(false)
    }
  }

  async function remove(rule: RuleItem) {
    if (!confirm(`Excluir o grupo ${rule.nome}?`)) return
    const r = await fetch("/api/admin/judicial/email-integracao/regras", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, deletedById: user?.id, deletedByName: user?.nome || "Administrador", deletedByEmail: user?.email }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j?.ok) return toast.error(j?.error || "Erro ao excluir grupo.")
    toast.success("Grupo excluído.")
    await loadData()
  }

  if (!canAccess) return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar os grupos de e-mail.</div>

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Tags className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grupos de palavras-chave</h1>
          <p className="text-sm text-muted-foreground">Cadastre grupos como Inicial, Descumprimento e Redirecionamento, suas palavras e responsáveis.</p>
        </div>
      </div>
      <Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin Judicial</Link></Button>
    </div>

    <Card>
      <CardHeader><CardTitle>{editingId ? "Editar grupo" : "Novo grupo"}</CardTitle><CardDescription>Quando uma palavra do grupo for encontrada no assunto ou corpo do e-mail, o sistema direciona automaticamente ao responsável do rodízio.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Nome do grupo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Inicial" /></div>
          <div><Label>Palavras-chave</Label><Input value={palavras} onChange={(e) => setPalavras(e.target.value)} placeholder="inicial, solicitação de informações, cumprimento" /></div>
        </div>
        <div>
          <Label>Responsáveis</Label>
          <div className="mt-2 grid max-h-72 gap-2 overflow-auto rounded-xl border p-3 md:grid-cols-2 xl:grid-cols-3">
            {users.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" checked={usuarioIds.includes(item.id)} onChange={() => toggleUser(item.id)} /><span>{item.nome}{item.email ? ` (${item.email})` : ""}</span></label>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={loading}><Save className="mr-2 h-4 w-4" />{editingId ? "Atualizar grupo" : "Salvar grupo"}</Button>{editingId ? <Button variant="outline" className="bg-transparent" onClick={resetForm}>Cancelar edição</Button> : null}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Grupos cadastrados</CardTitle><CardDescription>Esses grupos alimentam a triagem automática a cada 5 minutos.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {rules.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum grupo cadastrado.</p> : rules.map((rule) => <div key={rule.id} className="rounded-xl border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <h2 className="font-semibold">{rule.nome}</h2>
              <div className="flex flex-wrap gap-2">{(rule.palavras || []).map((word) => <Badge key={word} variant="outline">{word}</Badge>)}</div>
              <p className="text-sm text-muted-foreground">Responsáveis: {(rule.usuarios || []).map((u) => u.nome).join(", ") || "nenhum"}</p>
            </div>
            <div className="flex gap-2"><Button variant="outline" className="bg-transparent" onClick={() => edit(rule)}>Editar</Button><Button variant="destructive" onClick={() => remove(rule)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button></div>
          </div>
        </div>)}
      </CardContent>
    </Card>
  </div>
}
