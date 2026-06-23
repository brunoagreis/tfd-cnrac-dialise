"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type User = { municipalityName: string; email: string }
type Demand = { protocolo: string; modulo: string; nomePaciente: string; processo: string; createdAt: string | null }

function moduleLabel(value: string) {
  const labels: Record<string, string> = { tfd: "TFD", cnrac: "CNRAC", hemodialise: "Hemodiálise", judicial: "Judicial", pre_judicial: "Pré Judicial" }
  return labels[value] || value
}

export default function MunicipioPortalPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [q, setQ] = useState("")
  const [items, setItems] = useState<Demand[]>([])

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

  async function logout() {
    await fetch("/api/municipio/sair", { method: "POST" })
    router.replace("/municipio/login")
  }

  if (!user) return <div className="p-8 text-muted-foreground">Carregando...</div>

  return <main className="min-h-screen bg-background p-6"><div className="mx-auto flex max-w-7xl flex-col gap-6">
    <div className="flex items-center justify-between rounded-xl border p-4"><div><h1 className="text-2xl font-bold">Portal do Município</h1><p className="text-sm text-muted-foreground">{user.municipalityName} • {user.email}</p></div><Button variant="outline" onClick={logout}>Sair</Button></div>
    <Card><CardHeader><CardTitle>Demandas</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar" /><Button onClick={load}>Pesquisar</Button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Paciente</th><th className="p-2 text-left">Processo</th><th className="p-2 text-left">Protocolo</th><th className="p-2 text-left">Módulo</th></tr></thead><tbody>{items.map((item) => <tr key={item.protocolo} className="border-t"><td className="p-2">{item.nomePaciente}</td><td className="p-2">{item.processo || "-"}</td><td className="p-2">{item.protocolo}</td><td className="p-2">{moduleLabel(item.modulo)}</td></tr>)}</tbody></table></div></CardContent></Card>
  </div></main>
}
