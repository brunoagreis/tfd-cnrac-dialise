"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"

function priorityLabel(value: number) {
  if (value === 3) return "03 - Emergência"
  if (value === 2) return "02 - Urgente"
  if (value === 1) return "01 - Agilizar"
  return "00 - Normal"
}

export function JudicialPriorityBadge({ caseId }: { caseId: string }) {
  const [priority, setPriority] = useState(0)
  const [reason, setReason] = useState("")

  useEffect(() => {
    let active = true

    async function loadPriority() {
      try {
        const response = await fetch(
          `/api/judicial/casos/${encodeURIComponent(caseId)}/prioridade`,
          { cache: "no-store" },
        )
        const data = await response.json().catch(() => ({}))

        if (!response.ok || !data?.ok || !active) return

        setPriority(Number(data.item?.prioridade ?? 0))
        setReason(String(data.item?.motivo ?? ""))
      } catch (error) {
        if (active) console.error("LOAD_JUDICIAL_PRIORITY_BADGE_ERROR", error)
      }
    }

    if (caseId) void loadPriority()

    return () => {
      active = false
    }
  }, [caseId])

  if (!priority) return null

  return (
    <Badge
      variant={priority >= 2 ? "destructive" : "secondary"}
      title={reason || priorityLabel(priority)}
    >
      {priorityLabel(priority)}
    </Badge>
  )
}
