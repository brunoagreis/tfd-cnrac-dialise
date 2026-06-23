"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MunicipalityPortalLogo } from "@/components/municipio/municipality-portal-logo"

type User = { municipalityName: string; email: string }
type Demand = { protocolo: string; modulo: string; nomePaciente: string; processo: string; createdAt: string | null; municipio?: string; codigoSigtap?: string; descricaoSigtap?: string; cid10?: string; naoLidoMunicipio?: boolean; ultimaInteracaoInterna?: string | null }
type Interaction = { id: string; texto: string; createdAt: string | null; createdByName: string }
type Upload = { id: string; nomeArquivo: string; tamanho: number; createdAt: string | null }

function moduleLabel(value: string) {
  const labels: Record<string, string> = { tfd: "TFD", cnrac: "CNRAC", hemodialise: "Hemodiálise", judicial: "Judicial", pre_judicial: "Pré Judicial" }
  return labels[value] || value
}

function getAttachmentUrl(text: string) {
  const match = text.match(/Link:\s*(\/api\/municipio\/demandas\/anexo\/baixar\/[^\s]+)/i)
  return match?.[1] || ""
}

function getCleanText(text: string) {
  return text.replace(/\s*Link:\s*\/api\/municipio\/demandas\/anexo\/baixar\/[^\s]+/i, "").trim()
}

function InteractionCard({ item }: { item: Interaction }) {
  const url = getAttachmentUrl(item.texto)
  const cleanText = getCleanText(item.texto)

  return (
    <div className="mt-2 rounded border p-2 text-sm">
      <p className="whitespace-pre-wrap">{cleanText}</p>
      {url ? (
        <a className="mt-2 inline-flex rounded-md border border-border px-3 py-1.5 font-medium text-primary hover:bg-muted" href={url} target="_blank" rel="noreferrer">
          Abrir anexo
        </a>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">{item.createdByName}</p>
    </div>
  )
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
    setItems((current) => current.map((item) => item.protocolo === protocolo ? { ...item, naoLidoMunicipio: false } : item))
    setMessage("")
    setFile(null)
  }

  async function uploadSelectedFile(protocolo: string, selectedFile: File) {
    const form = new FormData()
    form.set("protocolo", protocolo)
    form.set("file", selectedFile)
    const response = await fetch("/api/municipio/demandas/anexo", { method: "POST", body: form })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao anexar arquivo.")
  }

  async function sendMessage() {
    if (!detail || !message.trim()) return
    const selectedFile = file
    const response = await fetch("/api/municipio/demandas/interacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocolo: detail.protocolo, texto: message }) })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) { toast.error(json?.error || "Erro ao enviar manifestação."); return }
    if (selectedFile) {
      try {
        await uploadSelectedFile(detail.protocolo, selectedFile)
        toast.success("Manifestação e anexo enviados.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Manifestação salva, mas o anexo falhou.")
      }
    } else {
      toast.success("Manifestação enviada.")
    }
    await openDemand(detail.protocolo)
  }

  async function sendFile() {
    if (!detail || !file) return
    try {
      await uploadSelectedFile(detail.protocolo, file)
      toast.success("Arquivo anexado.")
      await openDemand(detail.protocolo)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao anexar arquivo.")
    }
  }

  async function logout() {
    await fetch("/api/municipio/sair", { method: "POST" })
    router.replace("/municipio/login")
  }

  if (!user) return <div className="p-8 text-muted-foreground">Carregando...</div>

  return <main className="min-h-screen bg-background"><div className="bg-primary text-primary-foreground"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5"><div className="flex items-center gap-4"><MunicipalityPortalLogo variant="white" className="h-12 w-auto max-w-[260px] object-contain" /><div><h1 className="text-2xl font-bold">Portal do Município</h1><p className="text-sm opacity-90">{user.municipalityName} • {user.email}</p></div></div><Button variant="secondary" onClick={logout}>Sair</Button></div></div><div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
    <Card><CardHeader><CardTitle>Demandas</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar" /><Button onClick={load}>Pesquisar</Button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Aviso</th><th className="p-2 text-left">Paciente</th><th className="p-2 text-left">Processo</th><th className="p-2 text-left">Protocolo</th><th className="p-2 text-left">Módulo</th><th className="p-2 text-left">Opções</th></tr></thead><tbody>{items.map((item) => <tr key={item.protocolo} className="border-t"><td className="p-2">{item.naoLidoMunicipio ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Nova interação</span> : <span className="text-xs text-muted-foreground">-</span>}</td><td className="p-2">{item.nomePaciente}</td><td className="p-2">{item.processo || "-"}</td><td className="p-2">{item.protocolo}</td><td className="p-2">{moduleLabel(item.modulo)}</td><td className="p-2"><Button size="sm" variant="outline" onClick={() => openDemand(item.protocolo)}>Abrir</Button></td></tr>)}</tbody></table></div></CardContent></Card>
    {detail ? <Card><CardHeader><CardTitle>{detail.protocolo}</CardTitle></CardHeader><CardContent className="grid gap-6 lg:grid-cols-2"><div className="space-y-3"><p><b>Paciente:</b> {detail.nomePaciente || "-"}</p><p><b>Processo:</b> {detail.processo || "-"}</p><p><b>Município:</b> {detail.municipio || "-"}</p><p><b>SIGTAP:</b> {detail.codigoSigtap || "-"} {detail.descricaoSigtap || ""}</p><p><b>CID:</b> {detail.cid10 || "-"}</p><textarea className="min-h-28 w-full rounded-md border p-2" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Manifestação do município" /><Button onClick={sendMessage} disabled={!message.trim()}>Enviar manifestação{file ? " com anexo" : ""}</Button><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /><Button variant="outline" onClick={sendFile} disabled={!file}>Anexar arquivo</Button><p className="text-xs text-muted-foreground">O município pode anexar e visualizar arquivos deste portal.</p></div><div className="space-y-4"><div><h2 className="font-semibold">Interações</h2>{interactions.map((item) => <InteractionCard key={item.id} item={item} />)}</div><div><h2 className="font-semibold">Anexos enviados</h2>{uploads.map((item) => <div key={item.id} className="mt-2 rounded border p-2 text-sm"><a className="font-medium text-primary hover:underline" href={`/api/municipio/demandas/anexo/visualizar/${item.id}`} target="_blank" rel="noreferrer">{item.nomeArquivo}</a></div>)}</div></div></CardContent></Card> : null}
  </div></main>
}
