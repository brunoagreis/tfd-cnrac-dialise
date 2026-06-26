"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRightLeft, FileText, RefreshCcw, X } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type OsItem = { id: string; protocolo: string; assunto: string; remetente: string; recebidoEm: string; pgeNet: string; processo: string; status: string; moduloDestino: string; responsavelId?: string; responsavelNome: string; responsavelEmail: string; anexos: Array<{ name: string; url: string; mimeType: string; size: number }> }
type UserItem = { id: string; nome: string; email: string }
const MODULES = [{ value: "judicial", label: "Judicial" }, { value: "tfd", label: "TFD" }, { value: "cnrac", label: "CNRAC" }, { value: "hemodialise", label: "Hemodiálise" }]
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR") }
function isAdmin(user: any) {
  const role = String(user?.role || user?.perfil || user?.tipo || user?.nivel || "").toUpperCase()
  return role.includes("ADMIN") || role.includes("ADMINISTRADOR") || user?.isAdmin === true
}

export function EmailOsPanel({ modulo }: { modulo: string }) {
  const { user } = useAuth()
  const [items, setItems] = useState<OsItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedModule, setSelectedModule] = useState<Record<string, string>>({})
  const [selectedUser, setSelectedUser] = useState<Record<string, string>>({})
  const [registeringOs, setRegisteringOs] = useState<OsItem | null>(null)

  const visibleItems = useMemo(() => {
    if (isAdmin(user)) return items
    return items.filter((item) => !item.responsavelId || item.responsavelId === user?.id)
  }, [items, user])

  async function load() {
    try {
      setLoading(true)
      const [osRes, rulesRes] = await Promise.all([fetch(`/api/email-os?modulo=${encodeURIComponent(modulo)}`, { cache: "no-store" }), fetch("/api/admin/judicial/email-integracao/regras", { cache: "no-store" })])
      const osJson = await osRes.json().catch(() => ({}))
      const rulesJson = await rulesRes.json().catch(() => ({}))
      setItems(osRes.ok && osJson?.ok && Array.isArray(osJson.items) ? osJson.items : [])
      setUsers(rulesRes.ok && rulesJson?.ok && Array.isArray(rulesJson.users) ? rulesJson.users : [])
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [modulo])

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
    const response = await fetch("/api/email-os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ osId: os.id, modulo: newModule, responsavelId }) })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) return toast.error(json?.error || "Erro ao transferir OS.")
    toast.success("OS transferida/direcionada.")
    await load()
  }

  if (!visibleItems.length && !loading) return null
  return <>
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-base">Ordens de Serviço recebidas por e-mail</CardTitle><CardDescription>OS sem protocolo. Só o responsável do módulo visualiza; administrador visualiza todas.</CardDescription></div><Button type="button" size="sm" variant="outline" className="bg-transparent" onClick={load} disabled={loading}><RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</Button></div></CardHeader>
      <CardContent className="space-y-3">{visibleItems.map((os) => <div key={os.id} className="rounded-xl border border-border bg-background p-4 text-sm"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{os.protocolo}</Badge><Badge variant="outline">{os.status}</Badge></div><span className="text-xs text-muted-foreground">{formatDate(os.recebidoEm)}</span></div><p className="font-semibold">{os.assunto || "Sem assunto"}</p><p className="text-muted-foreground">Remetente: {os.remetente || "-"}</p><div className="mt-2 grid gap-2 md:grid-cols-3"><div><strong>PGE.net:</strong> {os.pgeNet || "-"}</div><div><strong>Processo:</strong> {os.processo || "-"}</div><div><strong>Responsável:</strong> {os.responsavelNome || "Não definido"}</div></div>{os.anexos?.length ? <div className="mt-3 rounded-lg bg-muted p-3">{os.anexos.map((file, index) => <div key={`${file.name}-${index}`} className="flex flex-wrap items-center gap-2"><FileText className="h-3 w-3" /><span>{file.name}</span>{file.url ? <a className="text-primary underline" href={file.url} target="_blank" rel="noreferrer">Visualizar</a> : null}</div>)}</div> : null}<div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr_auto_auto_auto] md:items-center"><Select value={selectedModule[os.id] || os.moduloDestino || modulo} onValueChange={(value) => setSelectedModule((prev) => ({ ...prev, [os.id]: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MODULES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><Select value={selectedUser[os.id] || ""} onValueChange={(value) => setSelectedUser((prev) => ({ ...prev, [os.id]: value }))}><SelectTrigger><SelectValue placeholder="Responsável obrigatório" /></SelectTrigger><SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome} {u.email ? `(${u.email})` : ""}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" className="bg-transparent" onClick={() => transfer(os)}><ArrowRightLeft className="mr-2 h-4 w-4" /> Transferir</Button>{isAdmin(user) ? <Button type="button" variant="destructive" onClick={() => inativarOs(os)}>Inativar OS</Button> : null}<Button type="button" onClick={() => setRegisteringOs(os)}>Cadastrar no módulo</Button></div></div>)}</CardContent>
    </Card>
    {registeringOs ? <EmailOsRegisterModal os={registeringOs} initialModule={registeringOs.moduloDestino || modulo} onClose={() => setRegisteringOs(null)} onSaved={async () => { setRegisteringOs(null); await load() }} /> : null}
  </>
}

