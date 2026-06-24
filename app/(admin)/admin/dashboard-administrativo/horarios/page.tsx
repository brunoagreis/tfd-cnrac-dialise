"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CalendarClock, RefreshCw, Save, X } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { hasUserPermission } from "@/lib/access-control"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Usuario = { id: string; nome: string; email: string; role: string; perfilCodigo: string; ativo: boolean }
type Horario = { id: string; idUsuario: string; usuarioNome: string; usuarioEmail: string; diaSemana: number; horaEntrada: string; horaEntradaAlmoco: string; horaRetornoAlmoco: string; horaSaida: string; ativo: boolean; createdAt: string | null; updatedAt: string | null }
type ApiResponse = { ok: boolean; usuarios: Usuario[]; horarios: Horario[]; error?: string }

const WEEKDAYS = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
]

function weekdayLabel(value: number) { return WEEKDAYS.find((item) => item.value === value)?.label ?? `Dia ${value}` }
function timeRange(h: Horario) { return `${h.horaEntrada} - ${h.horaEntradaAlmoco} / ${h.horaRetornoAlmoco} - ${h.horaSaida}` }

export default function HorariosTrabalhoPage() {
  const { user, isReady } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [editingHorarioId, setEditingHorarioId] = useState("")
  const [diaSemana, setDiaSemana] = useState("1")
  const [horaEntrada, setHoraEntrada] = useState("07:30")
  const [horaEntradaAlmoco, setHoraEntradaAlmoco] = useState("11:30")
  const [horaRetornoAlmoco, setHoraRetornoAlmoco] = useState("12:30")
  const [horaSaida, setHoraSaida] = useState("16:30")

  const canAccess = useMemo(() => hasUserPermission(user as any, "DASHBOARD_ADMINISTRATIVO", "visualizar"), [user])

  const grupos = useMemo(() => {
    const map = new Map<string, { usuario: Usuario | { id: string; nome: string; email: string }; horarios: Horario[] }>()
    for (const usuario of usuarios) map.set(usuario.id, { usuario, horarios: [] })
    for (const horario of horarios) {
      const existing = map.get(horario.idUsuario)
      if (existing) existing.horarios.push(horario)
      else map.set(horario.idUsuario, { usuario: { id: horario.idUsuario, nome: horario.usuarioNome, email: horario.usuarioEmail }, horarios: [horario] })
    }
    return Array.from(map.values())
      .filter((group) => group.horarios.length > 0)
      .sort((a, b) => (a.usuario.nome || a.usuario.email).localeCompare(b.usuario.nome || b.usuario.email, "pt-BR"))
  }, [usuarios, horarios])

  const selectedGroup = useMemo(() => grupos.find((group) => group.usuario.id === selectedUserId) || null, [grupos, selectedUserId])
  const selectedUsuario = useMemo(() => usuarios.find((usuario) => usuario.id === selectedUserId) || selectedGroup?.usuario || null, [usuarios, selectedUserId, selectedGroup])

  async function loadData() {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/dashboard-administrativo/horarios", { method: "GET", cache: "no-store" })
      const json = await response.json().catch(() => ({})) as Partial<ApiResponse>
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar horários.")
      setUsuarios(Array.isArray(json.usuarios) ? json.usuarios : [])
      setHorarios(Array.isArray(json.horarios) ? json.horarios : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar horários.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isReady && canAccess) void loadData() }, [isReady, canAccess])

  function resetForm() {
    setEditingHorarioId("")
    setDiaSemana("1")
    setHoraEntrada("07:30")
    setHoraEntradaAlmoco("11:30")
    setHoraRetornoAlmoco("12:30")
    setHoraSaida("16:30")
  }

  function editHorario(horario: Horario) {
    setEditingHorarioId(horario.id)
    setDiaSemana(String(horario.diaSemana))
    setHoraEntrada(horario.horaEntrada)
    setHoraEntradaAlmoco(horario.horaEntradaAlmoco)
    setHoraRetornoAlmoco(horario.horaRetornoAlmoco)
    setHoraSaida(horario.horaSaida)
  }

  async function saveSchedule() {
    const usuario = selectedUsuario
    if (!usuario) return toast.error("Selecione o usuário.")
    try {
      setSaving(true)
      if (editingHorarioId) {
        await setActive(editingHorarioId, false, false)
      }
      const response = await fetch("/api/admin/dashboard-administrativo/horarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idUsuario: usuario.id,
          usuarioNome: usuario.nome,
          usuarioEmail: usuario.email,
          diaSemana: Number(diaSemana),
          horaEntrada,
          horaEntradaAlmoco,
          horaRetornoAlmoco,
          horaSaida,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar horário.")
      toast.success(editingHorarioId ? "Horário editado." : "Horário salvo.")
      resetForm()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar horário.")
    } finally {
      setSaving(false)
    }
  }

  async function setActive(id: string, ativo: boolean, showToast = true) {
    try {
      const response = await fetch("/api/admin/dashboard-administrativo/horarios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ativo }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao atualizar horário.")
      if (showToast) toast.success(ativo ? "Horário ativado." : "Horário excluído/inativado.")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar horário.")
    }
  }

  if (!isReady) return null
  if (!canAccess) return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Você não tem permissão para acessar os horários de trabalho.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><CalendarClock className="h-5 w-5 text-primary" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Horários de trabalho</h1><p className="text-sm text-muted-foreground">Agrupado por usuário. Abra o modal para ver, adicionar, editar ou excluir horários.</p></div>
        </div>
        <Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin Judicial</Link></Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Horários cadastrados</CardTitle><CardDescription>Os horários ativos são usados no cálculo da ociosidade.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-end"><Button variant="outline" className="bg-transparent" onClick={loadData} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Atualizar lista</Button></div>
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : grupos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum horário cadastrado.</p> : grupos.map((group) => {
            const ativos = group.horarios.filter((h) => h.ativo)
            return <div key={group.usuario.id} className="rounded-xl border border-border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{group.usuario.nome || group.usuario.email || group.usuario.id}</p><p className="text-sm text-muted-foreground">{ativos.length} horário(s) ativo(s) • {group.horarios.length} total</p><div className="mt-2 flex flex-wrap gap-2">{ativos.slice(0, 5).map((h) => <Badge key={h.id} variant="outline">{weekdayLabel(h.diaSemana)}</Badge>)}</div></div><Button onClick={() => { setSelectedUserId(group.usuario.id); resetForm() }}>Ver horários</Button></div></div>
          })}
        </CardContent>
      </Card>

      {selectedGroup ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl bg-background p-6 shadow-xl"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Horários de {selectedUsuario?.nome || selectedUsuario?.email}</h2><p className="text-sm text-muted-foreground">Adicione, edite ou exclua horários deste usuário.</p></div><Button variant="ghost" size="icon" onClick={() => { setSelectedUserId(""); resetForm() }}><X className="h-4 w-4" /></Button></div><Card className="mb-4"><CardHeader><CardTitle>{editingHorarioId ? "Editar horário" : "Novo horário"}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 md:grid-cols-5"><div><Label>Dia</Label><select value={diaSemana} onChange={(e) => setDiaSemana(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div><div><Label>Entrada</Label><Input type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} /></div><div><Label>Saída almoço</Label><Input type="time" value={horaEntradaAlmoco} onChange={(e) => setHoraEntradaAlmoco(e.target.value)} /></div><div><Label>Retorno almoço</Label><Input type="time" value={horaRetornoAlmoco} onChange={(e) => setHoraRetornoAlmoco(e.target.value)} /></div><div><Label>Saída</Label><Input type="time" value={horaSaida} onChange={(e) => setHoraSaida(e.target.value)} /></div></div><div className="flex flex-wrap gap-2"><Button onClick={saveSchedule} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : editingHorarioId ? "Salvar edição" : "Adicionar horário"}</Button>{editingHorarioId ? <Button variant="outline" className="bg-transparent" onClick={resetForm}>Cancelar edição</Button> : null}</div></CardContent></Card><div className="space-y-2">{selectedGroup.horarios.map((h) => <div key={h.id} className="rounded-xl border p-3"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="mb-1 flex flex-wrap gap-2"><Badge variant={h.ativo ? "default" : "secondary"}>{h.ativo ? "Ativo" : "Inativo"}</Badge><Badge variant="outline">{weekdayLabel(h.diaSemana)}</Badge></div><p className="text-sm text-muted-foreground">{timeRange(h)}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="bg-transparent" onClick={() => editHorario(h)}>Editar</Button><Button variant="destructive" onClick={() => setActive(h.id, false)}>Excluir</Button>{!h.ativo ? <Button variant="outline" className="bg-transparent" onClick={() => setActive(h.id, true)}>Ativar</Button> : null}</div></div></div>)}</div></div></div> : null}
    </div>
  )
}
