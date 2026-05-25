import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import {
  buildImportFolder,
  buildStoredFileName,
  ensureDir,
  toRelativeStoragePath,
} from "@/lib/protocol-storage"

export const runtime = "nodejs"

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_IMPORT_EXTENSIONS = new Set([".csv", ".txt", ".xls", ".xlsx"])

function isAllowedImportFile(file: File) {
  const fileName = String(file.name || "")
  const ext = path.extname(fileName).toLowerCase()
  return ALLOWED_IMPORT_EXTENSIONS.has(ext)
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const area = String(form.get("area") || "geral").trim()
    const bucket = String(form.get("bucket") || "").trim()

    const files = form
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0)

    if (!files.length) {
      return NextResponse.json(
        { ok: false, error: "Nenhum arquivo enviado." },
        { status: 400 },
      )
    }

    const targetDir = buildImportFolder(area, bucket)
    await ensureDir(targetDir)

    const savedFiles = []

    for (const file of files) {
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        return NextResponse.json(
          { ok: false, error: `O arquivo ${file.name} excede o limite de 10 MB.` },
          { status: 400 },
        )
      }

      if (!isAllowedImportFile(file)) {
        return NextResponse.json(
          { ok: false, error: `Tipo de arquivo não permitido para importação: ${file.name}.` },
          { status: 400 },
        )
      }

      const storedName = buildStoredFileName(bucket || area, file.name)
      const fullPath = path.join(targetDir, storedName)
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(fullPath, buffer)

      const relativePath = toRelativeStoragePath(fullPath)
      const content = await file.text().catch(() => "")

      savedFiles.push({
        name: file.name,
        storedName,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        relativePath,
        url: `/api/files/${relativePath}`,
        content,
      })
    }

    return NextResponse.json({ ok: true, files: savedFiles })
  } catch (error) {
    console.error("IMPORT_UPLOAD_ERROR", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao salvar arquivo de importação." },
      { status: 500 },
    )
  }
}
