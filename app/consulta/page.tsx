"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, EyeOff, Search, Shield } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MunicipalityPortalLogo } from "@/components/municipio/municipality-portal-logo"

type ConsultaResult = {
  protocolo: string
  modulo: string
  status: string
  criadoEm: string | null
  atualizadoEm: string | null
  paciente: { nome: string; cpf: string; cns: string; municipio: string }
  processo: string
  procedimento: { codigo: string; descricao: string; cid10: string; especialidade: string; subespecialidade: string }
  movimentos: Array<{ id: string; tipo: string; descricao: string; criadoEm: string | null; criadoPor: string }>
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-BR")
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-medium">{value || "-"}</p></div>
}

export default function ConsultaProtocoloPage() {
  const [protocolo, setProtocolo] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ConsultaResult | null>(null)

  useEffect(() => {
    const block = (event: Event) => event.preventDefault()
    const keyBlock = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && ["p", "s", "c"].includes(key)) event.preventDefault()
      if (key === "printscreen") event.preventDefault()
    }
    document.addEventListener("contextmenu", block)
    document.addEventListener("copy", block)
    document.addEventListener("cut", block)
    document.addEventListener("keydown", keyBlock)
    return () => {
      document.removeEventListener("contextmenu", block)
      document.removeEventListener("copy", block)
      document.removeEventListener("cut", block)
      document.removeEventListener("keydown", keyBlock)
    }
  }, [])

  async function searchProtocol() {
    const value = protocolo.trim().toUpperCase()
    if (!value) {
      toast.error("Informe o protocolo.")
      return
    }
    try {
      setLoading(true)
      setResult(null)
      const response = await fetch(`/api/consulta/protocolo?protocolo=${encodeURIComponent(value)}`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Protocolo não encontrado.")
        return
      }
      setResult(json.item)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="consulta-publica min-h-screen bg-background text-foreground">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          body::before { content: "Impressão não permitida na consulta pública do SIGAJUS."; visibility: visible !important; display: block; padding: 40px; font-size: 18px; font-family: Arial, sans-serif; }
        }
        .consulta-publica { -webkit-user-select: none; user-select: none; }
      `}</style>

      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <MunicipalityPortalLogo variant="white" className="h-12 w-auto max-w-[260px] object-contain" />
            <div><h1 className="text-2xl font-bold tracking-tight">Consulta Pública de Protocolo</h1><p className="text-sm opacity-90">Acompanhamento externo com dados pessoais protegidos.</p></div>
          </div>
          <Button asChild variant="secondary"><Link href="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao login</Link></Button>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <Card className="border-border">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4" /> Buscar protocolo</CardTitle><CardDescription>Informe o protocolo de TFD, CNRAC, Hemodiálise, Judicial ou Pré Judicial.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-2"><Label htmlFor="protocolo">Protocolo</Label><Input id="protocolo" value={protocolo} onChange={(event) => setProtocolo(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchProtocol()} placeholder="Ex.: JUD-2026-00001" /></div>
            <Button onClick={searchProtocol} disabled={loading}>{loading ? "Consultando..." : "Consultar"}</Button>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50 text-blue-950"><CardContent className="flex gap-3 p-4 text-sm"><Shield className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>Consulta pública protegida.</strong> Dados pessoais são mascarados. Documentos, anexos e PDFs não são disponibilizados. Impressão e cópia pelo navegador são bloqueadas.</div></CardContent></Card>

        {result ? <div className="relative"><div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]"><span className="rotate-[-18deg] text-7xl font-black tracking-widest">SIGAJUS</span></div>
          <Card className="border-border"><CardHeader><CardTitle className="text-xl">{result.protocolo}</CardTitle><CardDescription>{result.modulo} • {result.status}</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Info label="Paciente" value={result.paciente.nome} /><Info label="CPF" value={result.paciente.cpf} /><Info label="CNS" value={result.paciente.cns} /><Info label="Município" value={result.paciente.municipio} /><Info label="Autos/Processo" value={result.processo} /><Info label="Criado em" value={formatDate(result.criadoEm)} /><Info label="Atualizado em" value={formatDate(result.atualizadoEm)} /><Info label="Módulo" value={result.modulo} /></CardContent></Card>
          <Card className="mt-6 border-border"><CardHeader><CardTitle className="text-base">Resumo técnico</CardTitle><CardDescription>Informações exibidas sem documentos anexos.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Info label="Procedimento" value={`${result.procedimento.codigo} - ${result.procedimento.descricao}`} /><Info label="CID-10" value={result.procedimento.cid10} /><Info label="Especialidade" value={result.procedimento.especialidade} /><Info label="Subespecialidade" value={result.procedimento.subespecialidade} /></CardContent></Card>
          <Card className="mt-6 border-border"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><EyeOff className="h-4 w-4" /> Movimentações</CardTitle><CardDescription>Arquivos, PDFs e anexos não são exibidos na consulta pública.</CardDescription></CardHeader><CardContent>{result.movimentos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma movimentação pública encontrada.</p> : <div className="space-y-3">{result.movimentos.map((item) => <div key={item.id} className="rounded-xl border border-border p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{item.tipo}</span><span className="text-xs text-muted-foreground">{formatDate(item.criadoEm)}</span></div><p className="whitespace-pre-wrap text-sm leading-relaxed">{item.descricao}</p><p className="mt-2 text-xs text-muted-foreground">Registrado por: {item.criadoPor}</p></div>)}</div>}</CardContent></Card>
        </div> : null}
      </section>
    </main>
  )
}
