import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

async function fetchBrasilApiCep(cep: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    })

    const json = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message =
        text(json?.message) ||
        text(json?.error) ||
        text(json?.errors?.[0]?.message) ||
        "CEP não localizado na BrasilAPI."

      const error = new Error(message)
      ;(error as any).status = response.status
      throw error
    }

    return json
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ cep: string }> },
) {
  try {
    const { cep: rawCep } = await context.params
    const cep = onlyDigits(rawCep).slice(0, 8)

    if (cep.length !== 8) {
      return NextResponse.json(
        { ok: false, error: "Informe um CEP válido com 8 dígitos." },
        { status: 400 },
      )
    }

    const brasilApi = await fetchBrasilApiCep(cep)

    return NextResponse.json({
      ok: true,
      item: {
        cep: onlyDigits(brasilApi?.cep) || cep,
        logradouro: text(brasilApi?.street),
        bairro: text(brasilApi?.neighborhood),
        complemento: text(brasilApi?.complement),
        uf: text(brasilApi?.state),
        localidade: text(brasilApi?.city),
        fonte: text(brasilApi?.service) || "brasilapi",
      },
    })
  } catch (error) {
    console.error("[GET /api/cep/[cep]] erro:", error)

    const rawStatus = Number((error as any)?.status ?? 500)
    const status = rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao consultar CEP na BrasilAPI.",
      },
      { status },
    )
  }
}
