"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type User = { municipalityName: string; email: string }
type Demand = { protocolo: string; modulo: string; nomePaciente: string; processo: string; createdAt: string | null; municipio?: string; codigoSigtap?: string; descricaoSigtap?: string; cid10?: string }
type Interaction = { id: string; texto: string; createdAt: string | null; createdByName: string }
type Upload = { id: string; nomeArquivo: string; tamanho: number; createdAt: string | null }

function moduleLabel(value: string) {
  const labels: Record<string, string> = { tfd: "TFD", cnrac: "CNRAC", hemodialise: "Hemodiálise", judicial: "Judicial", pre_judicial: "Pré Judicial" }
  return labels[value] || value
}

export default function MunicipioPortalPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [q, setQ] = useState("")
  const [items, setItems] = useState<Demand[]>([])
  const [detail, setDetail] = useState<Demand | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [uploads, setUploads] = useState<Upload[]>([])
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => { void init() }, [])

  async function init() {
    const me = await fetch("/api/municipio/me", { cache: "no-store" })
    const meJson = await me.json().catch(() => ({}))
    if (!me.ok || !meJson?.ok) { router.replace("/municipio/login"); return }
    setUser(meJson.user)
    await load()
  }

  async function load() {
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    const response = await fetch(`/api/municipio/demandas?${params.toString()}`, { cache: "no-store" })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) { toast.error(json?.error || "Erro ao carregar demandas."); return }
    setItems(Array.isArray(json.items) ? json.items : [])
  }

  async function openDemand(protocolo: string) {
    const response = await fetch(`/api/municipio/demandas?protocolo=${encodeURIComponent(protocolo)}`, { cache: "no-store" })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) { toast.error(json?.error || "Erro ao abrir demanda."); return }
    setDetail(json.item)
    setInteractions(Array.isArray(json.interactions) ? json.interactions : [])
    setUploads(Array.isArray(json.uploads) ? json.uploads : [])
    setMessage("")
    setFile(null)
  }

  async function sendMessage() {
    if (!detail || !message.trim()) return
    const response = await fetch("/api/municipio/demandas/interacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocolo: detail.protocolo, texto: message }) })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) { toast.error(json?.error || "Erro ao enviar manifestação."); return }
    toast.success("Manifestação enviada.")
    await openDemand(detail.protocolo)
  }

  async function sendFile() {
    if (!detail || !file) return
    const form = new FormData()
    form.set("protocolo", detail.protocolo)
    form.set("file", file)
    const response = await fetch("/api/municipio/demandas/anexo", { method: "POST", body: form })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) { toast.error(json?.error || "Erro ao anexar arquivo."); return }
    toast.success("Arquivo anexado.")
    await openDemand(detail.protocolo)
  }

  async function logout() {
    await fetch("/api/municipio/sair", { method: "POST" })
    router.replace("/municipio/login")
  }

  if (!user) return <div className="p-8 text-muted-foreground">Carregando...</div>

  return <main className="min-h-screen bg-background p-6"><div className="mx-auto flex max-w-7xl flex-col gap-6">
    <div className="flex items-center justify-between rounded-xl border p-4"><div><h1 className="text-2xl font-bold">Portal do Município</h1><p className="text-sm text-muted-foreground">{user.municipalityName} • {user.email}</p></div><Button variant="outline" onClick={logout}>Sair</Button></div>
    <Card><CardHeader><CardTitle>Demandas</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar" /><Button onClick={load}>Pesquisar</Button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Paciente</th><th className="p-2 text-left">Processo</th><th className="p-2 text-left">Protocolo</th><th className="p-2 text-left">Módulo</th><th className="p-2 text-left">Opções</th></tr></thead><tbody>{items.map((item) => <tr key={item.protocolo} className="border-t"><td className="p-2">{item.nomePaciente}</td><td className="p-2">{item.processo || "-"}</td><td className="p-2">{item.protocolo}</td><td className="p-2">{moduleLabel(item.modulo)}</td><td className="p-2"><Button size="sm" variant="outline" onClick={() => openDemand(item.protocolo)}>Abrir</Button></td></tr>)}</tbody></table></div></CardContent></Card>
    {detail ? <Card><CardHeader><CardTitle>{detail.protocolo}</CardTitle></CardHeader><CardContent className="grid gap-6 lg:grid-cols-2"><div className="space-y-3"><p><b>Paciente:</b> {detail.nomePaciente || "-"}</p><p><b>Processo:</b> {detail.processo || "-"}</p><p><b>Município:</b> {detail.municipio || "-"}</p><p><b>SIGTAP:</b> {detail.codigoSigtap || "-"} {detail.descricaoSigtap || ""}</p><p><b>CID:</b> {detail.cid10 || "-"}</p><textarea className="min-h-28 w-full rounded-md border p-2" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Manifestação do município" /><Button onClick={sendMessage} disabled={!message.trim()}>Enviar manifestação</Button><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /><Button variant="outline" onClick={sendFile} disabled={!file}>Anexar arquivo</Button><p className="text-xs text-muted-foreground">O município pode anexar arquivos, mas não baixa documentos por este portal.</p></div><div className="space-y-4"><div><h2 className="font-semibold">Interações</h2>{interactions.map((item) => <div key={item.id} className="mt-2 rounded border p-2 text-sm"><p>{item.texto}</p><p className="text-xs text-muted-foreground">{item.createdByName}</p></div>)}</div><div><h2 className="font-semibold">Anexos enviados</h2>{uploads.map((item) => <div key={item.id} className="mt-2 rounded border p-2 text-sm">{item.nomeArquivo}</div>)}</div></div></CardContent></Card> : null}
  </div></main>
}
