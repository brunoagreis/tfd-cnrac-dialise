"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Search,
  UserRound,
} from "lucide-react"

import { useStore } from "@/lib/store-context"
import { useJudicial } from "@/lib/judicial-context"
import { usePreJudicial } from "@/lib/pre-judicial-context"
import { ModuleChooser, type DemandModuleChoice } from "@/components/paciente/module-chooser"
import { StandardDemandForm } from "@/components/paciente/standard-demand-form"
import { JudicialDemandForm } from "@/components/paciente/judicial-demand-form"
import { PreJudicialDemandForm } from "@/components/paciente/pre-judicial-demand-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { Paciente, Module } from "@/lib/types"

type PatientHistoryItem = {
  id: string
  label: string
  href: string
  moduleLabel: string
  createdAt?: string
  status?: string
}

type NewPatientFormState = {
  cpf: string
  cns: string
  nome: string
  dataNascimento: string
  telefone: string
  email: string
  endereco: string
  numero: string
  complemento: string
  cep: string
  bairro: string
  cidade: string
}

const PAGE_SIZE = 8

function moduleLabel(value: string) {
  switch (value) {
    case "tfd":
      return "TFD"
    case "cnrac":
      return "CNRAC"
    case "hemodialise":
      return "Hemodiálise"
    case "judicial":
      return "Judicial"
    case "pre_judicial":
      return "Pré Judicial"
    default:
      return value
  }
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2")
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.replace(/^(\d{5})(\d)/, "$1-$2")
}

function looksLikeCpfSearch(value: string) {
  const digits = onlyDigits(value)
  return digits.length > 0 && digits.length <= 11 && !/[a-zA-Z]/.test(value)
}

function normalizeSearchInput(value: string) {
  if (looksLikeCpfSearch(value)) return formatCpf(value)
  return value
}

function buildEnderecoCompleto(form: NewPatientFormState) {
  const parts = [
    form.endereco?.trim(),
    form.numero?.trim() ? `Nº ${form.numero.trim()}` : "",
    form.complemento?.trim() ? `Compl. ${form.complemento.trim()}` : "",
    form.bairro?.trim() ? `Bairro ${form.bairro.trim()}` : "",
    form.cidade?.trim(),
    form.cep?.trim() ? `CEP ${form.cep.trim()}` : "",
  ].filter(Boolean)

  return parts.join(", ")
}

function initialNewPatientForm(prefill = ""): NewPatientFormState {
  const cpfPrefill = looksLikeCpfSearch(prefill) ? formatCpf(prefill) : ""

  return {
    cpf: cpfPrefill,
    cns: "",
    nome: "",
    dataNascimento: "",
    telefone: "",
    email: "",
    endereco: "",
    numero: "",
    complemento: "",
    cep: "",
    bairro: "",
    cidade: "",
  }
}

