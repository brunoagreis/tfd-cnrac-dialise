"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowRightLeft, FileText, RefreshCcw, X } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MunicipalitySelectField } from "@/components/paciente/municipality-select-field"
type OsItem = { id: string; protocolo: string; assunto: string; remetente: string; recebidoEm: string; pgeNet: string; processo: string; status: string; moduloDestino: string; responsavelId?: string; responsavelNome: string; responsavelEmail: string; corpoResumo?: string; anexos: Array<{ name: string; url: string; mimeType: string; size: number }> }

type EmailOsLinkResult = {
  id: string
  protocolo: string
  modulo: string
  pacienteNome: string
  pacienteCpf: string
  pacienteCns: string
  processo: string
  pgeNet: string
  cid: string
  codigoSigtap: string
  descricaoSigtap: string
  especialidade: string
  subespecialidade: string
  status: string
}
type UserItem = { id: string; nome: string; email: string }
const MODULES = [{ value: "judicial", label: "Judicial" }, { value: "tfd", label: "TFD" }, { value: "cnrac", label: "CNRAC" }, { value: "hemodialise", label: "Hemodiálise" }]
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR") }
function isAdmin(user: any) {
  const role = String(user?.role || user?.perfil || user?.tipo || user?.nivel || "").toUpperCase()
  return role.includes("ADMIN") || role.includes("ADMINISTRADOR") || user?.isAdmin === true
}


