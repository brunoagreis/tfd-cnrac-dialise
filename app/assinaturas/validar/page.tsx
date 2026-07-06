import Link from "next/link"

import { prisma } from "@/lib/prisma"
import {
  hasMedicalDigitalSignature,
  isValidAssinaturaDigitalSig,
} from "@/lib/assinatura-digital"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ValidationRow = {
  id: string
  protocolo: string | null
  texto: string | null
  pendencia: string | null
  createdAt: string | null
  createdByName: string | null
  createdByCpf: string | null
  assinaturaUrl: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return "Não informado"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("pt-BR")
}

function signatureLines(texto: string | null) {
  const text = String(texto ?? "")
  const marker = "ASSINATURA DIGITAL DO MÉDICO"
  const index = text.indexOf(marker)

  if (index < 0) return []

  return text
    .slice(index)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export default async function ValidarAssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; sig?: string }>
}) {
  const params = await searchParams
  const id = String(params?.id ?? "").trim()
  const sig = String(params?.sig ?? "").trim()
  const signatureOk = Boolean(id && sig && isValidAssinaturaDigitalSig(id, sig))

  let row: ValidationRow | null = null

  if (signatureOk) {
    const rows = await prisma.$queryRawUnsafe<ValidationRow[]>(
      `
        SELECT
          i.id::text AS id,
          d.protocolo,
          i.texto,
          i.pendencia,
          i."createdAt"::text AS "createdAt",
          i."createdByName" AS "createdByName",
          i."createdByCpf" AS "createdByCpf",
          i."assinaturaUrl" AS "assinaturaUrl"
        FROM public.interacoes i
        INNER JOIN public.demandas d ON d.id = i."demandaId"
        WHERE i.id::text = $1
        LIMIT 1
      `,
      id,
    )

    row = rows[0] ?? null
  }

  const hasSignature = row
    ? hasMedicalDigitalSignature(row.texto, row.assinaturaUrl)
    : false
  const valid = signatureOk && Boolean(row) && hasSignature
  const lines = signatureLines(row?.texto ?? null)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div
          className={
            valid
              ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4"
              : "rounded-xl border border-red-200 bg-red-50 p-4"
          }
        >
          <p
            className={
              valid
                ? "text-lg font-semibold text-emerald-900"
                : "text-lg font-semibold text-red-900"
            }
          >
            {valid
              ? "Assinatura digital válida"
              : "Não foi possível validar a assinatura digital"}
          </p>

          <p className="mt-1 text-sm text-slate-700">
            {valid
              ? "Este QR Code corresponde a uma movimentação médica registrada no SIGAJUS."
              : "O código informado é inválido, expirado ou não corresponde a uma movimentação médica assinada."}
          </p>
        </div>

        {valid && row ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Protocolo
                </p>
                <p className="mt-1 font-semibold">{row.protocolo}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Data/hora do registro
                </p>
                <p className="mt-1 font-semibold">
                  {formatDateTime(row.createdAt)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Profissional
                </p>
                <p className="mt-1 font-semibold">
                  {row.createdByName || "Não informado"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Identificador da movimentação
                </p>
                <p className="mt-1 break-all font-mono text-xs">{row.id}</p>
              </div>
            </div>

            {lines.length ? (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Dados da assinatura
                </p>
                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-sm">
                  {lines.join("\n")}
                </pre>
              </div>
            ) : null}

            {row.assinaturaUrl ? (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Imagem de assinatura cadastrada
                </p>
                <img
                  src={row.assinaturaUrl}
                  alt="Assinatura digital do médico"
                  className="mt-3 max-h-24 max-w-xs object-contain"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">
          <Link href="/" className="font-medium text-slate-900 underline">
            Voltar ao SIGAJUS
          </Link>
        </div>
      </div>
    </main>
  )
}
