import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function firstText(source: any, keys: string[]) {
  for (const key of keys) {
    const value = text(source?.[key])
    if (value) return value
  }

  return ""
}

async function fetchCorreiosCep(cep: string, token: string) {
  const urls = [
    `https://api.correios.com.br/cep/v2/endere%C3%A7os/${cep}`,
    `https://api.correios.com.br/cep/v2/enderecos/${cep}`,
  ]

  let lastStatus = 0
  let lastError = ""

  for (const url of urls) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    lastStatus = response.status

    const json = await response.json().catch(() => ({}))

    if (response.ok) {
      return json
    }

    lastError = text(json?.msgs?.[0]) || text(json?.message) || text(json?.error) || response.statusText

    if (![404, 405].includes(response.status)) {
      break
    }
  }

  const error = new Error(lastError || "CEP não localizado nos Correios.")
  ;(error as any).status = lastStatus
  throw error
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

    const token =
      process.env.CORREIOS_BUSCA_CEP_TOKEN ||
      process.env.CORREIOS_API_TOKEN ||
      process.env.CORREIOS_TOKEN ||
      ""

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Token da API Busca CEP dos Correios não configurado no servidor.",
        },
        { status: 503 },
      )
    }

    const correios = await fetchCorreiosCep(cep, token)
    const item = Array.isArray(correios?.itens) ? correios.itens[0] : correios

    if (!item) {
      return NextResponse.json(
        { ok: false, error: "CEP não localizado nos Correios." },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      item: {
        cep,
        logradouro: firstText(item, ["logradouro", "endereco", "abreviatura"]),
        bairro: firstText(item, ["bairro", "nomeBairro"]),
        complemento: firstText(item, ["complemento"]),
        uf: firstText(item, ["uf"]),
        localidade: firstText(item, ["localidade", "municipio", "cidade"]),
      },
    })
  } catch (error) {
    console.error("[GET /api/cep/[cep]] erro:", error)

    const status = Number((error as any)?.status ?? 500)
    const safeStatus = status >= 400 && status < 600 ? status : 500

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao consultar CEP.",
      },
      { status: safeStatus },
    )
  }
}
