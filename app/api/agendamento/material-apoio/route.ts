import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"

import { readServerSession } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type MaterialApoio = {
  id: string
  nome: string
  arquivoNome: string
  url: string
  mimeType: string
  size: number
  createdAt: string
  createdByName: string
  createdByEmail: string
}

const uploadDir = path.join(process.cwd(), "public", "uploads", "agendamento-material-apoio")
const indexFile = path.join(uploadDir, "materiais.json")

function sanitizeFilename(value: string) {
  return String(value || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140) || "arquivo"
}

async function ensureStore() {
  await mkdir(uploadDir, { recursive: true })
}

async function readMaterials(): Promise<MaterialApoio[]> {
  await ensureStore()

  try {
    const raw = await readFile(indexFile, "utf8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeMaterials(items: MaterialApoio[]) {
  await ensureStore()
  await writeFile(indexFile, JSON.stringify(items, null, 2), "utf8")
}

async function requireLoggedUser(req: NextRequest) {
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

  return { ok: true as const, session }
}

export async function GET(req: NextRequest) {
  const auth = await requireLoggedUser(req)
  if (!auth.ok) return auth.response

  const materiais = await readMaterials()

  return NextResponse.json({
    ok: true,
    materiais: materiais.sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    ),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireLoggedUser(req)
  if (!auth.ok) return auth.response

  const form = await req.formData()
  const nome = String(form.get("nome") || "").trim()
  const arquivo = form.get("arquivo")

  if (!nome) {
    return NextResponse.json(
      { ok: false, error: "Informe o nome do material." },
      { status: 400 },
    )
  }

  if (!(arquivo instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Envie o arquivo do material." },
      { status: 400 },
    )
  }

  const originalName = arquivo.name || "arquivo"
  const storedName =
    Date.now() +
    "_" +
    randomUUID().replaceAll("-", "") +
    "_" +
    sanitizeFilename(originalName)

  const physicalPath = path.join(uploadDir, storedName)
  const url = "/uploads/agendamento-material-apoio/" + storedName

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  await ensureStore()
  await writeFile(physicalPath, buffer)

  const sessionAny = auth.session as any
  const sessionUser = sessionAny?.user || sessionAny || {}

  const item: MaterialApoio = {
    id: randomUUID(),
    nome,
    arquivoNome: originalName,
    url,
    mimeType: arquivo.type || "application/octet-stream",
    size: arquivo.size || buffer.length,
    createdAt: new Date().toISOString(),
    createdByName:
      String(sessionUser.nome || sessionUser.name || sessionUser.email || "Usuário"),
    createdByEmail: String(sessionUser.email || ""),
  }

  const materiais = await readMaterials()
  materiais.push(item)
  await writeMaterials(materiais)

  return NextResponse.json({
    ok: true,
    material: item,
  })
}