function normalizeEmailOsPanelValue(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function canUserSeeEmailOsItem(item: OsItem, user: any) {
  if (isAdmin(user)) return true

  const userId = normalizeEmailOsPanelValue(user?.id)
  const userEmail = normalizeEmailOsPanelValue(user?.email)
  const userName = normalizeEmailOsPanelValue(user?.nome ?? user?.name)

  const responsibleId = normalizeEmailOsPanelValue(item?.responsavelId)
  const responsibleEmail = normalizeEmailOsPanelValue(item?.responsavelEmail)
  const responsibleName = normalizeEmailOsPanelValue(item?.responsavelNome)

  const matchesId = Boolean(responsibleId && responsibleId === userId)
  const matchesEmail = Boolean(responsibleEmail && responsibleEmail === userEmail)
  const matchesName = Boolean(responsibleName && responsibleName === userName)

  return matchesId || matchesEmail || matchesName
}

function resolveEmailOsBodyText(item: any) {
  return String(
    item?.corpoResumo ??
    item?.corpoEmail ??
    item?.corpo_email ??
    item?.emailBody ??
    item?.email_body ??
    item?.body ??
    item?.corpo ??
    "",
  ).trim()
}

export function EmailOsPanel({ modulo }: { modulo: string }) {
  const { user } = useAuth()
  const canManageEmailOs = isAdmin(user)
  const [items, setItems] = useState<OsItem[]>([])
  // EMAIL_OS_ESTADOS_VINCULO_MANUAL
  const [linkingOs, setLinkingOs] = useState<OsItem | null>(null)
  const [linkSearch, setLinkSearch] = useState("")
  const [linkResults, setLinkResults] = useState<EmailOsLinkResult[]>([])
  const [selectedLink, setSelectedLink] = useState<EmailOsLinkResult | null>(null)
  const [linkSearching, setLinkSearching] = useState(false)
  const [linkSaving, setLinkSaving] = useState(false)
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  // EMAIL_OS_BADGE_TOTAL_ATIVAS_CADASTRO
  const [totalAssignedActive, setTotalAssignedActive] = useState(0)
  const [selectedModule, setSelectedModule] = useState<Record<string, string>>({})
  const [selectedUser, setSelectedUser] = useState<Record<string, string>>({})
  const [registeringOs, setRegisteringOs] = useState<OsItem | null>(null)

  // EMAIL_OS_DIALOG_TOP_LAYER
  const linkDialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = linkDialogRef.current

    if (!dialog || !linkingOs) return

    if (!dialog.open) {
      dialog.showModal()
    }
  }, [linkingOs])


  function itemHasResponsible(item: OsItem) {
    const responsibleId = normalizeEmailOsPanelValue(item?.responsavelId)
    const responsibleEmail = normalizeEmailOsPanelValue(item?.responsavelEmail)
    const responsibleName = normalizeEmailOsPanelValue(item?.responsavelNome)

    if (responsibleId) return true
    if (responsibleEmail) return true

    return Boolean(
      responsibleName &&
      !["nao definido", "sem responsavel", "sem responsável", "-"].includes(responsibleName),
    )
  }

  const visibleItems = useMemo(() => {
    if (canManageEmailOs) return items
    return items.filter((item) => canUserSeeEmailOsItem(item, user))
  }, [items, user, canManageEmailOs])

  const pendingEmailOsItems = useMemo(() => {
    return visibleItems.filter((item) => !itemHasResponsible(item))
  }, [visibleItems])

  const assignedEmailOsItems = useMemo(() => {
    return visibleItems.filter((item) => itemHasResponsible(item))
  }, [visibleItems])

  const primaryEmailOsItems = canManageEmailOs ? pendingEmailOsItems : assignedEmailOsItems

  async function load() {
    try {
      setLoading(true)

      const osRes = await fetch(`/api/email-os?modulo=${encodeURIComponent(modulo)}`, { cache: "no-store" })
      const osJson = await osRes.json().catch(() => ({}))

      const loadedItems =
        osRes.ok &&
        osJson?.ok &&
        Array.isArray(osJson.items)
          ? osJson.items
          : []

      setItems(loadedItems)

      const rawAssignedActive =
        osJson?.totals?.assignedActive

      const parsedAssignedActive =
        Number(rawAssignedActive)

      setTotalAssignedActive(
        rawAssignedActive !== undefined &&
        rawAssignedActive !== null &&
        Number.isFinite(parsedAssignedActive)
          ? Math.max(
              0,
              Math.trunc(parsedAssignedActive),
            )
          : loadedItems.filter(itemHasResponsible).length,
      )

      if (canManageEmailOs) {
        const rulesRes = await fetch("/api/admin/judicial/email-integracao/regras", { cache: "no-store" })
        const rulesJson = await rulesRes.json().catch(() => ({}))
        setUsers(rulesRes.ok && rulesJson?.ok && Array.isArray(rulesJson.users) ? rulesJson.users : [])
      } else {
        setUsers([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [modulo, canManageEmailOs])

  function openOsInOfficialPatientFlow(os: OsItem) {
    const params = new URLSearchParams()

    params.set("origemOs", "1")
    params.set("abrirCadastroPaciente", "1")
    params.set("origem", "email-os")
    params.set("emailOsId", String(os.id))
    params.set("osId", String(os.id))

    const moduloDestino = String(canManageEmailOs ? (os.moduloDestino || modulo || "") : (modulo || os.moduloDestino || "")).trim()
    if (moduloDestino) {
      params.set("modulo", moduloDestino)
      params.set("moduloOrigemOs", moduloDestino)
    }

    if (os.protocolo) params.set("osProtocolo", String(os.protocolo))
    if (os.assunto) params.set("assuntoOs", String(os.assunto))
    if (os.remetente) params.set("remetenteOs", String(os.remetente))

    window.location.href = "/pacientes?" + params.toString()
  }



  async function inativarOs(os: OsItem) {
    if (!isAdmin(user)) return toast.error("Somente administrador pode inativar OS.")

    if (!confirm(`Inativar a OS ${os.protocolo || os.id}? Ela deixara de aparecer para todos.`)) return

    const response = await fetch("/api/email-os", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "inativar", id: os.id, osId: os.id, user }),
    })

    const json = await response.json().catch(() => ({}))

    if (!response.ok || !json?.ok) return toast.error(json?.error || "Erro ao inativar OS.")

    toast.success("OS inativada.")

    await load()
  }

  async function transfer(os: OsItem) {
    const newModule = selectedModule[os.id] || os.moduloDestino || modulo
    const responsavelId = selectedUser[os.id]

    if (!responsavelId) return toast.error("Selecione o responsável pela OS.")

    const response = await fetch("/api/email-os", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ osId: os.id, modulo: newModule, responsavelId }),
    })

    const json = await response.json().catch(() => ({}))

    if (!response.ok || !json?.ok) return toast.error(json?.error || "Erro ao transferir OS.")

    toast.success("OS transferida/direcionada.")

    await load()
  }

  // EMAIL_OS_FUNCOES_VINCULO_MANUAL
  function openLinkModal(os: OsItem) {
    setLinkingOs(os)
    setLinkSearch(os.processo || os.pgeNet || "")
    setLinkResults([])
    setSelectedLink(null)
  }

  function closeLinkModal() {
    if (linkSaving) return
    setLinkingOs(null)
    setLinkSearch("")
    setLinkResults([])
    setSelectedLink(null)
  }

  async function searchExistingDemand() {
    const termo = linkSearch.trim()

    if (termo.length < 3) {
      return toast.error("Informe ao menos 3 caracteres para pesquisar.")
    }

    setLinkSearching(true)
    setSelectedLink(null)

    try {
      const params = new URLSearchParams({
        action: "pesquisar_vinculo",
        termo,
      })

      const response = await fetch(`/api/email-os?${params.toString()}`, {
        cache: "no-store",
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        setLinkResults([])
        return toast.error(json?.error || "Erro ao pesquisar demandas.")
      }

      const results = Array.isArray(json?.items) ? json.items : []
      setLinkResults(results)

      if (results.length === 0) {
        toast.error("Nenhuma demanda foi encontrada.")
      }
    } finally {
      setLinkSearching(false)
    }
  }

  async function confirmExistingDemandLink() {
    if (!linkingOs || !selectedLink) {
      return toast.error("Selecione uma demanda para realizar o vínculo.")
    }

    setLinkSaving(true)

    try {
      const response = await fetch("/api/email-os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vincular_demanda_existente",
          osId: linkingOs.id,
          demandaId: selectedLink.id,
          user,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        return toast.error(json?.error || "Erro ao vincular a OS.")
      }

      toast.success(
        json?.movimentacaoCriada === false
          ? "A OS já estava vinculada a esta demanda."
          : "OS vinculada e movimentação criada com sucesso.",
      )

      setLinkingOs(null)
      setLinkSearch("")
      setLinkResults([])
      setSelectedLink(null)

      await load()
    } finally {
      setLinkSaving(false)
    }
  }
  function renderEmailOsItem(os: OsItem) {
    return (
      <div key={os.id} className="rounded-xl border border-border bg-background p-4 text-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{os.protocolo}</Badge>
            <Badge variant="outline">{os.status}</Badge>
          </div>

          <span className="text-xs text-muted-foreground">{formatDate(os.recebidoEm)}</span>
        </div>

        <p className="font-semibold">{os.assunto || "Sem assunto"}</p>
        <p className="text-muted-foreground">Remetente: {os.remetente || "-"}</p>

        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <div><strong>PGE.net:</strong> {os.pgeNet || "-"}</div>
          <div><strong>Processo:</strong> {os.processo || "-"}</div>
          <div><strong>Responsável:</strong> {os.responsavelNome || "Não definido"}</div>
        </div>

        {resolveEmailOsBodyText(os) ? (
          <details className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Visualizar corpo do e-mail</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{resolveEmailOsBodyText(os)}</pre>
          </details>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Corpo do e-mail não disponível para esta OS.</p>
        )}

        {os.anexos?.length ? (
          <div className="mt-3 rounded-lg bg-muted p-3">
            {os.anexos.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex flex-wrap items-center gap-2">
                <FileText className="h-3 w-3" />
                <span>{file.name}</span>

                {file.url ? (
                  <a className="text-primary underline" href={file.url} target="_blank" rel="noreferrer">
                    Visualizar
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canManageEmailOs ? (
            <div className="grid flex-1 gap-2 md:grid-cols-[180px_1fr_auto_auto] md:items-center">
              <Select
                value={selectedModule[os.id] || os.moduloDestino || modulo}
                onValueChange={(value) => setSelectedModule((prev) => ({ ...prev, [os.id]: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>

                <SelectContent>
                  {MODULES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedUser[os.id] || ""}
                onValueChange={(value) => setSelectedUser((prev) => ({ ...prev, [os.id]: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Responsável obrigatório" /></SelectTrigger>

                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.email ? `(${u.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="button" variant="outline" className="bg-transparent" onClick={() => transfer(os)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Transferir
              </Button>

              <Button type="button" variant="destructive" onClick={() => inativarOs(os)}>
                Inativar OS
              </Button>
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="bg-transparent"
            onClick={() => openLinkModal(os)}
          >
            Vincular a protocolo/processo
          </Button>
          <Button type="button" onClick={() => openOsInOfficialPatientFlow(os)}>
            Cadastrar no módulo
          </Button>
        </div>
      </div>
    )
  }

  const hasAnyVisibleEmailOs = primaryEmailOsItems.length > 0 || (canManageEmailOs && assignedEmailOsItems.length > 0)

  if (!hasAnyVisibleEmailOs && !loading) return null

  return (
    <>
      {/* EMAIL_OS_MODAL_VINCULO_MANUAL */}
      {linkingOs && typeof document !== "undefined" ? createPortal(
        <dialog
          ref={linkDialogRef}
          className="m-auto max-h-[92dvh] w-[calc(100vw-2rem)] max-w-3xl overflow-visible border-0 bg-transparent p-0 backdrop:bg-slate-950/60 backdrop:backdrop-blur-[2px]"
          aria-labelledby="email-os-link-modal-title"
          onCancel={(event) => {
            event.preventDefault()
            closeLinkModal()
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeLinkModal()
            }
          }}
        >
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
              <div className="min-w-0">
                <h2
                  id="email-os-link-modal-title"
                  className="text-xl font-semibold tracking-tight"
                >
                  Vincular OS a uma demanda
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Pesquise por protocolo, número do processo ou PGE.net.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full"
                onClick={closeLinkModal}
                disabled={linkSaving}
                aria-label="Fechar modal de vínculo"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ordem de Serviço selecionada
                </p>

                <div className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
                  <div>
                    <span className="font-medium">OS:</span>{" "}
                    {linkingOs.protocolo || linkingOs.id}
                  </div>

                  <div>
                    <span className="font-medium">PGE.net:</span>{" "}
                    {linkingOs.pgeNet || "-"}
                  </div>

                  <div className="md:col-span-2">
                    <span className="font-medium">Assunto:</span>{" "}
                    {linkingOs.assunto || "Sem assunto"}
                  </div>

                  <div className="md:col-span-2">
                    <span className="font-medium">Processo informado:</span>{" "}
                    {linkingOs.processo || "-"}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="email-os-link-search">
                  Localizar demanda existente
                </Label>

                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <Input
                    id="email-os-link-search"
                    value={linkSearch}
                    onChange={(event) => setLinkSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void searchExistingDemand()
                      }
                    }}
                    placeholder="Digite protocolo, processo ou PGE.net"
                    disabled={linkSearching || linkSaving}
                    className="h-11 flex-1"
                    autoFocus
                  />

                  <Button
                    type="button"
                    className="h-11 px-6"
                    onClick={() => void searchExistingDemand()}
                    disabled={linkSearching || linkSaving}
                  >
                    {linkSearching ? "Pesquisando..." : "Pesquisar"}
                  </Button>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  A pesquisa contempla demandas dos módulos Judicial e
                  Pré-Judicial.
                </p>
              </div>

              {linkResults.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      Demandas encontradas
                    </p>

                    <Badge variant="secondary">
                      {linkResults.length} resultado
                      {linkResults.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {linkResults.map((result) => {
                      const selected = selectedLink?.id === result.id

                      return (
                        <button
                          key={result.id}
                          type="button"
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "bg-background hover:border-primary/40 hover:bg-muted/30"
                          }`}
                          onClick={() => setSelectedLink(result)}
                          disabled={linkSaving}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {result.protocolo || result.id}
                            </Badge>

                            <Badge variant="outline">
                              {result.modulo === "pre_judicial"
                                ? "Pré-Judicial"
                                : "Judicial"}
                            </Badge>

                            {result.status ? (
                              <Badge variant="outline">
                                {result.status}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="mt-4 grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
                            <div className="md:col-span-2">
                              <span className="font-medium">Paciente:</span>{" "}
                              {result.pacienteNome || "-"}
                            </div>

                            <div>
                              <span className="font-medium">CPF:</span>{" "}
                              {result.pacienteCpf || "-"}
                            </div>

                            <div>
                              <span className="font-medium">CNS:</span>{" "}
                              {result.pacienteCns || "-"}
                            </div>

                            <div>
                              <span className="font-medium">Processo:</span>{" "}
                              {result.processo || "-"}
                            </div>

                            <div>
                              <span className="font-medium">PGE.net:</span>{" "}
                              {result.pgeNet || "-"}
                            </div>

                            <div>
                              <span className="font-medium">CID:</span>{" "}
                              {result.cid || "-"}
                            </div>

                            <div>
                              <span className="font-medium">SIGTAP:</span>{" "}
                              {[result.codigoSigtap, result.descricaoSigtap]
                                .filter(Boolean)
                                .join(" - ") || "-"}
                            </div>

                            <div className="md:col-span-2">
                              <span className="font-medium">
                                Especialidade:
                              </span>{" "}
                              {[result.especialidade, result.subespecialidade]
                                .filter(Boolean)
                                .join(" / ") || "-"}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {selectedLink ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="font-semibold">Confirmar vínculo</p>

                  <p className="mt-2 text-sm">
                    A OS{" "}
                    <strong>
                      {linkingOs.protocolo || linkingOs.id}
                    </strong>{" "}
                    será vinculada ao protocolo{" "}
                    <strong>{selectedLink.protocolo}</strong>, referente ao
                    paciente{" "}
                    <strong>{selectedLink.pacienteNome}</strong>.
                  </p>

                  <p className="mt-2 text-sm text-muted-foreground">
                    O assunto, o texto e os anexos da OS serão inseridos em uma
                    movimentação da demanda.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="bg-background"
                onClick={closeLinkModal}
                disabled={linkSaving}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() => void confirmExistingDemandLink()}
                disabled={!selectedLink || linkSaving}
              >
                {linkSaving
                  ? "Vinculando..."
                  : "Confirmar vínculo e criar movimentação"}
              </Button>
            </div>
          </div>
        </dialog>
      , document.body) : null}

      <details className="rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">{canManageEmailOs ? "OS não atribuídas" : "Minhas OS atribuídas"}</span>
              <Badge variant="outline">{primaryEmailOsItems.length}</Badge>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {canManageEmailOs
                ? "OS sem responsável definido. Clique para abrir, analisar e atribuir."
                : "OS atribuídas ao seu usuário. Clique para cadastrar e acompanhar."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-background"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void load()
              }}
              disabled={loading}
            >
              Atualizar
            </button>

            <span className="rounded-md border px-3 py-1 text-xs text-muted-foreground">
              Abrir / fechar
            </span>
          </div>
        </summary>

        <div className="max-h-[520px] space-y-3 overflow-auto border-t border-border p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando ordens de serviço...</p>
          ) : primaryEmailOsItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{canManageEmailOs ? "Nenhuma OS sem responsável definido." : "Nenhuma OS atribuída ao seu usuário."}</p>
          ) : (
            primaryEmailOsItems.map(renderEmailOsItem)
          )}
        </div>
      </details>

      {canManageEmailOs ? (
        <details className="rounded-xl border border-border bg-background shadow-sm">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">OS já atribuídas</span>
                <Badge variant="outline">{totalAssignedActive}</Badge>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Total de OS ativas, já atribuídas e que ainda aguardam cadastro. A lista exibe até 200 registros.
              </p>
            </div>

            <span className="rounded-md border px-3 py-1 text-xs text-muted-foreground">
              Abrir / fechar
            </span>
          </summary>

          <div className="max-h-[520px] space-y-3 overflow-auto border-t border-border p-4">
            {assignedEmailOsItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma OS já atribuída.</p>
            ) : (
              assignedEmailOsItems.map(renderEmailOsItem)
            )}
          </div>
        </details>
      ) : null}

      {registeringOs ? (
        <EmailOsRegisterModal
          os={registeringOs}
          initialModule={canManageEmailOs ? (registeringOs.moduloDestino || modulo) : modulo}
          onClose={() => setRegisteringOs(null)}
          onSaved={async () => {
            setRegisteringOs(null)
            await load()
          }}
        />
      ) : null}
    </>
  )
}
const MAX_EMAIL_OS_PATIENT_PHONES = 5
const MAX_EMAIL_OS_PATIENT_PHONE_LENGTH = 30

type EmailOsCreatedPatient = {
  id: string
  nome?: string
  cpf?: string
  cns?: string
  cartaoSus?: string
  dataNascimento?: string
  telefone?: string
  email?: string
  endereco?: string
  cep?: string
  bairro?: string
  cidade?: string
  municipio?: string
}

type EmailOsPatientFormState = {
  cpf: string
  cns: string
  nome: string
  dataNascimento: string
  telefone: string
  telefones: string[]
  email: string
  endereco: string
  numero: string
  complemento: string
  cep: string
  bairro: string
  cidade: string
}

function onlyEmailOsDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function cleanEmailOsPatientPhone(value: unknown) {
  return String(value ?? "")
    .replace(/[^0-9()+\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_EMAIL_OS_PATIENT_PHONE_LENGTH)
}

function normalizeEmailOsPatientPhones(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(/\s*(?:\||;|,|\n)\s*/)
        .filter(Boolean)

  const phones = source
    .map(cleanEmailOsPatientPhone)
    .filter(Boolean)
    .filter((phone, index, array) => array.indexOf(phone) === index)
    .slice(0, MAX_EMAIL_OS_PATIENT_PHONES)

  return phones.length ? phones : [""]
}

function getEmailOsPatientPhones(form: Pick<EmailOsPatientFormState, "telefone" | "telefones">) {
  return normalizeEmailOsPatientPhones(
    Array.isArray(form.telefones) && form.telefones.length ? form.telefones : form.telefone,
  )
}

function formatEmailOsCpf(value: string) {
  const digits = onlyEmailOsDigits(value).slice(0, 11)

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2")
}

function formatEmailOsCep(value: string) {
  const digits = onlyEmailOsDigits(value).slice(0, 8)
  return digits.replace(/^(\d{5})(\d)/, "$1-$2")
}

function formatEmailOsPhone(value: string) {
  const digits = onlyEmailOsDigits(value).slice(0, 11)

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
}

function initialEmailOsPatientForm(): EmailOsPatientFormState {
  return {
    cpf: "",
    cns: "",
    nome: "",
    dataNascimento: "",
    telefone: "",
    telefones: [""],
    email: "",
    endereco: "",
    numero: "",
    complemento: "",
    cep: "",
    bairro: "",
    cidade: "",
  }
}

function normalizeEmailOsDemandModule(value: unknown): DemandModuleChoice {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")

  if (normalized === "pre_judicial" || normalized === "prejudicial") return "pre_judicial"
  if (normalized === "tfd") return "tfd"
  if (normalized === "cnrac") return "cnrac"
  if (normalized === "hemodialise") return "hemodialise"
  return "judicial"
}

function demandModuleLabel(module: DemandModuleChoice) {
  if (module === "pre_judicial") return "Pré Judicial"
  if (module === "tfd") return "TFD"
  if (module === "cnrac") return "CNRAC"
  if (module === "hemodialise") return "Hemodiálise"
  return "Judicial"
}

function resolveEmailOsCreatedPatient(data: any, fallback: EmailOsPatientFormState): EmailOsCreatedPatient {
  const item = data?.item ?? data?.paciente ?? data?.patient ?? data

  return {
    id: String(item?.id ?? "").trim(),
    nome: String(item?.nome ?? fallback.nome ?? "").trim(),
    cpf: String(item?.cpf ?? fallback.cpf ?? "").trim(),
    cns: String(item?.cns ?? item?.cartaoSus ?? fallback.cns ?? "").trim(),
    cartaoSus: String(item?.cartaoSus ?? item?.cns ?? fallback.cns ?? "").trim(),
    dataNascimento: String(item?.dataNascimento ?? fallback.dataNascimento ?? "").trim(),
    telefone: String(item?.telefone ?? fallback.telefone ?? "").trim(),
    email: String(item?.email ?? fallback.email ?? "").trim(),
    endereco: String(item?.endereco ?? fallback.endereco ?? "").trim(),
    cep: String(item?.cep ?? fallback.cep ?? "").trim(),
    bairro: String(item?.bairro ?? fallback.bairro ?? "").trim(),
    cidade: String(item?.cidade ?? item?.municipio ?? fallback.cidade ?? "").trim(),
    municipio: String(item?.municipio ?? item?.cidade ?? fallback.cidade ?? "").trim(),
  }
}

function appendEmailOsQueryParam(params: URLSearchParams, key: string, value: unknown) {
  const text = String(value ?? "").trim()
  if (text) params.set(key, text)
}

function buildEmailOsPacienteUrl(patient: EmailOsCreatedPatient, module: DemandModuleChoice, os: OsItem) {
  const params = new URLSearchParams()

  params.set("abrirModulo", "1")
  params.set("origem", "email-os")
  params.set("emailOsId", String(os.id))
  params.set("modulo", module)
  params.set("pacienteId", String(patient.id))

  appendEmailOsQueryParam(params, "nome", patient.nome)
  appendEmailOsQueryParam(params, "cpf", patient.cpf)
  appendEmailOsQueryParam(params, "cns", patient.cns ?? patient.cartaoSus)
  appendEmailOsQueryParam(params, "cartaoSus", patient.cartaoSus ?? patient.cns)
  appendEmailOsQueryParam(params, "dataNascimento", patient.dataNascimento)
  appendEmailOsQueryParam(params, "telefone", patient.telefone)
  appendEmailOsQueryParam(params, "email", patient.email)
  appendEmailOsQueryParam(params, "endereco", patient.endereco)
  appendEmailOsQueryParam(params, "cep", patient.cep)
  appendEmailOsQueryParam(params, "bairro", patient.bairro)
  appendEmailOsQueryParam(params, "cidade", patient.cidade ?? patient.municipio)
  appendEmailOsQueryParam(params, "municipio", patient.municipio ?? patient.cidade)

  return "/pacientes?" + params.toString()
}

function EmailOsRegisterModal({
  os,
  initialModule,
  onClose,
}: {
  os: OsItem
  initialModule: string
  onClose: () => void
  onSaved?: () => Promise<void>
}) {
  const suggestedModule = normalizeEmailOsDemandModule(initialModule)
  const [step, setStep] = useState<"patient" | "module">("patient")
  const [saving, setSaving] = useState(false)
  const [createdPatient, setCreatedPatient] = useState<EmailOsCreatedPatient | null>(null)
  const [paciente, setPaciente] = useState<EmailOsPatientFormState>(initialEmailOsPatientForm())

  function updatePatientField<K extends keyof EmailOsPatientFormState>(
    field: K,
    value: EmailOsPatientFormState[K],
  ) {
    setPaciente((current) => ({ ...current, [field]: value }))
  }

  function updatePatientPhone(index: number, value: string) {
    const cleaned = formatEmailOsPhone(cleanEmailOsPatientPhone(value))

    setPaciente((current) => {
      const currentPhones = getEmailOsPatientPhones(current)
      const nextPhones = currentPhones.map((phone, phoneIndex) => (phoneIndex === index ? cleaned : phone))

      return {
        ...current,
        telefone: nextPhones.filter(Boolean)[0] ?? "",
        telefones: nextPhones,
      }
    })
  }

  function addPatientPhone() {
    setPaciente((current) => {
      const currentPhones = getEmailOsPatientPhones(current)
      if (currentPhones.length >= MAX_EMAIL_OS_PATIENT_PHONES) return current

      const nextPhones = [...currentPhones, ""]

      return {
        ...current,
        telefone: nextPhones.filter(Boolean)[0] ?? "",
        telefones: nextPhones,
      }
    })
  }

  function removePatientPhone(index: number) {
    setPaciente((current) => {
      const currentPhones = getEmailOsPatientPhones(current)
      const nextPhones = currentPhones.filter((_, phoneIndex) => phoneIndex !== index)

      return {
        ...current,
        telefone: nextPhones.filter(Boolean)[0] ?? "",
        telefones: nextPhones.length ? nextPhones : [""],
      }
    })
  }

  function validatePatient() {
    const cpf = onlyEmailOsDigits(paciente.cpf)
    const cns = onlyEmailOsDigits(paciente.cns)
    const nome = paciente.nome.trim()

    if (!cpf && !cns) return "Informe CPF ou CNS do paciente."
    if (cpf && cpf.length !== 11) return "CPF deve conter 11 dígitos."
    if (cns && cns.length !== 15) return "CNS deve conter 15 dígitos."
    if (!nome) return "Informe o nome do paciente."
    if (paciente.email && !/^\S+@\S+\.\S+$/.test(paciente.email)) return "E-mail inválido."

    return null
  }

  async function savePatient() {
    if (saving) return

    const error = validatePatient()

    if (error) {
      toast.error(error)
      return
    }

    try {
      setSaving(true)

      const telefones = getEmailOsPatientPhones(paciente).filter(Boolean)

      const payload = {
        ...paciente,
        cpf: onlyEmailOsDigits(paciente.cpf),
        cns: onlyEmailOsDigits(paciente.cns),
        cartaoSus: onlyEmailOsDigits(paciente.cns),
        cep: onlyEmailOsDigits(paciente.cep),
        telefone: telefones[0] ?? "",
        telefones,
        origem: "email-os",
        emailOsId: os.id,
      }

      const response = await fetch("/api/pacientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao salvar paciente.")
        return
      }

      const patient = resolveEmailOsCreatedPatient(json, paciente)

      if (!patient.id) {
        toast.error("Paciente salvo, mas a API não retornou o ID.")
        return
      }

      setCreatedPatient(patient)
      setStep("module")
      toast.success("Paciente salvo. Escolha o módulo da demanda.")
    } catch (error) {
      console.error("EMAIL_OS_SAVE_PATIENT_ERROR", error)
      toast.error("Erro ao salvar paciente.")
    } finally {
      setSaving(false)
    }
  }

  function chooseModule(module: DemandModuleChoice) {
    if (!createdPatient?.id) {
      toast.error("Salve o paciente antes de escolher o módulo.")
      return
    }

    window.location.href = buildEmailOsPacienteUrl(createdPatient, module, os)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {step === "patient" ? "Cadastrar novo paciente" : "Nova Demanda para " + (createdPatient?.nome || "Paciente")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {os.protocolo} • {os.assunto || "Sem assunto"}
            </p>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {step === "patient" ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Cadastre o paciente usando a mesma API da tela /pacientes. Depois será exibido o seletor de módulo.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="CPF"
                value={paciente.cpf}
                onChange={(value) => updatePatientField("cpf", formatEmailOsCpf(value))}
                placeholder="000.000.000-00"
              />

              <Field
                label="CNS"
                value={paciente.cns}
                onChange={(value) => updatePatientField("cns", onlyEmailOsDigits(value).slice(0, 15))}
                placeholder="000000000000000"
              />

              <Field
                label="Nome do paciente"
                value={paciente.nome}
                onChange={(value) => updatePatientField("nome", value)}
                placeholder="Nome completo"
                full
              />

              <Field
                label="Data de nascimento"
                type="date"
                value={paciente.dataNascimento}
                onChange={(value) => updatePatientField("dataNascimento", value)}
              />

              <div className="space-y-2">
                <Label className="mb-1 block text-xs">Telefone(s)</Label>

                <div className="space-y-2">
                  {getEmailOsPatientPhones(paciente).map((telefoneItem, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={telefoneItem}
                        onChange={(event) => updatePatientPhone(index, event.target.value)}
                        placeholder={index === 0 ? "(00) 00000-0000" : "Outro telefone do paciente"}
                        inputMode="tel"
                        maxLength={MAX_EMAIL_OS_PATIENT_PHONE_LENGTH}
                      />

                      {getEmailOsPatientPhones(paciente).length > 1 ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="bg-transparent"
                          onClick={() => removePatientPhone(index)}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <Button type="button" variant="outline" className="bg-transparent" onClick={addPatientPhone}>
                  Adicionar telefone
                </Button>
              </div>

              <Field
                label="E-mail"
                value={paciente.email}
                onChange={(value) => updatePatientField("email", value)}
                placeholder="email@exemplo.com"
              />

              <Field
                label="CEP"
                value={paciente.cep}
                onChange={(value) => updatePatientField("cep", formatEmailOsCep(value))}
                placeholder="00000-000"
              />

              <Field
                label="Bairro"
                value={paciente.bairro}
                onChange={(value) => updatePatientField("bairro", value)}
                placeholder="Bairro"
              />

              <Field
                label="Endereço"
                value={paciente.endereco}
                onChange={(value) => updatePatientField("endereco", value)}
                placeholder="Rua / Avenida / Travessa"
                full
              />

              <Field
                label="Número"
                value={paciente.numero}
                onChange={(value) => updatePatientField("numero", value)}
                placeholder="Número"
              />

              <Field
                label="Complemento"
                value={paciente.complemento}
                onChange={(value) => updatePatientField("complemento", value)}
                placeholder="Apto, bloco, referência..."
              />

              <div className="md:col-span-2">
                <MunicipalitySelectField
                  value={paciente.cidade}
                  onChange={(value) => updatePatientField("cidade", value)}
                  label="Cidade"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button type="button" variant="outline" className="bg-transparent" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>

              <Button type="button" onClick={savePatient} disabled={saving}>
                {saving ? "Salvando..." : "Salvar paciente"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Módulo sugerido pela OS: {demandModuleLabel(suggestedModule)}. Escolha abaixo para abrir o formulário real da tela /pacientes.
            </div>

            <ModuleChooser onChoose={chooseModule} />

            <div className="flex justify-start">
              <Button type="button" variant="outline" className="bg-transparent" onClick={() => setStep("patient")}>
                Voltar aos dados do paciente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


function ModuleChooser({ onChoose }: { onChoose: (module: DemandModuleChoice) => void }) {
  const modules = ["judicial", "tfd", "cnrac", "dialise"] as DemandModuleChoice[]

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {modules.map((module) => (
        <Button
          key={module}
          type="button"
          variant="outline"
          className="h-auto justify-start bg-transparent p-4 text-left"
          onClick={() => onChoose(module)}
        >
          <span className="font-medium">{demandModuleLabel(module)}</span>
        </Button>
      ))}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  full = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  full?: boolean
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="mb-1 block text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}
