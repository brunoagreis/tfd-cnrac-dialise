"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PRIORITY_OPTIONS = [
  { value: 0, label: "00 - Normal" },
  { value: 1, label: "01 - Agilizar" },
  { value: 2, label: "02 - Urgente" },
  { value: 3, label: "03 - Emergência" },
]

function priorityLabel(value: number) {
  return PRIORITY_OPTIONS.find((item) => item.value === value)?.label || "00 - Normal"
}

function formatDateTime(value?: string | null) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleString("pt-BR")
}

export function JudicialPriorityPanel({
  caseId,
  user,
}: {
  caseId: string
  user: any
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [priority, setPriority] = useState(0)
  const [reason, setReason] = useState("")
  const [updatedAt, setUpdatedAt] = useState("")
  const [updatedBy, setUpdatedBy] = useState("")

  useEffect(() => {
    let active = true

    async function loadPriority() {
      try {
        setLoading(true)

        const response = await fetch(
          `/api/judicial/casos/${encodeURIComponent(caseId)}/prioridade`,
          { cache: "no-store" },
        )
        const data = await response.json().catch(() => ({}))

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Erro ao carregar prioridade judicial.")
        }

        if (!active) return

        setPriority(Number(data.item?.prioridade ?? 0))
        setReason(data.item?.motivo || "")
        setUpdatedAt(data.item?.atualizadoEm || "")
        setUpdatedBy(data.item?.atualizadoPor || "")
      } catch (error) {
        if (!active) return
        console.error("LOAD_JUDICIAL_PRIORITY_ERROR", error)
      } finally {
        if (active) setLoading(false)
      }
    }

    if (caseId) void loadPriority()

    return () => {
      active = false
    }
  }, [caseId])

  async function handleSave() {
    if (!user) {
      toast.error("Usuário não identificado.")
      return
    }

    try {
      setSaving(true)

      const response = await fetch(
        `/api/judicial/casos/${encodeURIComponent(caseId)}/prioridade`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prioridade: priority,
            motivo: reason.trim() || undefined,
            user,
          }),
        },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao salvar prioridade judicial.")
      }

      setPriority(Number(data.item?.prioridade ?? priority))
      setReason(data.item?.motivo || "")
      setUpdatedAt(data.item?.atualizadoEm || new Date().toISOString())
      setUpdatedBy(data.item?.atualizadoPor || user?.nome || user?.name || "")
      toast.success("Prioridade judicial atualizada.")
    } catch (error) {
      console.error("SAVE_JUDICIAL_PRIORITY_ERROR", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao salvar prioridade judicial.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-4 border-border">
      <CardContent className="pt-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-[180px] flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-card-foreground">
                Prioridade do monitoramento
              </p>
              <Badge variant={priority >= 2 ? "destructive" : priority === 1 ? "secondary" : "outline"}>
                {priorityLabel(priority)}
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <Label className="mb-1 block text-xs">Prioridade</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={priority}
                  disabled={loading || saving}
                  onChange={(event) => setPriority(Number(event.target.value))}
                >
                  {PRIORITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="mb-1 block text-xs">Motivo da prioridade</Label>
                <Input
                  value={reason}
                  disabled={loading || saving}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex.: decisão urgente, prazo curto, risco assistencial..."
                />
              </div>
            </div>

            {(updatedAt || updatedBy) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Última alteração: {formatDateTime(updatedAt) || "data não informada"}
                {updatedBy ? ` • ${updatedBy}` : ""}
              </p>
            )}
          </div>

          <Button type="button" onClick={handleSave} disabled={loading || saving}>
            {saving ? "Salvando..." : "Salvar prioridade"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
