"use client"

import { useEffect } from "react"

export function EmailOsSolicitacaoBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const osId = params.get("osId") || ""
    const modulo = params.get("modulo") || ""
    if (!osId || !window.location.pathname.startsWith("/solicitacao")) return

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes("/api/solicitacoes") && init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body)
          body.osId = osId
          if (modulo && body?.demanda && !body.demanda.modulo) body.demanda.modulo = modulo
          return originalFetch(input, { ...init, body: JSON.stringify(body) })
        } catch {
          return originalFetch(input, init)
        }
      }
      return originalFetch(input, init)
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}
