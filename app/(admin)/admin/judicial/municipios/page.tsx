"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import type { MunicipalityContact } from "@/lib/judicial-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function MunicipiosJudiciaisPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<MunicipalityContact[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState("")
  const [municipalityName, setMunicipalityName] = useState("")
  const [emails, setEmails] = useState("")
  const [phones, setPhones] = useState("")
  const [contacts, setContacts] = useState("")

  async function loadItems() {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/judicial/municipios", { method: "GET", cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar municípios.")
      const next = Array.isArray(json.items) ? json.items : []
      setItems([...next].sort((a, b) => String(a?.municipalityName ?? "").localeCompare(String(b?.municipalityName ?? ""), "pt-BR")))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar municípios.")
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadItems() }, [])

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar esta página.</div>
  }

  function resetForm() { setEditingId(""); setMunicipalityName(""); setEmails(""); setPhones(""); setContacts("") }
  function loadItem(item: MunicipalityContact) { setEditingId(item.id); setMunicipalityName(item.municipalityName); setEmails(item.emails.join(", ")); setPhones(item.phones.join(", ")); setContacts(item.contacts.join(", ")) }

  async function saveItem() {
    if (!municipalityName.trim()) return toast.error("Informe o município.")
    try {
      setSaving(true)
      const response = await fetch("/api/admin/judicial/municipios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId || undefined, municipalityName, emails: emails.split(",").map((item) => item.trim()).filter(Boolean), phones: phones.split(",").map((item) => item.trim()).filter(Boolean), contacts: contacts.split(",").map((item) => item.trim()).filter(Boolean) }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar município.")
      toast.success("Contatos do município salvos.")
      resetForm()
      await loadItems()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar município.") } finally { setSaving(false) }
  }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Municípios</h1><p className="text-sm text-muted-foreground">Cadastro municipal do fluxo judicial.</p></div><Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin Judicial</Link></Button></div>
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <Card><CardHeader><CardTitle>Cadastro de contatos</CardTitle><CardDescription>Cadastre e-mails, telefones e responsáveis por município.</CardDescription></CardHeader><CardContent className="space-y-3"><Label>Município</Label><Input value={municipalityName} onChange={(e) => setMunicipalityName(e.target.value)} /><Label>E-mails</Label><Input value={emails} onChange={(e) => setEmails(e.target.value)} /><Label>Telefones</Label><Input value={phones} onChange={(e) => setPhones(e.target.value)} /><Label>Contatos</Label><Input value={contacts} onChange={(e) => setContacts(e.target.value)} /><div className="flex flex-wrap gap-2"><Button onClick={saveItem} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : editingId ? "Atualizar município" : "Salvar município"}</Button>{editingId ? <Button variant="outline" className="bg-transparent" onClick={resetForm}>Cancelar edição</Button> : null}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Municípios cadastrados</CardTitle><CardDescription>Clique em um município para editar.</CardDescription></CardHeader><CardContent className="space-y-2">{loading ? <div className="rounded-xl border p-3 text-sm text-muted-foreground">Carregando municípios...</div> : items.length === 0 ? <div className="rounded-xl border p-3 text-sm text-muted-foreground">Nenhum município cadastrado.</div> : items.map((item) => <button key={item.id} type="button" onClick={() => loadItem(item)} className="w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"><div className="mb-1 flex items-center gap-2"><span className="font-medium">{item.municipalityName}</span><Badge variant="outline">{item.emails.length} e-mail(s)</Badge></div><p className="text-sm text-muted-foreground">{item.emails.join(", ") || "sem e-mail"}</p><p className="text-xs text-muted-foreground">{item.contacts.join(", ") || "sem contato"}</p></button>)}</CardContent></Card>
    </div>
  </div>
}
