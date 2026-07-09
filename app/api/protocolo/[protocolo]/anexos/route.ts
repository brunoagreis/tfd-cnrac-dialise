import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { readServerSession } from "@/lib/security/server-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireProtocolUserRequest(req: NextRequest) {
  const session = await readServerSession(req)

  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Acesso negado." },
        { status: 403 },
      ),
    }
  }

  return {
    ok: true as const,
    session,
  }
}

type AnexoRow = {
  id: string
  demandaId: string
  interacaoId: string | null
  nome: string
  tipo: string | null
  tamanho: number | null
  categoria: string | null
  descricao: string | null
  criadoPor: string | null
  criadoPorNome: string | null
  createdAt: string | null
  arquivoNomeOriginal: string | null
  arquivoPath: string | null
  mimeType: string | null
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function buildId(prefix: string) {
  return `${prefix}${randomUUID().replace(/-/g, "")}`
}

function sanitizeSegment(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
}

async function findDemandaIdByProtocol(protocolo: string) {
  const demandaRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT id::text AS id
      FROM public.demandas
      WHERE protocolo = $1
      LIMIT 1
    `,
    protocolo,
  )

  return demandaRows[0]?.id ?? null
}

async function validateInteracaoBelongsToDemanda(interacaoId: string, demandaId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT id::text AS id
      FROM public.interacoes
      WHERE id = $1
        AND "demandaId" = $2
      LIMIT 1
    `,
    interacaoId,
    demandaId,
  )

  return Boolean(rows[0]?.id)
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ protocolo: string }> },
) {
  try {
    const protocolGuardGet = await requireProtocolUserRequest(req)
    if (!protocolGuardGet.ok) return protocolGuardGet.response

    const { protocolo } = await context.params
    const decodedProtocol = decodeURIComponent(protocolo)

    const demandaId = await findDemandaIdByProtocol(decodedProtocol)

    if (!demandaId) {
      return NextResponse.json(
        { ok: false, error: "Protocolo não encontrado." },
        { status: 404 },
      )
    }

    const rows = await prisma.$queryRawUnsafe<AnexoRow[]>(
      `
        SELECT
          a.id::text AS id,
          a."demandaId"::text AS "demandaId",
          a."interacaoId"::text AS "interacaoId",
          a.nome,
          a.tipo,
          a.tamanho,
          a.categoria::text AS categoria,
          a.descricao,
          a."criadoPor" AS "criadoPor",
          a."criadoPorNome" AS "criadoPorNome",
          a."createdAt"::text AS "createdAt",
          a."arquivoNomeOriginal" AS "arquivoNomeOriginal",
          a."arquivoPath" AS "arquivoPath",
          a."mimeType" AS "mimeType"
        FROM public.anexos a
        WHERE a."demandaId" = $1
        ORDER BY a."createdAt" DESC, a.id DESC
      `,
      demandaId,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        demandaId: row.demandaId,
        interacaoId: row.interacaoId ?? "",
        nome: row.nome ?? "",
        tipo: row.tipo ?? "",
        tamanho: Number(row.tamanho ?? 0),
        categoria: row.categoria ?? "outros",
        descricao: row.descricao ?? "",
        criadoPor: row.criadoPor ?? "",
        criadoPorNome: row.criadoPorNome ?? "",
        criadoEm: row.createdAt ?? "",
        arquivoNomeOriginal: row.arquivoNomeOriginal ?? "",
        arquivoPath: row.arquivoPath ?? "",
        mimeType: row.mimeType ?? "",
        arquivoUrl: row.arquivoPath ? `/api/files/${String(row.arquivoPath).split("/").filter(Boolean).join("/")}` : "",
      })),
    })
  } catch (error) {
    console.error("[GET /api/protocolo/[protocolo]/anexos] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar documentos do protocolo." },
      { status: 500 },
    )
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ protocolo: string }> },
) {
  try {
    const protocolGuardPost = await requireProtocolUserRequest(req)
    if (!protocolGuardPost.ok) return protocolGuardPost.response

    const { protocolo } = await context.params
    const decodedProtocol = decodeURIComponent(protocolo)
    const demandaId = await findDemandaIdByProtocol(decodedProtocol)

    if (!demandaId) {
      return NextResponse.json(
        { ok: false, error: "Protocolo não encontrado." },
        { status: 404 },
      )
    }

    const form = await req.formData()

    const file = form.get("file")
    const categoria = normalizeText(form.get("categoria")) || "outros"
    const descricao = normalizeText(form.get("descricao")) || null
    const criadoPor = normalizeText(form.get("criadoPor")) || null
    const criadoPorNome = normalizeText(form.get("criadoPorNome")) || null
    const interacaoId = normalizeText(form.get("interacaoId")) || null

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Arquivo é obrigatório." },
        { status: 400 },
      )
    }

    if (!file.name) {
      return NextResponse.json(
        { ok: false, error: "Nome do arquivo inválido." },
        { status: 400 },
      )
    }

    if (interacaoId) {
      const interacaoValida = await validateInteracaoBelongsToDemanda(interacaoId, demandaId)

      if (!interacaoValida) {
        return NextResponse.json(
          { ok: false, error: "Movimentação inválida para este protocolo." },
          { status: 400 },
        )
      }
    }

    const id = buildId("anx_")
    const protocoloSeguro = sanitizeSegment(decodedProtocol)
    const nomeOriginal = file.name
    const nomeSeguro = sanitizeSegment(nomeOriginal)
    const nomeFisico = `${Date.now()}_${randomUUID().replace(/-/g, "")}_${nomeSeguro}`

    const pastaRelativa = path.posix.join("/uploads", "protocolos", protocoloSeguro)
    const pastaFisica = path.join(process.cwd(), "public", "uploads", "protocolos", protocoloSeguro)
    const arquivoFisico = path.join(pastaFisica, nomeFisico)
    const arquivoPath = path.posix.join(pastaRelativa, nomeFisico)

    await mkdir(pastaFisica, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(arquivoFisico, buffer)

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO public.anexos (
          id,
          "demandaId",
          "interacaoId",
          nome,
          tipo,
          tamanho,
          categoria,
          descricao,
          "criadoPor",
          "criadoPorNome",
          "createdAt",
          "arquivoNomeOriginal",
          "arquivoPath",
          "mimeType"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::"CategoriaAnexo", $8, $9, $10, NOW(), $11, $12, $13)
      `,
      id,
      demandaId,
      interacaoId,
      nomeOriginal,
      file.type || null,
      Number(file.size ?? 0),
      categoria,
      descricao,
      criadoPor,
      criadoPorNome,
      nomeOriginal,
      arquivoPath,
      file.type || null,
    )

    return NextResponse.json({
      ok: true,
      item: {
        id,
        demandaId,
        interacaoId: interacaoId ?? "",
        nome: nomeOriginal,
        tipo: file.type || "",
        tamanho: Number(file.size ?? 0),
        categoria,
        descricao: descricao ?? "",
        criadoPor: criadoPor ?? "",
        criadoPorNome: criadoPorNome ?? "",
        criadoEm: new Date().toISOString(),
        arquivoNomeOriginal: nomeOriginal,
        arquivoPath,
        mimeType: file.type || "",
        arquivoUrl: `/api/files/${arquivoPath.split("/").filter(Boolean).join("/")}`,
      },
    })
  } catch (error) {
    console.error("[POST /api/protocolo/[protocolo]/anexos] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao fazer upload do documento." },
      { status: 500 },
    )
  }
}