function EmailOsRegisterModal({ os, initialModule, onClose, onSaved }: { os: OsItem; initialModule: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)
  const [paciente, setPaciente] = useState({ cpf: "", cartaoSus: "", nome: "", dataNascimento: "", telefone: "", email: "", municipio: "", endereco: "" })
  const [modulo, setModulo] = useState(initialModule)
  const [demanda, setDemanda] = useState({ localSolicitante: "E-mail recebido", emailSolicitante: "", telefoneSolicitante: "", codigoSigtap: "", descricaoSigtap: "", cid10: "", especialidade: "", subespecialidade: "", tipoSolicitacao: "eletiva", observacoesUnidade: `OS de e-mail: ${os.protocolo}\nAssunto: ${os.assunto}\nRemetente: ${os.remetente}` })
  function setPac(key: string, value: string) { setPaciente((p) => ({ ...p, [key]: value })) }
  function setDem(key: string, value: string) { setDemanda((d) => ({ ...d, [key]: value })) }
  async function submit() {
    if (!paciente.nome || !paciente.cpf || !paciente.cartaoSus) return toast.error("Informe CPF, CNS e nome do paciente.")
    if (!demanda.codigoSigtap || !demanda.descricaoSigtap || !demanda.cid10 || !demanda.especialidade) return toast.error("Informe os dados da demanda.")
    try { setSaving(true); const response = await fetch("/api/solicitacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ osId: os.id, paciente: { cpf: paciente.cpf, cartaoSus: paciente.cartaoSus, nome: paciente.nome, dataNascimento: paciente.dataNascimento || new Date().toISOString().slice(0, 10), telefones: [paciente.telefone || "(00) 00000-0000"], email: paciente.email, municipio: paciente.municipio || "Não informado", endereco: paciente.endereco || "Não informado" }, demanda: { modulo, localSolicitante: demanda.localSolicitante, telefonesSolicitante: [demanda.telefoneSolicitante || "(00) 00000-0000"], emailSolicitante: demanda.emailSolicitante || "sem-email@sigajus.local", codigoSigtap: demanda.codigoSigtap, descricaoSigtap: demanda.descricaoSigtap, cid10: demanda.cid10, especialidade: demanda.especialidade, subespecialidade: demanda.subespecialidade, tipoSolicitacao: demanda.tipoSolicitacao, observacoesUnidade: demanda.observacoesUnidade, acaoJudicial: modulo === "judicial" }, anexos: [] }) }); const json = await response.json().catch(() => ({})); if (!response.ok) return toast.error(json?.error || "Erro ao cadastrar demanda."); toast.success(`OS convertida em protocolo ${json.protocolo}.`); await onSaved() } finally { setSaving(false) }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl bg-background p-6 shadow-xl"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Cadastrar OS no módulo</h2><p className="text-sm text-muted-foreground">{os.protocolo} • {os.assunto}</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button></div>{step === 1 ? <div className="space-y-3"><h3 className="font-semibold">Cadastrar novo paciente</h3><div className="grid gap-3 md:grid-cols-2"><Field label="CPF" value={paciente.cpf} onChange={(v) => setPac("cpf", v)} /><Field label="CNS" value={paciente.cartaoSus} onChange={(v) => setPac("cartaoSus", v)} /><Field label="Nome do paciente" value={paciente.nome} onChange={(v) => setPac("nome", v)} full /><Field label="Data de nascimento" type="date" value={paciente.dataNascimento} onChange={(v) => setPac("dataNascimento", v)} /><Field label="Telefone" value={paciente.telefone} onChange={(v) => setPac("telefone", v)} /><Field label="E-mail" value={paciente.email} onChange={(v) => setPac("email", v)} /><Field label="Cidade" value={paciente.municipio} onChange={(v) => setPac("municipio", v)} /><Field label="Endereço" value={paciente.endereco} onChange={(v) => setPac("endereco", v)} /></div><div className="flex justify-end"><Button onClick={() => setStep(2)}>Próximo</Button></div></div> : null}{step === 2 ? <div className="space-y-4"><h3 className="font-semibold">Nova demanda</h3><p className="text-sm text-muted-foreground">Escolha o módulo para abrir o formulário correto.</p><div className="grid gap-3 md:grid-cols-4">{MODULES.map((m) => <button key={m.value} type="button" onClick={() => { setModulo(m.value); setStep(3) }} className={`rounded-xl border p-4 text-left hover:bg-muted ${modulo === m.value ? "border-primary" : ""}`}><strong>{m.label}</strong></button>)}</div><Button variant="outline" onClick={() => setStep(1)}>Voltar</Button></div> : null}{step === 3 ? <div className="space-y-3"><h3 className="font-semibold">Dados da demanda - {MODULES.find((m) => m.value === modulo)?.label}</h3><div className="grid gap-3 md:grid-cols-2"><Field label="Local solicitante" value={demanda.localSolicitante} onChange={(v) => setDem("localSolicitante", v)} /><Field label="E-mail solicitante" value={demanda.emailSolicitante} onChange={(v) => setDem("emailSolicitante", v)} /><Field label="Telefone solicitante" value={demanda.telefoneSolicitante} onChange={(v) => setDem("telefoneSolicitante", v)} /><Field label="Código SIGTAP" value={demanda.codigoSigtap} onChange={(v) => setDem("codigoSigtap", v)} /><Field label="Descrição SIGTAP" value={demanda.descricaoSigtap} onChange={(v) => setDem("descricaoSigtap", v)} /><Field label="CID-10" value={demanda.cid10} onChange={(v) => setDem("cid10", v)} /><Field label="Especialidade" value={demanda.especialidade} onChange={(v) => setDem("especialidade", v)} /><Field label="Subespecialidade" value={demanda.subespecialidade} onChange={(v) => setDem("subespecialidade", v)} /></div><Label>Observações</Label><Textarea value={demanda.observacoesUnidade} onChange={(e) => setDem("observacoesUnidade", e.target.value)} /><div className="rounded-lg bg-muted p-3 text-sm">Anexos da OS serão mantidos vinculados ao histórico da OS e ao protocolo convertido.</div><div className="flex justify-between"><Button variant="outline" onClick={() => setStep(2)}>Voltar</Button><Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar demanda"}</Button></div></div> : null}</div></div>
}
function Field({ label, value, onChange, type = "text", full = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; full?: boolean }) { return <div className={full ? "md:col-span-2" : ""}><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div> }


