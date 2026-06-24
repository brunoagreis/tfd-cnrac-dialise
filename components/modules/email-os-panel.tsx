"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRightLeft, FileText, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type OsItem = {
  id: string
  protocolo: string
  assunto: string
  remetente: string
  recebidoEm: string
  pgeNet: string
  processo: string
  status: string
  moduloDestino: string
  responsavelNome: string
  responsavelEmail: string
  anexos: Array<{ name: string; url: string; mimeType: string; size: number }>
}

type UserItem = { id: string; nome: string; email: string }

const MODULES = [
  { value: "judicial", label: "Judicial" },
  { value: "tfd", label: "TFD" },
  { value: "cnrac", label: "CNRAC" },
  { value: "hemodialise", label: "Hemodiálise" },
]

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR")
}

export function EmailOsPanel({ modulo }: { modulo: string }) {
  const [items, setItems] = useState<OsItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedModule, setSelectedModule] = useState<Record<string, string>>({})
  const [selectedUser, setSelectedUser] = useState<Record<string, string>>({})

  async function load() {
    try {
      setLoading(true)
      const [osRes, rulesRes] = await Promise.all([
        fetch(`/api/email-os?modulo=${encodeURIComponent(modulo)}`, { cache: "no-store" }),
        fetch("/api/admin/judicial/email-integracao/regras", { cache: "no-store" }),
      ])
      const osJson = await osRes.json().catch(() => ({}))
      const rulesJson = await rulesRes.json().catch(() => ({}))
      setItems(osRes.ok && osJson?.ok && Array.isArray(osJson.items) ? osJson.items : [])
      setUsers(rulesRes.ok && rulesJson?.ok && Array.isArray(rulesJson.users) ? rulesJson.users : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [modulo])

  async function transfer(os: OsItem) {
    const newModule = selectedModule[os.id] || os.moduloDestino || modulo
    const responsavelId = selectedUser[os.id]
    if (!responsavelId) {
      toast.error("Selecione o responsável pela OS.")
      return
    }
    const response = await fetch("/api/email-os", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ osId: os.id, modulo: newModule, responsavelId }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) {
      toast.error(json?.error || "Erro ao transferir OS.")
      return
    }
    toast.success("OS transferida/direcionada.")
    await load()
  }

  if (!items.length && !loading) return null

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Ordens de Serviço recebidas por e-mail</CardTitle>
            <CardDescription>OS sem cadastro de protocolo. Cadastre no módulo ou transfira para outro setor com responsável.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" className="bg-transparent" onClick={load} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((os) => (
          <div key={os.id} className="rounded-xl border border-border bg-background p-4 text-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{os.protocolo}</Badge>
                <Badge variant="outline">{os.status}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(os.recebidoEm)}</span>
            </div>
            <p className="font-semibold">{os.assunto || "Sem assunto"}</p>
            <p className="text-muted-foreground">Remetente: {os.remetente || "-"}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <div><strong>PGE.net:</strong> {os.pgeNet || "-"}</div>
              <div><strong>Processo:</strong> {os.processo || "-"}</div>
              <div><strong>Responsável:</strong> {os.responsavelNome || "Não definido"}</div>
            </div>
            {os.anexos?.length ? (
              <div className="mt-3 rounded-lg bg-muted p-3">
                {os.anexos.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex flex-wrap items-center gap-2">
                    <FileText className="h-3 w-3" />
                    <span>{file.name}</span>
                    {file.url ? <a className="text-primary underline" href={file.url} target="_blank" rel="noreferrer">Visualizar</a> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr_auto_auto] md:items-center">
              <Select value={selectedModule[os.id] || os.moduloDestino || modulo} onValueChange={(value) => setSelectedModule((prev) => ({ ...prev, [os.id]: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODULES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedUser[os.id] || ""} onValueChange={(value) => setSelectedUser((prev) => ({ ...prev, [os.id]: value }))}>
                <SelectTrigger><SelectValue placeholder="Responsável obrigatório" /></SelectTrigger>
                <SelectContent>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.nome} {user.email ? `(${user.email})` : ""}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" className="bg-transparent" onClick={() => transfer(os)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Transferir
              </Button>
              <Button asChild>
                <Link href={`/solicitacao?osId=${encodeURIComponent(os.id)}&modulo=${encodeURIComponent(os.moduloDestino || modulo)}`}>Cadastrar no módulo</Link>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
