"use client"

import { useEffect, useRef } from "react"
import { useParams } from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import { JudicialCaseDetail } from "@/components/modules/judicial-case-detail"

export default function JudicialCasePage() {
  const params = useParams()
const caseId = String(params?.caseId ?? "")
  const { user } = useAuth()
  const judicial = useJudicial()
  const trackedRef = useRef(null as string | null)

  const userId = user?.id ?? null
  const trackingKey = caseId && userId ? `${caseId}:${userId}` : null

  useEffect(() => {
    if (!caseId || !user || !trackingKey) return
    if (trackedRef.current === trackingKey) return

    trackedRef.current = trackingKey
    judicial.trackUiAction("abrir_processo_judicial", user, caseId)
  }, [caseId, trackingKey, userId])

  if (!caseId) return null

  return <JudicialCaseDetail caseId={caseId} />
}
