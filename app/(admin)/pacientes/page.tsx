"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Search,
  UserRound,
} from "lucide-react"

import { ModuleChooser, type DemandModuleChoice } from "@/components/paciente/module-chooser"
import { StandardDemandForm } from "@/components/paciente/standard-demand-form"
import { JudicialDemandForm } from "@/components/paciente/judicial-demand-form"
import { PreJudicialDemandForm } from "@/components/paciente/pre-judicial-demand-form"
import { MunicipalitySelectField } from "@/components/paciente/municipality-select-field"
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

type ApiPatientItem = Paciente & {
  totalDemandas?: number
  telefone?: string
  cep?: string
  bairro?: string
  cidade?: string
}

const PAGE_SIZE = 8

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

function patientToForm(patient: ApiPatientItem | Paciente): NewPatientFormState {
  const rawTelefone = String(
    (patient as any).telefone ??
      (Array.isArray((patient as any).telefones) ? (patient as any).telefones[0] : "") ??
      "",
  )

  return {
    cpf: formatCpf(String((patient as any).cpf ?? "")),
    cns: onlyDigits(String((patient as any).cns ?? (patient as any).cartaoSus ?? "")).slice(0, 15),
    nome: String((patient as any).nome ?? ""),
    dataNascimento: String((patient as any).dataNascimento ?? "").slice(0, 10),
    telefone: rawTelefone ? formatPhone(rawTelefone) : "",
    email: String((patient as any).email ?? ""),
    endereco: String((patient as any).endereco ?? ""),
    numero: "",
    complemento: "",
    cep: formatCep(String((patient as any).cep ?? "")),
    bairro: String((patient as any).bairro ?? ""),
    cidade: String((patient as any).cidade ?? (patient as any).municipio ?? ""),
  }
}

function normalizeApiPatient(item: any): ApiPatientItem {
  return {
    id: String(item?.id ?? ""),
    cpf: String(item?.cpf ?? ""),
    cartaoSus: String(item?.cartaoSus ?? item?.cns ?? ""),
    nome: String(item?.nome ?? ""),
    dataNascimento: String(item?.dataNascimento ?? ""),
    telefones: Array.isArray(item?.telefones)
      ? item.telefones.map((value: unknown) => String(value ?? "")).filter(Boolean)
      : item?.telefone
        ? [String(item.telefone)]
        : [],
    telefone: String(item?.telefone ?? ""),
    email: String(item?.email ?? ""),
    municipio: String(item?.municipio ?? ""),
    endereco: String(item?.endereco ?? ""),
    cep: String(item?.cep ?? ""),
    bairro: String(item?.bairro ?? ""),
    cidade: String(item?.cidade ?? item?.municipio ?? ""),
    criadoEm: String(item?.criadoEm ?? ""),
    atualizadoEm: String(item?.atualizadoEm ?? ""),
    totalDemandas: Number(item?.totalDemandas ?? 0),
  }
}

