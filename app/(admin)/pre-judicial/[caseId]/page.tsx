"use client"

import { useEffect, useRef } from "react"
import { useParams } from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import { usePreJudicial } from "@/lib/pre-judicial-context"
import { PreJudicialCaseDetail } from "@/components/modules/pre-judicial-case-detail"

export default function PreJudicialDetailPage() {
  const params = useParams<{ caseId: string }>()
  const { user } = useAuth()
  const preJudicial = usePreJudicial()
  const trackedRef = useRef<string | null>(null)

  const caseId = typeof params?.caseId === "string" ? params.caseId : null
  const userId = user?.id ?? null
  const trackingKey = caseId && userId ? `${caseId}:${userId}` : null

  useEffect(() => {
    if (!caseId || !user || !trackingKey) return
    if (trackedRef.current === trackingKey) return

    trackedRef.current = trackingKey
    preJudicial.trackUiAction("abrir_processo_pre_judicial", user, caseId)
  }, [caseId, trackingKey, userId])

  if (!caseId) return null

  return <PreJudicialCaseDetail caseId={caseId} />
}