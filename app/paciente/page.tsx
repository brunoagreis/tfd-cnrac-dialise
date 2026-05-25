
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Eye, PlusCircle, Search } from "lucide-react"
import { toast } from "sonner"

import { useStore } from "@/lib/store-context"
import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import { usePreJudicial } from "@/lib/pre-judicial-context"
import type { Module, Paciente } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ModuleChooser, type DemandModuleChoice } from "@/components/paciente/module-chooser"
import { StandardDemandForm } from "@/components/paciente/standard-demand-form"
import { JudicialDemandForm } from "@/components/paciente/judicial-demand-form"
import { PreJudicialDemandForm } from "@/components/paciente/pre-judicial-demand-form"

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

export default function PacientesPage() {
  const store = useStore()
  const { user } = useAuth()
  const judicial = useJudicial()
  const pre = usePreJudicial()

  const [search, setSearch] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Paciente | null>(null)
  const [selectedModule, setSelectedModule] = useState<DemandModuleChoice | null>(null)
  const [openModal, setOpenModal] = useState(false)
  const [openHistory, setOpenHistory] = useState(false)

  const patients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return store.pacientes

    const qDigits = onlyDigits(q)
    return store.pacientes.filter((p) => {
      const hay = `${p.nome} ${p.cpf} ${p.cartaoSus} ${p.municipio}`.toLowerCase()
      return hay.includes(q) || (!!qDigits && (onlyDigits(p.cpf).includes(qDigits) || p.cartaoSus.includes(qDigits)))
    })
  }, [search, store.pacientes])

  function openDemand(patient: Paciente) {
    setSelectedPatient(patient)
    setSelectedModule(null)
    setOpenModal(true)
  }

  function openPatientHistory(patient: Paciente) {
    setSelectedPatient(patient)
    setOpenHistory(true)
  }

  function closeModal() {
    setOpenModal(false)
    setSelectedModule(null)
  }

  const genericHistory = selectedPatient ? store.demandasByPaciente(selectedPatient.id) : []
  const judicialHistory = selectedPatient
    ? judicial.cases.filter((item) => item.patientId === selectedPatient.id || onlyDigits(item.cpf) === onlyDigits(selectedPatient.cpf))
    : []
  const preHistory = selectedPatient
    ? pre.cases.filter((item) => item.patientId === selectedPatient.id || onlyDigits(item.cpf) === onlyDigits(selectedPatient.cpf))
    : []

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Painel Administrativo</p>
        <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
        <p className="text-muted-foreground">Busque um paciente pelo CPF, CNS ou nome e abra o cadastro de demanda por módulo.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buscar Paciente (CPF / CNS)</CardTitle>
          <CardDescription>Informe CPF, CNS ou nome do paciente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite CPF, CNS ou nome" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {patients.map((patient) => {
          const genericCount = store.demandasByPaciente(patient.id).length
          const judicialCount = judicial.cases.filter((item) => item.patientId === patient.id || onlyDigits(item.cpf) === onlyDigits(patient.cpf)).length
          const preCount = pre.cases.filter((item) => item.patientId === patient.id || onlyDigits(item.cpf) === onlyDigits(patient.cpf)).length
          const totalCount = genericCount + judicialCount + preCount

          return (
            <Card key={patient.id} className="border-border">
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                  <h3 className="text-2xl font-semibold">{patient.nome}</h3>
                  <p className="text-sm text-muted-foreground">CPF: {patient.cpf} | CNS: {patient.cartaoSus}</p>
                  <p className="text-sm text-muted-foreground">{patient.municipio}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{totalCount} demanda(s) registrada(s)</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => openPatientHistory(patient)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver histórico
                  </Button>
                  <Button type="button" onClick={() => openDemand(patient)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nova Demanda
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Demanda para {selectedPatient?.nome}</DialogTitle>
            <DialogDescription>
              CPF: {selectedPatient?.cpf} | CNS: {selectedPatient?.cartaoSus}
            </DialogDescription>
          </DialogHeader>

          {!selectedPatient ? null : !selectedModule ? (
            <ModuleChooser onChoose={setSelectedModule} />
          ) : selectedModule === "judicial" ? (
            <JudicialDemandForm patient={selectedPatient} onBack={() => setSelectedModule(null)} onSaved={closeModal} />
          ) : selectedModule === "pre_judicial" ? (
            <PreJudicialDemandForm patient={selectedPatient} onBack={() => setSelectedModule(null)} onSaved={closeModal} />
          ) : (
            <StandardDemandForm
              modulo={selectedModule as Module}
              patient={selectedPatient}
              onBack={() => setSelectedModule(null)}
              onSaved={closeModal}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openHistory} onOpenChange={setOpenHistory}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico do paciente {selectedPatient?.nome}</DialogTitle>
            <DialogDescription>Protocolos e fluxos já cadastrados para este paciente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">TFD / CNRAC / Hemodiálise</h3>
              <div className="space-y-2">
                {genericHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma demanda cadastrada.</p>
                ) : (
                  genericHistory.map((item) => (
                    <Link key={item.id} href={`/protocolo/${item.protocolo}`} className="block rounded-xl border border-border p-3 hover:bg-muted/50">
                      <p className="font-medium">{item.protocolo}</p>
                      <p className="text-sm text-muted-foreground">{item.modulo.toUpperCase()} • {item.descricaoSigtap}</p>
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Judicial</h3>
              <div className="space-y-2">
                {judicialHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum caso judicial cadastrado.</p>
                ) : (
                  judicialHistory.map((item) => (
                    <Link key={item.id} href={`/judicial/${item.id}`} className="block rounded-xl border border-border p-3 hover:bg-muted/50">
                      <p className="font-medium">{item.originProtocol}</p>
                      <p className="text-sm text-muted-foreground">{item.processNumber} • {item.municipalityName}</p>
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Pré Judicial</h3>
              <div className="space-y-2">
                {preHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum caso pré judicial cadastrado.</p>
                ) : (
                  preHistory.map((item) => (
                    <Link key={item.id} href={`/pre-judicial/${item.id}`} className="block rounded-xl border border-border p-3 hover:bg-muted/50">
                      <p className="font-medium">{item.protocolNumber}</p>
                      <p className="text-sm text-muted-foreground">Prazo final {new Date(item.deadlineAt).toLocaleDateString("pt-BR")}</p>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
