import { createHmac, timingSafeEqual } from "node:crypto"

function getAssinaturaSecret() {
  return (
    process.env.ASSINATURA_DIGITAL_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.DATABASE_URL ||
    "sigajus-assinatura-digital"
  )
}

export function assinaturaDigitalSig(id: string) {
  return createHmac("sha256", getAssinaturaSecret())
    .update(String(id ?? "").trim())
    .digest("hex")
    .slice(0, 40)
}

export function isValidAssinaturaDigitalSig(id: string, sig: string) {
  const expected = assinaturaDigitalSig(id)
  const received = String(sig ?? "").trim()

  if (!received || received.length !== expected.length) return false

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  } catch {
    return false
  }
}

export function buildAssinaturaValidationUrl(origin: string, id: string) {
  const configuredBaseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.ASSINATURA_DIGITAL_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.PUBLIC_BASE_URL

  const cleanOrigin = String(configuredBaseUrl || origin || "").replace(/\/+$/, "")
  const cleanId = String(id ?? "").trim()
  const sig = assinaturaDigitalSig(cleanId)

  return `${cleanOrigin}/assinaturas/validar?id=${encodeURIComponent(cleanId)}&sig=${encodeURIComponent(sig)}`
}

export function hasMedicalDigitalSignature(texto: unknown, assinaturaUrl?: unknown) {
  const text = String(texto ?? "")

  return (
    text.includes("ASSINATURA DIGITAL DO MÉDICO") ||
    Boolean(String(assinaturaUrl ?? "").trim())
  )
}
