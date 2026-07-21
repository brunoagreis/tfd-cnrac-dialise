"use client"

import { useEffect, useRef, useState } from "react"
import {
  useParams,
  useRouter,
} from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import { useJudicial } from "@/lib/judicial-context"
import { JudicialCaseDetail } from "@/components/modules/judicial-case-detail"
import { JudicialPriorityPanel } from "@/components/modules/judicial-priority-panel"
import { MunicipalityAttachmentLinkEnhancer } from "@/components/modules/municipality-attachment-link-enhancer"

type AccessStatus =
  | "checking"
  | "warning"
  | "allowed"

type MonitoringWarning = {
  tipo: "ATUAL" | "HISTORICO"
  usuarioNome: string
  momento: string | null
}

function formatMonitoringMoment(
  value: string | null,
) {
  if (!value) {
    return "data e horário não disponíveis"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "data e horário não disponíveis"
  }

  const dateText = new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(date)

  const timeText = new Intl.DateTimeFormat(
    "pt-BR",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date)

  return dateText + " às " + timeText
}

export default function JudicialCasePage() {
  const params = useParams()
  const router = useRouter()

  const caseId = String(
    params?.caseId ?? "",
  )

  const { user } = useAuth()
  const judicial = useJudicial()

  const trackedRef =
    useRef<string | null>(null)

  const startedAssignmentRef =
    useRef<string | null>(null)

  const warningDialogRef =
    useRef<HTMLDialogElement | null>(null)

  const [
    accessStatus,
    setAccessStatus,
  ] = useState<AccessStatus>("checking")

  const [
    monitoringWarning,
    setMonitoringWarning,
  ] = useState<MonitoringWarning | null>(
    null,
  )

  const userId = String(
    user?.id ?? "",
  ).trim()

  const userEmail = String(
    user?.email ?? "",
  )
    .trim()
    .toLowerCase()

  const userKey = userId || userEmail

  const trackingKey =
    caseId && userKey
      ? caseId + ":" + userKey
      : null

  useEffect(() => {
    if (!caseId || !trackingKey) {
      return
    }

    let cancelled = false

    setAccessStatus("checking")
    setMonitoringWarning(null)

    const searchParams =
      new URLSearchParams()

    if (userId) {
      searchParams.set("userId", userId)
    }

    if (userEmail) {
      searchParams.set(
        "userEmail",
        userEmail,
      )
    }

    const requestUrl =
      "/api/judicial/casos/" +
      encodeURIComponent(caseId) +
      "/atribuicao?" +
      searchParams.toString()

    fetch(requestUrl, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload =
          await response
            .json()
            .catch(() => null)

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              "Não foi possível verificar o monitoramento.",
          )
        }

        return payload
      })
      .then((payload) => {
        if (cancelled) {
          return
        }

        if (payload?.warning) {
          setMonitoringWarning(
            payload.warning,
          )

          setAccessStatus("warning")
          return
        }

        setAccessStatus("allowed")
      })
      .catch((error) => {
        console.error(
          "CHECK_JUDICIAL_MONITORING_ACCESS_ERROR",
          error,
        )

        if (!cancelled) {
          setAccessStatus("allowed")
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    caseId,
    trackingKey,
    userEmail,
    userId,
  ])

  useEffect(() => {
    if (
      accessStatus !== "warning" ||
      !monitoringWarning
    ) {
      return
    }

    const dialog =
      warningDialogRef.current

    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [
    accessStatus,
    monitoringWarning,
  ])

  useEffect(() => {
    if (
      accessStatus !== "allowed" ||
      !caseId ||
      !user ||
      !trackingKey
    ) {
      return
    }

    if (
      trackedRef.current ===
      trackingKey
    ) {
      return
    }

    trackedRef.current = trackingKey

    judicial.trackUiAction(
      "abrir_processo_judicial",
      user,
      caseId,
    )
  }, [
    accessStatus,
    caseId,
    judicial,
    trackingKey,
    user,
  ])

  useEffect(() => {
    if (
      accessStatus !== "allowed" ||
      !caseId ||
      !user ||
      !trackingKey
    ) {
      return
    }

    if (
      startedAssignmentRef.current ===
      trackingKey
    ) {
      return
    }

    startedAssignmentRef.current =
      trackingKey

    const requestUrl =
      "/api/judicial/casos/" +
      encodeURIComponent(caseId) +
      "/atribuicao"

    fetch(requestUrl, {
      method: "PATCH",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        action: "iniciar",
        user,
      }),
    }).catch((error) => {
      console.error(
        "START_JUDICIAL_ASSIGNMENT_ERROR",
        error,
      )
    })
  }, [
    accessStatus,
    caseId,
    trackingKey,
    user,
  ])

  function continueOpening() {
    const dialog =
      warningDialogRef.current

    if (dialog?.open) {
      dialog.close()
    }

    setAccessStatus("allowed")
  }

  function returnToListing() {
    const dialog =
      warningDialogRef.current

    if (dialog?.open) {
      dialog.close()
    }

    router.replace("/judicial")
  }

  if (!caseId) {
    return null
  }

  if (accessStatus === "checking") {
    return (
      <div className="flex min-h-[45vh] items-center justify-center px-6">
        <div className="rounded-xl border bg-background px-6 py-5 text-center shadow-sm">
          <p className="font-medium">
            Verificando monitoramento do processo...
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Aguarde um instante.
          </p>
        </div>
      </div>
    )
  }

  if (
    accessStatus === "warning" &&
    monitoringWarning
  ) {
    const formattedMoment =
      formatMonitoringMoment(
        monitoringWarning.momento,
      )

    return (
      <dialog
        ref={warningDialogRef}
        aria-labelledby="judicial-monitoring-warning-title"
        aria-describedby="judicial-monitoring-warning-description"
        className="m-auto w-[calc(100vw-2rem)] max-w-lg overflow-visible rounded-2xl border-0 bg-background p-0 text-foreground shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-[2px]"
        onCancel={(event) => {
          event.preventDefault()
          returnToListing()
        }}
      >
        <div className="border-b px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Atenção
          </p>

          <h1
            id="judicial-monitoring-warning-title"
            className="mt-1 text-xl font-semibold tracking-tight"
          >
            Processo já monitorado
          </h1>
        </div>

        <div
          id="judicial-monitoring-warning-description"
          className="space-y-4 px-6 py-5"
        >
          {monitoringWarning.tipo ===
          "ATUAL" ? (
            <p className="leading-7">
              Hoje,{" "}
              <strong>
                {
                  monitoringWarning.usuarioNome
                }
              </strong>{" "}
              já está monitorando este
              processo. O monitoramento foi
              iniciado em{" "}
              <strong>
                {formattedMoment}
              </strong>
              .
            </p>
          ) : (
            <p className="leading-7">
              <strong>
                {
                  monitoringWarning.usuarioNome
                }
              </strong>{" "}
              monitorou este processo em{" "}
              <strong>
                {formattedMoment}
              </strong>
              .
            </p>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Deseja continuar e abrir o
            processo mesmo assim?
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
            onClick={returnToListing}
          >
            Voltar
          </button>

          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={continueOpening}
          >
            Continuar mesmo assim
          </button>
        </div>
      </dialog>
    )
  }

  return (
    <>
      <MunicipalityAttachmentLinkEnhancer />

      <JudicialPriorityPanel
        caseId={caseId}
        user={user}
      />

      <JudicialCaseDetail
        caseId={caseId}
      />
    </>
  )
}
