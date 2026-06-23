"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Copy } from "lucide-react"
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

const placeholderGroups = [
  {
    title: "Dados pessoais do paciente",
    description: "Use quando o modelo precisar identificar o paciente.",
    items: [
      "$nome_paciente",
      "$paciente_nome",
      "$requerente",
      "$cpf",
      "$paciente_cpf",
      "$cns",
      "$paciente_cns",
      "$cartao_sus",
      "$telefone_paciente",
      "$paciente_telefone",
      "$email_paciente",
      "$paciente_email",
      "$data_nascimento",
      "$nascimento_paciente",
      "$endereco_paciente",
    ],
  },
  {
    title: "Comuns a todos os módulos",
    description: "Informações administrativas e de protocolo.",
    items: [
      "$protocolo",
      "$modulo",
      "$municipio",
      "$municipio_paciente",
      "$local_solicitante",
      "$email_solicitante",
      "$telefone_solicitante",
      "$local_solicitado",
      "$tipo_solicitacao",
      "$observacoes",
      "$observacoes_unidade",
      "$user_sistema",
    ],
  },
  {
    title: "Dados clínicos/procedimento",
    description: "Dados do procedimento, CID e classificação clínica.",
    items: [
      "$sigtap",
      "$codigo_sigtap",
      "$sigtap_descricao",
      "$descricao_sigtap",
      "$procedimento",
      "$procedimento_sigtap",
      "$cid",
      "$cid10",
      "$especialidade",
      "$subespecialidade",
      "$peso",
      "$altura",
      "$tipo_sanguineo",
    ],
  },
  {
    title: "TFD",
    description: "Tokens específicos para modelos de TFD.",
    items: ["$protocolo_tfd", "$origem", "$destino", "$tipo_solicitacao", "$data_agendamento"],
  },
  {
    title: "CNRAC",
    description: "Tokens específicos para modelos de CNRAC.",
    items: ["$protocolo_cnrac", "$procedimento_cnrac", "$cid_cnrac", "$ficha_core", "$origem", "$destino"],
  },
  {
    title: "Hemodiálise",
    description: "Tokens específicos para modelos de Hemodiálise.",
    items: ["$protocolo_hemodialise", "$peso", "$altura", "$tipo_sanguineo", "$origem", "$destino"],
  },
  {
    title: "Judicial",
    description: "Tokens específicos para demandas judiciais.",
    items: [
      "$protocolo_judicial",
      "$numero_processo",
      "$autos_acao",
      "$processo",
      "$pge_net",
      "$numero_pge_net",
      "$numero_oficio",
      "$oficio",
      "$tipo_intimacao",
      "$data_recebimento",
      "$data_reiteracao",
      "$prazo_dias",
      "$prazo_final",
    ],
  },
  {
    title: "Pré Judicial",
    description: "Tokens específicos para pré judicial.",
    items: ["$protocolo_prejudicial", "$data_agendamento", "$numero_processo", "$pge_net", "$prazo_dias", "$prazo_final"],
  },
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

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value)
    toast.success(`Copiado: ${value}`)
  }

  async function copyGroup(items: string[]) {
    const value = items.join(" ")
    await navigator.clipboard.writeText(value)
    toast.success("Placeholders copiados.")
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
          <p className="text-sm text-muted-foreground">Escolha qual modelo de e-mail será usado automaticamente em cada módulo e copie os placeholders disponíveis.</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/judicial">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
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

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Placeholders copiáveis</CardTitle>
          <CardDescription>Clique em um placeholder para copiar individualmente, ou copie um grupo inteiro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            O cabeçalho automático do SIGAJUS mostra apenas módulo, protocolo, município e número do processo quando existir. Qualquer outro dado só aparece se você inserir o placeholder no modelo cadastrado.
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {placeholderGroups.map((group) => (
              <div key={group.title} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{group.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="bg-transparent" onClick={() => copyGroup(group.items)}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copiar grupo
                  </Button>
                </div>
                <PlaceholderList items={group.items} onCopy={copyText} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PlaceholderList({ items, onCopy }: { items: string[]; onCopy: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onCopy(item)}
          className="rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          title={`Copiar ${item}`}
        >
          {item}
        </button>
      ))}
    </div>
  )
}
