"use client"

import { useState } from "react"
import { useStore } from "@/lib/store-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  MODULE_LABELS,
  DEMANDA_STATUS_LABELS,
  PENDENCIA_LABELS,
  CATEGORIA_ANEXO,
  CATEGORIA_ANEXO_LABELS,
} from "@/lib/types"
import type { Demanda, CategoriaAnexo } from "@/lib/types"
import {
  FileText,
  Search,
  MessageSquare,
  Paperclip,
  Clock,
  Shield,
  Plus,
  Building2,
} from "lucide-react"
import Link from "next/link"

function maskCpf(cpf: string) {
  return cpf.replace(/^(\d{3})\.\d{3}\.\d{3}(-\d{2})$/, "$1.***.***$2")
}

function maskName(name: string) {
  const parts = name.split(" ")
  if (parts.length <= 1) return name[0] + "***"
  return parts[0] + " " + parts.slice(1).map((p) => p[0] + "***").join(" ")
}

const statusColor: Record<string, string> = {
  pendente: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  resolvido: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  devolvida: "bg-destructive/10 text-destructive",
}

export default function AcompanhamentoPage() {
  const store = useStore()
  const [email, setEmail] = useState("")
  const [authenticated, setAuthenticated] = useState(false)
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [selectedDemanda, setSelectedDemanda] = useState<Demanda | null>(null)
  const [textoManifestacao, setTextoManifestacao] = useState("")
  const [addingDoc, setAddingDoc] = useState(false)
  const [docCategoria, setDocCategoria] = useState<CategoriaAnexo>("laudo")
  const [docDescricao, setDocDescricao] = useState("")

  const handleSearch = () => {
    if (!email.trim()) {
      toast.error("Informe o e-mail da unidade")
      return
    }
    const found = store.demandasByEmail(email)
    if (found.length === 0) {
      toast.error("Nenhuma demanda encontrada para este e-mail")
      return
    }
    setDemandas(found)
    setAuthenticated(true)
  }

  const handleManifestar = () => {
    if (!selectedDemanda || !textoManifestacao.trim()) {
      toast.error("Escreva o texto da manifestacao")
      return
    }
    // Find unidade name from email
    const unidade = store.unidades.find((u) => u.email.toLowerCase() === email.toLowerCase())
    const nomeUnidade = unidade?.nome || email

    store.addInteracao(selectedDemanda.id, {
      texto: textoManifestacao,
      criadoPor: "externo",
      criadoPorNome: nomeUnidade,
      criadoPorCpf: "N/A",
    })

    // Find paciente name for notification
    const paciente = store.pacientes.find((p) => p.id === selectedDemanda.pacienteId)

    // Add notification for internal users
    store.addNotificacao({
      protocolo: selectedDemanda.protocolo,
      modulo: selectedDemanda.modulo,
      mensagem: `Nova manifestacao de ${nomeUnidade} no protocolo ${selectedDemanda.protocolo}`,
      destinatarioId: "all",
      pacienteNome: paciente?.nome || "Paciente",
    })

    // Send email notification
    fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: selectedDemanda.emailSolicitante,
        subject: `SIS Regulacao - Manifestacao no protocolo ${selectedDemanda.protocolo}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#0c7bb3">SIS Regulacao</h2>
            <p>Uma nova manifestacao foi registrada no protocolo <strong>${selectedDemanda.protocolo}</strong>.</p>
            <div style="background:#f4f4f5;padding:16px;border-radius:8px;margin:16px 0">
              <p><strong>${nomeUnidade}:</strong></p>
              <p>${textoManifestacao.slice(0, 300)}</p>
            </div>
          </div>
        `,
      }),
    }).catch(() => {})

    toast.success("Manifestacao registrada com sucesso")
    setTextoManifestacao("")
    // Refresh demanda
    const updated = store.getDemandaByProtocol(selectedDemanda.protocolo)
    if (updated) setSelectedDemanda(updated)
    setDemandas(store.demandasByEmail(email))
  }

  const handleAddDoc = () => {
    if (!selectedDemanda || !docDescricao.trim()) {
      toast.error("Informe a descricao do documento")
      return
    }
    const unidade = store.unidades.find((u) => u.email.toLowerCase() === email.toLowerCase())
    const nomeUnidade = unidade?.nome || email

    store.addAnexoToDemanda(selectedDemanda.id, {
      nome: `doc_${Date.now()}.pdf`,
      tipo: "application/pdf",
      tamanho: 100000,
      categoria: docCategoria,
      descricao: docDescricao,
      criadoPor: "externo",
      criadoPorNome: nomeUnidade,
    })

    toast.success("Documento anexado")
    setDocDescricao("")
    setAddingDoc(false)
    const updated = store.getDemandaByProtocol(selectedDemanda.protocolo)
    if (updated) setSelectedDemanda(updated)
  }

  // Not authenticated yet - show email entry
  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-foreground">Acompanhamento de Demandas</CardTitle>
            <CardDescription>Acesso para unidades de origem e referencia</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-dashed p-4 bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Acesso Restrito</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Dados pessoais do paciente serao ocultados. Voce podera visualizar manifestacoes, anexar documentos, mas nao podera fazer download ou ver dados sigilosos.
              </p>
            </div>
            <div>
              <Label htmlFor="email">E-mail da Unidade</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="unidade@saude.gov.br"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Buscar Demandas
            </Button>
            <Separator />
            <div className="flex flex-col gap-2 text-center">
              <Link href="/solicitacao" className="text-sm text-primary hover:underline">
                Fazer nova solicitacao
              </Link>
              <Link href="/consulta" className="text-sm text-primary hover:underline">
                Consultar por protocolo
              </Link>
              <Link href="/login" className="text-sm text-primary hover:underline">
                Acesso com login e senha
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Detail view
  if (selectedDemanda) {
    const paciente = store.pacientes.find((p) => p.id === selectedDemanda.pacienteId)
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <h1 className="font-bold text-foreground">{selectedDemanda.protocolo}</h1>
                <p className="text-sm text-muted-foreground">
                  {MODULE_LABELS[selectedDemanda.modulo]} - {selectedDemanda.descricaoSigtap}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setSelectedDemanda(null)} className="bg-transparent">
              Voltar
            </Button>
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-6">
          {/* Paciente info (masked) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-foreground">Paciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="font-medium text-foreground">{paciente ? maskName(paciente.nome) : "---"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPF</p>
                  <p className="font-medium text-foreground">{paciente ? maskCpf(paciente.cpf) : "---"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Municipio</p>
                  <p className="font-medium text-foreground">{paciente?.municipio || "---"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-foreground">Status da Demanda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={statusColor[selectedDemanda.status] || ""}>
                    {DEMANDA_STATUS_LABELS[selectedDemanda.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Especialidade</p>
                  <p className="font-medium text-foreground">{selectedDemanda.especialidade}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CID-10</p>
                  <p className="font-medium text-foreground">{selectedDemanda.cid10}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline of interactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-foreground">Manifestacoes</CardTitle>
              <Badge variant="secondary">{selectedDemanda.interacoes.length}</Badge>
            </CardHeader>
            <CardContent>
              {selectedDemanda.interacoes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma manifestacao registrada.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {selectedDemanda.interacoes.map((int) => (
                    <div key={int.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-foreground">{int.criadoPorNome}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(int.criadoEm).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{int.texto}</p>
                      {int.pendencia && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          {PENDENCIA_LABELS[int.pendencia]}
                        </Badge>
                      )}
                      {int.anexos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {int.anexos.map((a) => (
                            <Badge key={a.id} variant="secondary" className="text-xs">
                              <Paperclip className="mr-1 h-3 w-3" />
                              {a.descricao || a.nome}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents list (no download) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-foreground">Documentos Anexados</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setAddingDoc(true)} className="bg-transparent">
                <Plus className="mr-1 h-3 w-3" /> Anexar Documento
              </Button>
            </CardHeader>
            <CardContent>
              {selectedDemanda.anexos.length === 0 && !addingDoc ? (
                <p className="text-sm text-muted-foreground">Nenhum documento.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedDemanda.anexos.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{a.descricao || a.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {CATEGORIA_ANEXO_LABELS[a.categoria]} - Enviado por {a.criadoPorNome}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {addingDoc && (
                <div className="mt-4 rounded-lg border border-dashed p-4 flex flex-col gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Categoria</Label>
                      <Select value={docCategoria} onValueChange={(v) => setDocCategoria(v as CategoriaAnexo)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIA_ANEXO.map((c) => (
                            <SelectItem key={c} value={c}>{CATEGORIA_ANEXO_LABELS[c]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Descricao</Label>
                      <Input value={docDescricao} onChange={(e) => setDocDescricao(e.target.value)} />
                    </div>
                  </div>
                  <Input type="file" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddDoc}>Anexar</Button>
                    <Button size="sm" variant="outline" onClick={() => setAddingDoc(false)} className="bg-transparent">Cancelar</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add manifestation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <MessageSquare className="h-4 w-4" />
                Nova Manifestacao
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                rows={4}
                value={textoManifestacao}
                onChange={(e) => setTextoManifestacao(e.target.value)}
                placeholder="Escreva sua manifestacao..."
              />
              <Button onClick={handleManifestar} className="w-fit">
                Enviar Manifestacao
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-bold text-foreground">Demandas da Unidade</h1>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => { setAuthenticated(false); setDemandas([]) }} className="bg-transparent">
            Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-col gap-3">
          {demandas.map((d) => {
            const paciente = store.pacientes.find((p) => p.id === d.pacienteId)
            return (
              <Card key={d.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedDemanda(d)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono font-bold text-sm text-foreground">{d.protocolo}</p>
                      <p className="text-sm text-muted-foreground">
                        {paciente ? maskName(paciente.nome) : "Paciente"} - {d.descricaoSigtap}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={statusColor[d.status] || ""}>{DEMANDA_STATUS_LABELS[d.status]}</Badge>
                    <Badge variant="secondary">{MODULE_LABELS[d.modulo]}</Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
