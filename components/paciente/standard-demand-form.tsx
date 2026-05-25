
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/lib/store-context"
import { useAuth } from "@/lib/auth-context"
import type { Module, Paciente } from "@/lib/types"

export function StandardDemandForm({
  modulo,
  patient,
  onBack,
  onSaved,
}: {
  modulo: Module
  patient: Paciente
  onBack: () => void
  onSaved: () => void
}) {
  const store = useStore()
  const { user } = useAuth()

  const [localSolicitante, setLocalSolicitante] = useState("")
  const [emailSolicitante, setEmailSolicitante] = useState("")
  const [telefoneSolicitante, setTelefoneSolicitante] = useState([""])
  const [codigoSigtap, setCodigoSigtap] = useState("")
  const [descricaoSigtap, setDescricaoSigtap] = useState("")
  const [cid10, setCid10] = useState("")
  const [especialidade, setEspecialidade] = useState("")
  const [subespecialidade, setSubespecialidade] = useState("")
  const [tipoSolicitacao, setTipoSolicitacao] = useState<"transito" | "definitiva">("transito")
  const [localSolicitado, setLocalSolicitado] = useState("")
  const [observacoesUnidade, setObservacoesUnidade] = useState("")

  function updatePhone(index: number, value: string) {
    setTelefoneSolicitante((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  function addPhone() {
    setTelefoneSolicitante((prev) => [...prev, ""])
  }

  function removePhone(index: number) {
    setTelefoneSolicitante((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    if (!user) return
    if (!localSolicitante || !codigoSigtap || !descricaoSigtap || !cid10 || !especialidade) {
      toast.error("Preencha os campos obrigatórios do cadastro.")
      return
    }

    const demanda = store.addDemanda({
      pacienteId: patient.id,
      modulo,
      localSolicitante,
      telefoneSolicitante: telefoneSolicitante.filter(Boolean),
      emailSolicitante,
      codigoSigtap,
      descricaoSigtap,
      cid10,
      especialidade,
      subespecialidade,
      peso: "",
      altura: "",
      tipoSanguineo: "",
      observacoesUnidade,
      tipoSolicitacao,
      localSolicitado,
      acaoJudicial: false,
      criadoPor: user.id,
      criadoPorNome: user.nome,
    })

    toast.success(`Demanda ${demanda.protocolo} cadastrada com sucesso.`)
    onSaved()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Cadastro de demanda {modulo.toUpperCase()}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs">Local solicitante</Label>
            <Input value={localSolicitante} onChange={(e) => setLocalSolicitante(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">E-mail do solicitante</Label>
            <Input value={emailSolicitante} onChange={(e) => setEmailSolicitante(e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label className="mb-1 block text-xs">Telefone(s) do solicitante</Label>
            {telefoneSolicitante.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <Input value={phone} onChange={(e) => updatePhone(index, e.target.value)} />
                {telefoneSolicitante.length > 1 && (
                  <Button type="button" variant="outline" onClick={() => removePhone(index)}>Remover</Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addPhone}>Adicionar telefone</Button>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Código SIGTAP</Label>
            <Input value={codigoSigtap} onChange={(e) => setCodigoSigtap(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Descrição do procedimento</Label>
            <Input value={descricaoSigtap} onChange={(e) => setDescricaoSigtap(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">CID</Label>
            <Input value={cid10} onChange={(e) => setCid10(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Especialidade</Label>
            <Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Sub Especialidade</Label>
            <Input value={subespecialidade} onChange={(e) => setSubespecialidade(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Tipo de solicitação</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={tipoSolicitacao} onChange={(e) => setTipoSolicitacao(e.target.value as "transito" | "definitiva") }>
              <option value="transito">Trânsito</option>
              <option value="definitiva">Definitiva</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs">Local solicitado</Label>
            <Input value={localSolicitado} onChange={(e) => setLocalSolicitado(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs">Observações</Label>
            <Textarea rows={4} value={observacoesUnidade} onChange={(e) => setObservacoesUnidade(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack}>Voltar</Button>
        <Button type="button" onClick={handleSubmit}>Salvar demanda</Button>
      </div>
    </div>
  )
}
