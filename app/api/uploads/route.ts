import fs from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest, requireLoggedRequest } from "@/lib/security/server-session"
import {
  buildProtocolFolder,
  buildStoredFileName,
  ensureDir,
  resolveFromRelative,
  toRelativeStoragePath,
} from "@/lib/protocol-storage"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".csv", ".txt", ".zip", ".doc", ".docx", ".xls", ".xlsx"])

function isAllowedFile(file: File) {
  const fileName = String(file.name || "")
  const ext = path.extname(fileName).toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext)
}

export async function POST(req: NextRequest) {
  try {
    const loggedGuard = await requireLoggedRequest(req)
    if (!loggedGuard.ok) return loggedGuard.response
    const form = await req.formData()

    const cpf = String(form.get("cpf") || "").trim()
    const protocol = String(form.get("protocol") || "").trim()
    const moduleName = String(form.get("module") || "").trim()
    const category = String(form.get("category") || "documento").trim()

    if (!cpf || !protocol || !moduleName) {
      return NextResponse.json(
        { ok: false, error: "cpf, protocol e module são obrigatórios." },
        { status: 400 },
      )
    }

    const files = form
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0)

    if (!files.length) {
      return NextResponse.json(
        { ok: false, error: "Nenhum arquivo enviado." },
        { status: 400 },
      )
    }

    const targetDir = buildProtocolFolder({
      cpf,
      module: moduleName,
      protocol,
    })

    await ensureDir(targetDir)

    const savedFiles = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { ok: false, error: `O arquivo ${file.name} excede o limite de 10 MB.` },
          { status: 400 },
        )
      }

      if (!isAllowedFile(file)) {
        return NextResponse.json(
          { ok: false, error: `Tipo de arquivo não permitido: ${file.name}.` },
          { status: 400 },
        )
      }

      const storedName = buildStoredFileName(category, file.name)
      const fullPath = path.join(targetDir, storedName)

      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(fullPath, buffer)

      const relativePath = toRelativeStoragePath(fullPath)

      savedFiles.push({
        name: file.name,
        storedName,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        relativePath,
        url: `/api/files/${relativePath}`,
      })
    }

    return NextResponse.json({
      ok: true,
      files: savedFiles,
    })
  } catch (error) {
    console.error("UPLOAD_ERROR", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao salvar arquivos." },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminGuard = await requireAdminRequest(req)
    if (!adminGuard.ok) return adminGuard.response
    const body = await req.json()
    const relativePath = String(body?.relativePath || "").trim()

    if (!relativePath) {
      return NextResponse.json(
        { ok: false, error: "relativePath é obrigatório." },
        { status: 400 },
      )
    }

    const fullPath = resolveFromRelative(relativePath)
    await fs.unlink(fullPath)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("UPLOAD_DELETE_ERROR", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao excluir arquivo." },
      { status: 500 },
    )
  }
}