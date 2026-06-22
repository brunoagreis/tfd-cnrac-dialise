"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Gavel,
  Printer,
  RotateCcw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ApiPaciente = {
  id: string
  cpf: string
  cartaoSus: string
  nome: string
  dataNascimento: string
  telefones: string[]
  email: string
  municipio: string
  endereco: string
}

type ApiDemanda = {
  id: string
  protocolo: string
  pacienteId: string
  modulo: string
  localSolicitante: string
  telefoneSolicitante: string[]
  emailSolicitante: string
  codigoSigtap: string
  descricaoSigtap: string
  cid10: string
  especialidade: string
  subespecialidade: string
  peso: string
  altura: string
  tipoSanguineo: string
  observacoesUnidade: string
  tipoSolicitacao: string
  localSolicitado: string
  acaoJudicial: boolean
  status: string
  criadoEm: string
  atualizadoEm: string
  criadoPor: string
  criadoPorNome: string
}

type ApiResponse = {
  ok: boolean
  item?: {
    demanda: ApiDemanda
    paciente: ApiPaciente
  }
  error?: string
}

const MODULE_LABELS: Record<string, string> = {
  tfd: "TFD",
  cnrac: "CNRAC",
  hemodialise: "Hemodiálise",
  judicial: "Judicial",
  pre_judicial: "Pré Judicial",
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  resolvido: "Resolvido",
  devolvida: "Devolvida",
}

const STATUS_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string }> = {
  pendente: { icon: AlertTriangle, color: "bg-amber-100 text-amber-800" },
  resolvido: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800" },
  devolvida: { icon: RotateCcw, color: "bg-red-100 text-red-800" },
}

function moduleLabel(value: string) {
  const key = String(value ?? "").toLowerCase()
  return MODULE_LABELS[key] ?? key.toUpperCase() || "Módulo"
}

function statusLabel(value: string) {
  const key = String(value ?? "").toLowerCase()
  return STATUS_LABELS[key] ?? "Pendente"
}

function formatDate(value: string) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleString("pt-BR")
}

function protocolBackHref(modulo: string) {
  const key = String(modulo ?? "").toLowerCase()
  if (key === "judicial") return "/judicial"
  if (key === "pre_judicial") return "/pre-judicial"
  if (["tfd", "cnrac", "hemodialise"].includes(key)) return `/${key}`
  return "/pacientes"
}

export default function ProtocoloPage({
  params,
}: {
  params: Promise<{ protocolo: string }>
}) {
  const { protocolo } = use(params)
  const decodedProtocol = useMemo(() => decodeURIComponent(protocolo), [protocolo])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [demanda, setDemanda] = useState<ApiDemanda | null>(null)
  const [paciente, setPaciente] = useState<ApiPaciente | null>(null)

  useEffect(() => {
    async function loadProtocolo() {
      try {
        setLoading(true)
        setError("")

        const response = await fetch(`/api/protocolo/${encodeURIComponent(decodedProtocol)}`, {
          method: "GET",
          cache: "no-store",
        })
        const json = (await response.json().catch(() => ({}))) as ApiResponse

        if (!response.ok || !json?.ok || !json?.item) {
          setError(json?.error || "Protocolo não encontrado.")
          setDemanda(null)
          setPaciente(null)
          return
        }

        setDemanda(json.item.demanda)
        setPaciente(json.item.paciente)
      } catch (err) {
        console.error("LOAD_PROTOCOLO_ERROR", err)
        setError("Erro ao carregar protocolo.")
        setDemanda(null)
        setPaciente(null)
      } finally {
        setLoading(false)
      }
    }

    void loadProtocolo()
  }, [decodedProtocol])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Carregando protocolo...</h2>
      </div>
    )
  }

  if (!demanda || !paciente) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Protocolo não encontrado</h2>
        <p className="text-sm text-muted-foreground">{error || "O protocolo informado não existe no sistema."}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Voltar ao Dashboard</Link>
        </Button>
      </div>
    )
  }

  const moduleKey = String(demanda.modulo ?? "").toLowerCase()
  const ModuleIcon = moduleKey === "judicial" ? Gavel : FileText
  const statusKey = String(demanda.status || "pendente").toLowerCase()
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pendente
  const StatusIcon = statusCfg.icon

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={protocolBackHref(demanda.modulo)} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{demanda.protocolo}</h1>

              <Badge variant="outline" className={statusCfg.color}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {statusLabel(statusKey)}
              </Badge>

              <Badge variant="secondary">
                <ModuleIcon className="mr-1 h-3 w-3" />
                {moduleLabel(demanda.modulo)}
              </Badge>

              {demanda.acaoJudicial ? (
                <Badge variant="destructive" className="text-xs">Ação Judicial</Badge>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Criado em {formatDate(demanda.criadoEm)} por {demanda.criadoPorNome || "-"}
            </p>
          </div>
        </div>

        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1 h-3.5 w-3.5" />
          Imprimir
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-card-foreground">Paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <InfoRow label="Nome" value={paciente.nome || "-"} />
            <InfoRow label="CPF" value={paciente.cpf || "-"} />
            <InfoRow label="CNS" value={paciente.cartaoSus || "-"} />
            <InfoRow label="Data Nasc." value={formatDate(paciente.dataNascimento)} />
            <InfoRow label="Telefone(s)" value={paciente.telefones?.length ? paciente.telefones.join(", ") : "-"} />
            <InfoRow label="E-mail" value={paciente.email || "-"} />
            <InfoRow label="Município" value={paciente.municipio || "-"} />
            <InfoRow label="Endereço" value={paciente.endereco || "-"} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-card-foreground">Dados do Solicitante</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <InfoRow label="Local" value={demanda.localSolicitante || "-"} />
            <InfoRow label="Telefone(s)" value={demanda.telefoneSolicitante?.length ? demanda.telefoneSolicitante.join(", ") : "-"} />
            <InfoRow label="E-mail" value={demanda.emailSolicitante || "-"} />
            <InfoRow label="Local Solicitado" value={demanda.localSolicitado || "-"} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-card-foreground">Dados Clínicos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <InfoRow label="SIGTAP" value={`${demanda.codigoSigtap || "-"} - ${demanda.descricaoSigtap || "-"}`} />
            <InfoRow label="CID-10" value={demanda.cid10 || "-"} />
            <InfoRow label="Especialidade" value={demanda.especialidade || "-"} />
            <InfoRow label="Subespecialidade" value={demanda.subespecialidade || "-"} />
            <InfoRow label="Peso" value={demanda.peso ? `${demanda.peso} kg` : "-"} />
            <InfoRow label="Altura" value={demanda.altura ? `${demanda.altura} m` : "-"} />
            <InfoRow label="Tipo Sanguíneo" value={demanda.tipoSanguineo || "-"} />
            <InfoRow label="Tipo Solicitação" value={demanda.tipoSolicitacao || "-"} />
          </div>

          {demanda.observacoesUnidade ? (
            <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Observações da Unidade</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-card-foreground">{demanda.observacoesUnidade}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-card-foreground">{value}</span>
    </div>
  )
}
