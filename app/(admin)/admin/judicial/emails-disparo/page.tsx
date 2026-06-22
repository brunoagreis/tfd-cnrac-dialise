"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

type Template = {
  id: string
  type: string
  title: string
  subject: string
  body: string
  dispatchModule: string
  automaticDispatch: boolean
}

const modules = [
  { value: "tfd", label: "TFD" },
  { value: "cnrac", label: "CNRAC" },
  { value: "hemodialise", label: "Hemodiálise" },
  { value: "judicial", label: "Judicial" },
  { value: "pre_judicial", label: "Pré Judicial" },
]

export default function JudicialEmailsDisparoPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [saving, setSaving] = useState(false)
  const [choices, setChoices] = useState<Record<string, string>>({})

  useEffect(() => {
    void loadTemplates()
  }, [])

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar modelos de disparo.</div>
  }

  async function loadTemplates() {
    const response = await fetch("/api/admin/judicial/emails", { cache: "no-store" })
    const json = await response.json().catch(() => ({}))
    const items = response.ok && json?.ok && Array.isArray(json?.items) ? json.items : []
    setTemplates(items)

    const next: Record<string, string> = {}
    for (const module of modules) {
      const selected = items.find((item: Template) => item.automaticDispatch && item.dispatchModule === module.value)
      next[module.value] = selected?.id || ""
    }
    setChoices(next)
  }

  async function saveModule(module: string) {
    const templateId = choices[module]
    const template = templates.find((item) => item.id === templateId)
    if (!template) {
      toast.error("Selecione um modelo.")
      return
    }

    try {
      setSaving(true)
      const response = await fetch("/api/admin/judicial/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: template.id,
          type: template.type,
          title: template.title,
          subject: template.subject,
          body: template.body,
          dispatchModule: module,
          automaticDispatch: true,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao configurar modelo automático.")
        return
      }
      toast.success("Modelo automático atualizado.")
      await loadTemplates()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modelos de disparo automático</h1>
          <p className="text-sm text-muted-foreground">Escolha qual modelo de e-mail será usado automaticamente em cada módulo.</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link></Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Configuração por módulo</CardTitle>
          <CardDescription>Os modelos são cadastrados na aba E-mails. Aqui você apenas escolhe qual será usado no disparo automático.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {modules.map((module) => (
            <div key={module.value} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[180px_1fr_auto] md:items-end">
              <div>
                <Label className="mb-1 block text-xs">Módulo</Label>
                <p className="font-semibold">{module.label}</p>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Modelo de e-mail</Label>
                <select value={choices[module.value] || ""} onChange={(event) => setChoices((current) => ({ ...current, [module.value]: event.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Selecione um modelo</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.title} - {template.subject}</option>)}
                </select>
              </div>
              <Button type="button" onClick={() => saveModule(module.value)} disabled={saving || !choices[module.value]}>{saving ? "Salvando..." : "Usar neste módulo"}</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