export default function PacientesPage() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const [historyPatient, setHistoryPatient] = useState<Paciente | null>(null)
  const [historyItems, setHistoryItems] = useState<PatientHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [demandPatient, setDemandPatient] = useState<Paciente | null>(null)
  const [selectedModule, setSelectedModule] = useState<DemandModuleChoice | null>(null)

  const [createPatientOpen, setCreatePatientOpen] = useState(false)
  const [createPatientForm, setCreatePatientForm] = useState<NewPatientFormState>(initialNewPatientForm())
  const [savingPatient, setSavingPatient] = useState(false)

  const [editPatientOpen, setEditPatientOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<ApiPatientItem | null>(null)
  const [editPatientForm, setEditPatientForm] = useState<NewPatientFormState>(initialNewPatientForm())
  const [savingEditPatient, setSavingEditPatient] = useState(false)

  const [apiPatients, setApiPatients] = useState<ApiPatientItem[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPatients(search)
    }, 250)

    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!historyPatient?.id) {
      setHistoryItems([])
      return
    }

    void fetchHistory(historyPatient.id)
  }, [historyPatient?.id])

  async function fetchPatients(query: string) {
    try {
      setLoadingPatients(true)

      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())

      const response = await fetch(
        `/api/pacientes${params.toString() ? `?${params.toString()}` : ""}`,
        { method: "GET", cache: "no-store" },
      )
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar pacientes.")
        return
      }

      const items = Array.isArray(json?.items) ? json.items : []
      setApiPatients(items.map(normalizeApiPatient))
    } catch (error) {
      console.error("LOAD_PACIENTES_DB_ERROR", error)
      toast.error("Erro ao carregar pacientes.")
    } finally {
      setLoadingPatients(false)
    }
  }

  async function fetchHistory(patientId: string) {
    try {
      setLoadingHistory(true)

      const response = await fetch(`/api/pacientes/${encodeURIComponent(patientId)}/historico`, {
        method: "GET",
        cache: "no-store",
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar histórico do paciente.")
        setHistoryItems([])
        return
      }

      setHistoryItems(Array.isArray(json?.items) ? json.items : [])
    } catch (error) {
      console.error("LOAD_PATIENT_HISTORY_ERROR", error)
      toast.error("Erro ao carregar histórico do paciente.")
      setHistoryItems([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const pacientes = useMemo(() => apiPatients, [apiPatients])

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

  function patientDemandCount(patient: ApiPatientItem) {
    return typeof patient.totalDemandas === "number" ? patient.totalDemandas : 0
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

  function openEditPatientDialog(patient: ApiPatientItem) {
    setEditingPatient(patient)
    setEditPatientForm(patientToForm(patient))
    setEditPatientOpen(true)
  }

  function closeEditPatientDialog() {
    if (savingEditPatient) return
    setEditPatientOpen(false)
    setEditingPatient(null)
    setEditPatientForm(initialNewPatientForm())
  }

  function updateCreatePatientField<K extends keyof NewPatientFormState>(
    field: K,
    value: NewPatientFormState[K],
  ) {
    setCreatePatientForm((prev) => ({ ...prev, [field]: value }))
  }

  function updateEditPatientField<K extends keyof NewPatientFormState>(
    field: K,
    value: NewPatientFormState[K],
  ) {
    setEditPatientForm((prev) => ({ ...prev, [field]: value }))
  }

  function validateEditPatientForm() {
    const cpfDigits = onlyDigits(editPatientForm.cpf)
    const phoneDigits = onlyDigits(editPatientForm.telefone)
    const cepDigits = onlyDigits(editPatientForm.cep)

    if (cpfDigits.length !== 11) {
      window.alert("Informe um CPF valido.")
      return false
    }

    if (!editPatientForm.nome.trim()) {
      window.alert("Informe o nome do paciente.")
      return false
    }

    if (!editPatientForm.dataNascimento) {
      window.alert("Informe a data de nascimento.")
      return false
    }

    if (editPatientForm.telefone && phoneDigits.length < 10) {
      window.alert("Informe um telefone valido.")
      return false
    }

    if (!editPatientForm.endereco.trim()) {
      window.alert("Informe o endereco.")
      return false
    }

    if (!editPatientForm.bairro.trim()) {
      window.alert("Informe o bairro.")
      return false
    }

    if (!editPatientForm.cidade.trim()) {
      window.alert("Selecione a cidade cadastrada em Admin Judicial > Municipios.")
      return false
    }

    if (editPatientForm.cep && cepDigits.length !== 8) {
      window.alert("Informe um CEP valido.")
      return false
    }

    return true
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
      window.alert("Selecione a cidade cadastrada em Admin Judicial > Municípios.")
      return false
    }

    if (createPatientForm.cep && cepDigits.length !== 8) {
      window.alert("Informe um CEP válido.")
      return false
    }

    return true
  }

  async function handleSaveNewPatient() {
    if (savingPatient) return
    if (!validateNewPatientForm()) return

    try {
      setSavingPatient(true)

      const response = await fetch("/api/pacientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPatientForm),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao salvar paciente.")
        return
      }

      const patient = normalizeApiPatient(json.item)
      setApiPatients((current) => {
        const exists = current.some((item) => item.id === patient.id)
        if (exists) return current.map((item) => (item.id === patient.id ? patient : item))
        return [patient, ...current]
      })
      setCreatePatientOpen(false)
      setCreatePatientForm(initialNewPatientForm())
      toast.success("Paciente salvo com município padronizado.")
      openDemand(patient)
    } catch (error) {
      console.error("SAVE_PATIENT_ERROR", error)
      toast.error("Erro ao salvar paciente.")
    } finally {
      setSavingPatient(false)
    }
  }

  async function handleSaveEditPatient() {
    if (savingEditPatient || !editingPatient) return
    if (!validateEditPatientForm()) return

    try {
      setSavingEditPatient(true)

      const response = await fetch("/api/pacientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editPatientForm,
          id: (editingPatient as any).id,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao atualizar paciente.")
        return
      }

      const patient = normalizeApiPatient(json.item)

      setApiPatients((current) =>
        current.map((item) => ((item as any).id === (patient as any).id ? patient : item)),
      )

      setHistoryPatient((current) =>
        current && (current as any).id === (patient as any).id ? patient : current,
      )

      setDemandPatient((current) =>
        current && (current as any).id === (patient as any).id ? patient : current,
      )

      setEditPatientOpen(false)
      setEditingPatient(null)
      setEditPatientForm(initialNewPatientForm())
      toast.success("Paciente atualizado.")
    } catch (error) {
      console.error("UPDATE_PATIENT_ERROR", error)
      toast.error("Erro ao atualizar paciente.")
    } finally {
      setSavingEditPatient(false)
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

          {search.trim() && !loadingPatients && filteredPatients.length === 0 ? (
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
          {loadingPatients ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Carregando pacientes do banco...
            </div>
          ) : paginatedPatients.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhum paciente localizado com os filtros atuais.
            </div>
          ) : (
            paginatedPatients.map((patient) => {
              const count = patientDemandCount(patient)
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
                      onClick={() => openEditPatientDialog(patient)}
                    >
                      Ver/Editar dados
                    </Button>

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
            {loadingHistory ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Carregando histórico...
              </div>
            ) : historyItems.length === 0 ? (
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

      <Dialog open={editPatientOpen} onOpenChange={(open) => !open && closeEditPatientDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Ver/Editar paciente</DialogTitle>
            <DialogDescription>
              Consulte e corrija os dados cadastrais do paciente. O municipio deve estar cadastrado em Admin Judicial &gt; Municipios.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">CPF</Label>
                <Input value={editPatientForm.cpf} onChange={(e) => updateEditPatientField("cpf", formatCpf(e.target.value))} placeholder="000.000.000-00" />
              </div>

              <div>
                <Label className="mb-1 block text-xs">CNS</Label>
                <Input value={editPatientForm.cns} onChange={(e) => updateEditPatientField("cns", onlyDigits(e.target.value).slice(0, 15))} placeholder="000000000000000" />
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Nome do paciente</Label>
              <Input value={editPatientForm.nome} onChange={(e) => updateEditPatientField("nome", e.target.value)} placeholder="Nome completo" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="mb-1 block text-xs">Data de nascimento</Label>
                <Input type="date" value={editPatientForm.dataNascimento} onChange={(e) => updateEditPatientField("dataNascimento", e.target.value)} />
              </div>

              <div>
                <Label className="mb-1 block text-xs">Telefone</Label>
                <Input value={editPatientForm.telefone} onChange={(e) => updateEditPatientField("telefone", formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
              </div>

              <div>
                <Label className="mb-1 block text-xs">E-mail</Label>
                <Input value={editPatientForm.email} onChange={(e) => updateEditPatientField("email", e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">CEP</Label>
                <Input value={editPatientForm.cep} onChange={(e) => updateEditPatientField("cep", formatCep(e.target.value))} placeholder="00000-000" />
              </div>

              <div>
                <Label className="mb-1 block text-xs">Bairro</Label>
                <Input value={editPatientForm.bairro} onChange={(e) => updateEditPatientField("bairro", e.target.value)} placeholder="Bairro" />
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Endereco</Label>
              <Input value={editPatientForm.endereco} onChange={(e) => updateEditPatientField("endereco", e.target.value)} placeholder="Rua / Avenida / Travessa" />
            </div>

            <MunicipalitySelectField value={editPatientForm.cidade} onChange={(value) => updateEditPatientField("cidade", value)} label="Cidade" />

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" onClick={handleSaveEditPatient} disabled={savingEditPatient}>
                {savingEditPatient ? "Salvando..." : "Salvar alteracoes"}
              </Button>

              <Button type="button" variant="outline" className="bg-transparent" onClick={closeEditPatientDialog} disabled={savingEditPatient}>
                Fechar
              </Button>
            </div>
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

            <MunicipalitySelectField
              value={createPatientForm.cidade}
              onChange={(value) => updateCreatePatientField("cidade", value)}
              label="Cidade"
            />

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
