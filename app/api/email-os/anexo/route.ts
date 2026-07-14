import { NextRequest, NextResponse } from "next/server"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { readServerSession } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type OsAttachmentRow = {
  id: string
  protocolo: string | null
  responsavelId: string | null
  responsavelNome: string | null
  responsavelEmail: string | null
  anexos: unknown
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function parseArray(value: unknown) {
  if (Array.isArray(value)) return value

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

function parseObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeAccessValue(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function isAdminSession(session: any) {
  const role = normalizeAccessValue(
    session?.role ??
      session?.perfil ??
      session?.tipo ??
      session?.nivel ??
      session?.perfilCodigo ??
      session?.perfil_codigo,
  )

  return (
    role === "admin" ||
    role === "administrador" ||
    role.includes("admin") ||
    session?.isAdmin === true
  )
}

function isResponsible(session: any, os: OsAttachmentRow) {
  if (isAdminSession(session)) return true

  const sessionIds = [
    session?.id,
    session?.userId,
    session?.usuarioId,
    session?.usuario_id,
  ].map(normalizeAccessValue).filter(Boolean)

  const sessionEmails = [
    session?.email,
    session?.login,
  ].map(normalizeAccessValue).filter(Boolean)

  const sessionNames = [
    session?.nome,
    session?.name,
    session?.username,
  ].map(normalizeAccessValue).filter(Boolean)

  const responsibleId = normalizeAccessValue(os.responsavelId)
  const responsibleEmail = normalizeAccessValue(os.responsavelEmail)
  const responsibleName = normalizeAccessValue(os.responsavelNome)

  const matchesId = Boolean(responsibleId && sessionIds.includes(responsibleId))
  const matchesEmail = Boolean(responsibleEmail && sessionEmails.includes(responsibleEmail))
  const matchesName = Boolean(responsibleName && sessionNames.includes(responsibleName))

  return matchesId || matchesEmail || matchesName
}

function contentTypeFromName(name: string, fallback = "") {
  const lower = name.toLowerCase()

  if (fallback) return fallback
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8"

  return "application/octet-stream"
}

function safeFilename(value: unknown) {
  return text(value)
    .replace(/[\r\n"]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "anexo"
}

async function fileExists(filePath: string) {
  try {
    const info = await stat(filePath)
    return info.isFile()
  } catch {
    return false
  }
}

function candidatePathsFromRecord(record: Record<string, unknown>) {
  return [
    record.url,
    record.relativePath,
    record.arquivoPath,
    record.path,
    record.filePath,
    record.localPath,
  ].map(text).filter(Boolean)
}

async function resolveAttachmentPath(record: Record<string, unknown>) {
  const publicRoot = path.resolve(process.cwd(), "public")

  for (const raw of candidatePathsFromRecord(record)) {
    if (/^https?:\/\//i.test(raw)) {
      return { externalUrl: raw, filePath: "" }
    }

    const normalized = raw.replace(/\\/g, "/")
    const clean = normalized.split("?")[0] || normalized

    const candidates: string[] = []

    if (clean.startsWith("/uploads/")) {
      candidates.push(path.join(publicRoot, clean.replace(/^\/+/, "")))
    } else if (clean.startsWith("uploads/")) {
      candidates.push(path.join(publicRoot, clean))
    } else if (clean.startsWith("public/uploads/")) {
      candidates.push(path.join(process.cwd(), clean))
    } else if (path.isAbsolute(clean)) {
      candidates.push(clean)
    }

    for (const candidate of candidates) {
      const resolved = path.resolve(candidate)

      if (!resolved.startsWith(publicRoot + path.sep)) continue

      if (await fileExists(resolved)) {
        return { externalUrl: "", filePath: resolved }
      }
    }
  }

  return { externalUrl: "", filePath: "" }
}

export async function GET(req: NextRequest) {
  try {
    const session = readServerSession(req)

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Sessão expirada. Faça login novamente." },
        { status: 401 },
      )
    }

    const osId = text(
      req.nextUrl.searchParams.get("osId") ||
        req.nextUrl.searchParams.get("id") ||
        req.nextUrl.searchParams.get("protocolo"),
    )

    const index = Number(req.nextUrl.searchParams.get("index") ?? "0")
    const disposition =
      text(req.nextUrl.searchParams.get("disposition")).toLowerCase() === "attachment"
        ? "attachment"
        : "inline"

    if (!osId) {
      return NextResponse.json(
        { ok: false, error: "Informe a OS do anexo." },
        { status: 400 },
      )
    }

    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json(
        { ok: false, error: "Índice do anexo inválido." },
        { status: 400 },
      )
    }

    const rows = await prisma.$queryRawUnsafe<OsAttachmentRow[]>(
      `
        SELECT
          id::text AS id,
          protocolo,
          responsavel_id AS "responsavelId",
          responsavel_nome AS "responsavelNome",
          responsavel_email AS "responsavelEmail",
          anexos
        FROM public.judicial_email_os
        WHERE id::text = $1
           OR protocolo = $1
        LIMIT 1
      `,
      osId,
    )

    const os = rows[0]

    if (!os) {
      return NextResponse.json(
        { ok: false, error: "OS não encontrada." },
        { status: 404 },
      )
    }

    if (!isResponsible(session, os)) {
      return NextResponse.json(
        { ok: false, error: "Você não tem acesso a este anexo." },
        { status: 403 },
      )
    }

    const anexos = parseArray(os.anexos)
    const record = parseObject(anexos[index])

    if (!record || Object.keys(record).length === 0) {
      return NextResponse.json(
        { ok: false, error: "Anexo não encontrado na OS." },
        { status: 404 },
      )
    }

    const resolved = await resolveAttachmentPath(record)

    if (resolved.externalUrl) {
      return NextResponse.redirect(resolved.externalUrl)
    }

    if (!resolved.filePath) {
      return NextResponse.json(
        {
          ok: false,
          error: "Arquivo físico do anexo não encontrado em public/uploads.",
        },
        { status: 404 },
      )
    }

    const name = safeFilename(
      record.name ||
        record.filename ||
        record.originalName ||
        record.arquivoNomeOriginal ||
        path.basename(resolved.filePath),
    )

    const mimeType = contentTypeFromName(
      name,
      text(record.mimeType || record.contentType),
    )

    const buffer = await readFile(resolved.filePath)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (error) {
    console.error("[GET /api/email-os/anexo] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao abrir anexo da OS." },
      { status: 500 },
    )
  }
}
