import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import {
  buildProtocolFolder,
  buildStoredFileName,
  ensureDir,
  toRelativeStoragePath,
} from "@/lib/protocol-storage"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
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