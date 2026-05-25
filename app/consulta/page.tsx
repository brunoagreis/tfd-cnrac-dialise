"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Search,
  ShieldCheck,
  FileText,
  ClipboardList,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  Paperclip,
} from "lucide-react"

import { useStore } from "@/lib/store-context"
import {
  MODULE_LABELS,
  DEMANDA_STATUS_LABELS,
  TIPO_SOLICITACAO_LABELS,
  PENDENCIA_LABELS,
  type Module,
  type DemandaStatus,
  type Demanda,
  type Paciente,
} from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const MODULE_ICONS: Record<Module, typeof FileText> = {
  tfd: FileText,
  cnrac: ClipboardList,
  hemodialise: Stethoscope,
}

const STATUS_CONFIG: Record<DemandaStatus, { icon: typeof AlertTriangle; color: string }> = {
  pendente: { icon: AlertTriangle, color: "bg-amber-100 text-amber-800" },
  resolvido: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800" },
  devolvida: { icon: RotateCcw, color: "bg-red-100 text-red-800" },
}

export default function ConsultaPage() {
  const store = useStore()
  const [protocolo, setProtocolo] = useState("")
  const [result, setResult] = useState<{ demanda: Demanda; paciente: Paciente } | null>(null)
  const [searched, setSearched] = useState(false)

  function handleSearch() {
    if (!protocolo.trim()) return
    const demanda = store.getDemandaByProtocol(protocolo.trim().toUpperCase())
    if (demanda) {
      const paciente = store.pacientes.find((p) => p.id === demanda.pacienteId)
      if (paciente) {
        setResult({ demanda, paciente })
      } else {
        setResult(null)
      }
    } else {
      setResult(null)
    }
    setSearched(true)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-4 lg:px-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <ShieldCheck className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
        </div>
        <div>
          <span className="text-sm font-bold text-foreground">SIS Regulacao</span>
          <span className="ml-2 text-xs text-muted-foreground">Consulta de Protocolo</span>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" asChild>
          <Link href="/login">Acessar Sistema</Link>
        </Button>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Consulta de Protocolo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Informe o numero do protocolo para acompanhar sua demanda. Nao e necessario login.
            </p>
          </div>

          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    placeholder="Ex: TFD-2026-00001"
                    value={protocolo}
                    onChange={(e) => { setProtocolo(e.target.value); setSearched(false) }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-9 uppercase"
                    aria-label="Numero do protocolo"
                  />
                </div>
                <Button onClick={handleSearch}>Consultar</Button>
              </div>
            </CardContent>
          </Card>

          {searched && !result && (
            <Card className="mt-6 border-amber-300/30 bg-amber-50">
              <CardContent className="py-8 text-center">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">Protocolo nao encontrado</p>
                <p className="mt-1 text-xs text-amber-700">Verifique o numero e tente novamente.</p>
              </CardContent>
            </Card>
          )}

          {result && <ProtocoloResult demanda={result.demanda} paciente={result.paciente} />}
        </div>
      </main>
    </div>
  )
}

function ProtocoloResult({ demanda, paciente }: { demanda: Demanda; paciente: Paciente }) {
  const Icon = MODULE_ICONS[demanda.modulo]
  const statusCfg = STATUS_CONFIG[demanda.status]
  const StatusIcon = statusCfg.icon

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* Header card */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg text-card-foreground">{demanda.protocolo}</CardTitle>
            <Badge variant="outline" className={statusCfg.color}>
              <StatusIcon className="mr-1 h-3 w-3" />{DEMANDA_STATUS_LABELS[demanda.status]}
            </Badge>
            <Badge variant="secondary"><Icon className="mr-1 h-3 w-3" />{MODULE_LABELS[demanda.modulo]}</Badge>
          </div>
          <CardDescription>
            Criado em {new Date(demanda.criadoEm).toLocaleDateString("pt-BR")} | Ultima atualizacao: {new Date(demanda.atualizadoEm).toLocaleDateString("pt-BR")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div><span className="text-xs text-muted-foreground">Paciente:</span><p className="text-card-foreground">{paciente.nome}</p></div>
            <div><span className="text-xs text-muted-foreground">Procedimento:</span><p className="text-card-foreground">{demanda.descricaoSigtap}</p></div>
            <div><span className="text-xs text-muted-foreground">Especialidade:</span><p className="text-card-foreground">{demanda.especialidade}</p></div>
            <div><span className="text-xs text-muted-foreground">Tipo:</span><p className="text-card-foreground">{TIPO_SOLICITACAO_LABELS[demanda.tipoSolicitacao]}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
            <MessageSquare className="h-4 w-4" /> Movimentacoes ({demanda.interacoes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {demanda.interacoes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma movimentacao registrada.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {demanda.interacoes.map((inter) => (
                <div key={inter.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-card-foreground">{inter.criadoPorNome}</span>
                    <span>{new Date(inter.criadoEm).toLocaleString("pt-BR")}</span>
                    {inter.pendencia && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 text-xs">
                        {PENDENCIA_LABELS[inter.pendencia]}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-card-foreground">{inter.texto}</p>
                  {inter.anexos.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3" /> {inter.anexos.length} documento(s) anexado(s)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Docs count */}
      {(demanda.anexos.length > 0 || demanda.interacoes.some((i) => i.anexos.length > 0)) && (
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 py-4">
            <Paperclip className="h-5 w-5 text-primary" />
            <p className="text-sm text-card-foreground">
              {demanda.anexos.length + demanda.interacoes.reduce((s, i) => s + i.anexos.length, 0)} documento(s) anexado(s) neste protocolo.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
