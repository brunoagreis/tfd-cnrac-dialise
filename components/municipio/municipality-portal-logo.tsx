"use client"

import { useState } from "react"

type PortalLogoProps = {
  variant?: "color" | "white"
  className?: string
}

const sources = {
  color: ["/larga-logo-sigajus.png", "/larga-logo-sigajus", "/logo-sigajus.png"],
  white: ["/larga-sigajus-branca.png", "/larga-sigajus-branca", "/larga-logo-sigajus.png", "/larga-logo-sigajus"],
}

export function MunicipalityPortalLogo({ variant = "color", className = "h-12 w-auto" }: PortalLogoProps) {
  const list = sources[variant]
  const [index, setIndex] = useState(0)
  const src = list[index]

  if (!src) {
    return <span className="text-lg font-bold tracking-tight">SIGAJUS</span>
  }

  return (
    <img
      src={src}
      alt="SIGAJUS"
      className={className}
      onError={() => setIndex((current) => current + 1)}
    />
  )
}