export default function PacientesPage() {
  const store = useStore() as any
  const judicial = useJudicial() as any
  const preJudicial = usePreJudicial() as any

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const [historyPatient, setHistoryPatient] = useState<Paciente | null>(null)
  const [demandPatient, setDemandPatient] = useState<Paciente | null>(null)
  const [selectedModule, setSelectedModule] = useState<DemandModuleChoice | null>(null)

  const [createPatientOpen, setCreatePatientOpen] = useState(false)
  const [createPatientForm, setCreatePatientForm] = useState<NewPatientFormState>(initialNewPatientForm())
  const [savingPatient, setSavingPatient] = useState(false)

  const pacientes = useMemo(() => {
    return Array.isArray(store?.pacientes) ? (store.pacientes as Paciente[]) : []
  }, [store])

  const demandas = useMemo(() => {
    return Array.isArray(store?.demandas) ? store.demandas : []
  }, [store])

  const judicialCases = useMemo(() => {
    return Array.isArray(judicial?.cases) ? judicial.cases : []
  }, [judicial])

  const preJudicialCases = useMemo(() => {
    return Array.isArray(preJudicial?.cases) ? preJudicial.cases : []
  }, [preJudicial])

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pacientes

    return pacientes.filter((patient) => {
      const name = String((patient as any).nome ?? "").toLowerCase()
      const cpf = String((patient as any).cpf ?? "").toLowerCase()
      const cns = String((patient as any).cns ?? (patient as any).cartaoSus ?? "").toLowerCase()
      const city = String((patient as any).municipio ?? "").toLowerCase()
      return `${name} ${cpf} ${cns} ${city}`.includes(q)
    })
  }, [pacientes, search])

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE))

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedPatients = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredPatients.slice(start, start + PAGE_SIZE)
  }, [filteredPatients, page])

  const historyItems = useMemo(() => {
    if (!historyPatient) return [] as PatientHistoryItem[]

    const patientId = (historyPatient as any).id

    const standard: PatientHistoryItem[] = demandas
      .filter((d: any) => d.pacienteId === patientId)
      .map((d: any) => ({
        id: `std-${d.id}`,
        label: d.protocolo,
        href: `/protocolo/${d.protocolo}`,
        moduleLabel: moduleLabel(d.modulo),
        createdAt: d.criadoEm,
        status: d.status,
      }))

    const judicialItems: PatientHistoryItem[] = judicialCases
      .filter((item: any) => item.patientId === patientId)
      .map((item: any) => ({
        id: `jud-${item.id}`,
        label: item.registration?.pgeNetNumber || item.processNumber || item.originProtocol || item.id,
        href: `/judicial/${item.id}`,
        moduleLabel: "Judicial",
        createdAt: item.createdAt,
        status: item.status,
      }))

    const preItems: PatientHistoryItem[] = preJudicialCases
      .filter((item: any) => item.patientId === patientId)
      .map((item: any) => ({
        id: `pre-${item.id}`,
        label: item.protocolNumber || item.originProtocol || item.id,
        href: `/pre-judicial/${item.id}`,
        moduleLabel: "Pré Judicial",
        createdAt: item.createdAt,
        status: item.status,
      }))

    return [...standard, ...judicialItems, ...preItems].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return db - da
    })
  }, [historyPatient, demandas, judicialCases, preJudicialCases])

  function patientDemandCount(patientId: string) {
    const countStandard = demandas.filter((d: any) => d.pacienteId === patientId).length
    const countJudicial = judicialCases.filter((item: any) => item.patientId === patientId).length
    const countPre = preJudicialCases.filter((item: any) => item.patientId === patientId).length
    return countStandard + countJudicial + countPre
  }

  function openDemand(patient: Paciente) {
    setDemandPatient(patient)
    setSelectedModule(null)
  }

  function closeDemandDialog() {
    setDemandPatient(null)
    setSelectedModule(null)
  }

  function openCreatePatientDialog() {
    setCreatePatientForm(initialNewPatientForm(search))
    setCreatePatientOpen(true)
  }

  function updateCreatePatientField<K extends keyof NewPatientFormState>(
    field: K,
    value: NewPatientFormState[K],
  ) {
    setCreatePatientForm((prev) => ({ ...prev, [field]: value }))
  }

  function validateNewPatientForm() {
    const cpfDigits = onlyDigits(createPatientForm.cpf)
    const phoneDigits = onlyDigits(createPatientForm.telefone)
    const cepDigits = onlyDigits(createPatientForm.cep)

    if (cpfDigits.length !== 11) {
      window.alert("Informe um CPF válido.")
      return false
    }

    if (!createPatientForm.nome.trim()) {
      window.alert("Informe o nome do paciente.")
      return false
    }

    if (!createPatientForm.dataNascimento) {
      window.alert("Informe a data de nascimento.")
      return false
    }

    if (phoneDigits.length < 10) {
      window.alert("Informe um telefone válido.")
      return false
    }

    if (!createPatientForm.endereco.trim()) {
      window.alert("Informe o endereço.")
      return false
    }

    if (!createPatientForm.numero.trim()) {
      window.alert("Informe o número.")
      return false
    }

    if (!createPatientForm.bairro.trim()) {
      window.alert("Informe o bairro.")
      return false
    }

    if (!createPatientForm.cidade.trim()) {
      window.alert("Informe a cidade.")
      return false
    }

    if (createPatientForm.cep && cepDigits.length !== 8) {
      window.alert("Informe um CEP válido.")
      return false
    }

    return true
  }

  function handleSaveNewPatient() {
    if (savingPatient) return
    if (!validateNewPatientForm()) return

    const existingByCpf = pacientes.find(
      (p) => onlyDigits((p as any).cpf ?? "") === onlyDigits(createPatientForm.cpf),
    )

    if (existingByCpf) {
      window.alert("Já existe um paciente cadastrado com este CPF.")
      return
    }

    if (typeof store?.addPaciente !== "function") {
      window.alert("A função de salvar paciente não está disponível no store.")
      return
    }

    try {
      setSavingPatient(true)

      const savedPatient = store.addPaciente({
        cpf: formatCpf(createPatientForm.cpf),
        cartaoSus: onlyDigits(createPatientForm.cns || "").slice(0, 15).padEnd(15, "0"),
        nome: createPatientForm.nome.trim(),
        dataNascimento: createPatientForm.dataNascimento,
        telefones: [formatPhone(createPatientForm.telefone)],
        email: createPatientForm.email.trim(),
        municipio: createPatientForm.cidade.trim(),
        endereco: buildEnderecoCompleto(createPatientForm),
      }) as Paciente

      setCreatePatientOpen(false)
      setCreatePatientForm(initialNewPatientForm())
      setSearch(savedPatient?.nome ?? "")
      setDemandPatient(savedPatient)
      setSelectedModule(null)

      window.alert("Paciente salvo com sucesso.")
    } catch (error) {
      console.error("Erro ao salvar paciente:", error)
      window.alert("Ocorreu um erro ao salvar o paciente.")
    } finally {
      setSavingPatient(false)
    }
  }

  function renderDemandForm() {
    if (!demandPatient || !selectedModule) return null

    if (selectedModule === "judicial") {
      return (
        <JudicialDemandForm
          patient={demandPatient}
          onBack={() => setSelectedModule(null)}
          onSaved={closeDemandDialog}
        />
      )
    }

    if (selectedModule === "pre_judicial") {
      return (
        <PreJudicialDemandForm
          patient={demandPatient}
          onBack={() => setSelectedModule(null)}
          onSaved={closeDemandDialog}
        />
      )
    }

    return (
      <StandardDemandForm
        modulo={selectedModule as Module}
        patient={demandPatient}
        onBack={() => setSelectedModule(null)}
        onSaved={closeDemandDialog}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Pacientes</h1>
        <p className="text-sm text-muted-foreground">
          Busque um paciente pelo CPF, CNS ou nome. Visualize o histórico e abra novas demandas por módulo.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Buscar paciente</CardTitle>
          <CardDescription>
            Digite nome, CPF, CNS ou município para localizar rapidamente o paciente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(normalizeSearchInput(e.target.value))}
              className="pl-9"
              placeholder="CPF (000.000.000-00) ou CNS (15 dígitos) ou nome do paciente"
            />
          </div>

          {search.trim() && filteredPatients.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground">
                Nenhum paciente localizado para a busca informada.
              </p>
              <div className="mt-3">
                <Button type="button" onClick={openCreatePatientDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar novo paciente
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lista de pacientes</CardTitle>
          <CardDescription>
            {filteredPatients.length} paciente(s) encontrado(s). Página {page} de {totalPages}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {paginatedPatients.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhum paciente localizado com os filtros atuais.
            </div>
          ) : (
            paginatedPatients.map((patient) => {
              const count = patientDemandCount((patient as any).id)
              const cns = (patient as any).cns ?? (patient as any).cartaoSus ?? "Não informado"
              const city = (patient as any).municipio ?? "Não informado"

              return (
                <div
                  key={(patient as any).id}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <p className="truncate text-lg font-semibold text-card-foreground">
                        {(patient as any).nome}
                      </p>
                      <Badge variant="outline">{count} demanda(s)</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      CPF: {(patient as any).cpf ?? "Não informado"} | CNS: {cns}
                    </p>
                    <p className="text-sm text-muted-foreground">{city}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-transparent"
                      onClick={() => setHistoryPatient(patient)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver histórico
                    </Button>

                    <Button type="button" onClick={() => openDemand(patient)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Demanda
                    </Button>
                  </div>
                </div>
              )
            })
          )}

          <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Exibindo {paginatedPatients.length} de {filteredPatients.length} paciente(s).
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Anterior
              </Button>
              <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                {page} / {totalPages}
              </div>
              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Próxima
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!historyPatient} onOpenChange={(open) => !open && setHistoryPatient(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Histórico de {(historyPatient as any)?.nome}</DialogTitle>
            <DialogDescription>
              CPF: {(historyPatient as any)?.cpf ?? "Não informado"} | CNS: {(historyPatient as any)?.cns ?? (historyPatient as any)?.cartaoSus ?? "Não informado"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {historyItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum protocolo encontrado para este paciente.
              </div>
            ) : (
              historyItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block rounded-xl border border-border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-card-foreground">{item.label}</span>
                    <Badge variant="outline">{item.moduleLabel}</Badge>
                    {item.status ? <Badge variant="secondary">{item.status}</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString("pt-BR")
                      : "Data não informada"}
                  </p>
                </Link>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!demandPatient} onOpenChange={(open) => !open && closeDemandDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Nova Demanda para {(demandPatient as any)?.nome}</DialogTitle>
            <DialogDescription>
              CPF: {(demandPatient as any)?.cpf ?? "Não informado"} | CNS: {(demandPatient as any)?.cns ?? (demandPatient as any)?.cartaoSus ?? "Não informado"}
            </DialogDescription>
          </DialogHeader>

          {!selectedModule ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escolha primeiro o módulo para abrir o formulário correto da demanda.
              </p>
              <ModuleChooser onChoose={setSelectedModule} />
            </div>
          ) : (
            renderDemandForm()
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createPatientOpen} onOpenChange={(open) => !open && setCreatePatientOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cadastrar novo paciente</DialogTitle>
            <DialogDescription>
              Preencha os dados mínimos para cadastrar o paciente e já abrir a nova demanda.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">CPF</Label>
                <Input
                  value={createPatientForm.cpf}
                  onChange={(e) => updateCreatePatientField("cpf", formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <Label className="mb-1 block text-xs">CNS</Label>
                <Input
                  value={createPatientForm.cns}
                  onChange={(e) => updateCreatePatientField("cns", onlyDigits(e.target.value).slice(0, 15))}
                  placeholder="000000000000000"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Nome do paciente</Label>
              <Input
                value={createPatientForm.nome}
                onChange={(e) => updateCreatePatientField("nome", e.target.value)}
                placeholder="Nome completo"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">Data de nascimento</Label>
                <Input
                  type="date"
                  value={createPatientForm.dataNascimento}
                  onChange={(e) => updateCreatePatientField("dataNascimento", e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-1 block text-xs">Telefone</Label>
                <Input
                  value={createPatientForm.telefone}
                  onChange={(e) => updateCreatePatientField("telefone", formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">E-mail</Label>
                <Input
                  value={createPatientForm.email}
                  onChange={(e) => updateCreatePatientField("email", e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <Label className="mb-1 block text-xs">CEP</Label>
                <Input
                  value={createPatientForm.cep}
                  onChange={(e) => updateCreatePatientField("cep", formatCep(e.target.value))}
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">Endereço</Label>
                <Input
                  value={createPatientForm.endereco}
                  onChange={(e) => updateCreatePatientField("endereco", e.target.value)}
                  placeholder="Rua / Avenida / Travessa"
                />
              </div>

              <div>
                <Label className="mb-1 block text-xs">Número</Label>
                <Input
                  value={createPatientForm.numero}
                  onChange={(e) => updateCreatePatientField("numero", e.target.value)}
                  placeholder="Número"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">Complemento</Label>
                <Input
                  value={createPatientForm.complemento}
                  onChange={(e) => updateCreatePatientField("complemento", e.target.value)}
                  placeholder="Apto, bloco, referência..."
                />
              </div>

              <div>
                <Label className="mb-1 block text-xs">Bairro</Label>
                <Input
                  value={createPatientForm.bairro}
                  onChange={(e) => updateCreatePatientField("bairro", e.target.value)}
                  placeholder="Bairro"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Cidade</Label>
              <Input
                value={createPatientForm.cidade}
                onChange={(e) => updateCreatePatientField("cidade", e.target.value)}
                placeholder="Cidade"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" onClick={handleSaveNewPatient} disabled={savingPatient}>
                {savingPatient ? "Salvando..." : "Salvar paciente"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                onClick={() => setCreatePatientOpen(false)}
                disabled={savingPatient}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}