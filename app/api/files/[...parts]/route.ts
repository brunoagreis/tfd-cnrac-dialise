import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { resolveFromRelative, STORAGE_ROOT } from "@/lib/protocol-storage"

export const runtime = "nodejs"

function contentTypeByExt(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()

  if (ext === ".pdf") return "application/pdf"
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".webp") return "image/webp"
  if (ext === ".zip") return "application/zip"
  if (ext === ".csv") return "text/csv; charset=utf-8"
  if (ext === ".txt") return "text/plain; charset=utf-8"

  return "application/octet-stream"
}

function resolvePublicUpload(relativePath: string) {
  const normalized = relativePath.split("/").join(path.sep)
  const publicRoot = path.join(process.cwd(), "public")
  const full = path.join(publicRoot, normalized)

  const safeRoot = path.resolve(publicRoot)
  const safeFull = path.resolve(full)

  if (!safeFull.startsWith(safeRoot)) {
    throw new Error("Caminho inválido.")
  }

  return safeFull
}

async function findReadableFile(relativePath: string) {
  if (relativePath.startsWith("uploads/")) {
    const publicPath = resolvePublicUpload(relativePath)
    await fs.access(publicPath)
    return publicPath
  }

  const storagePath = resolveFromRelative(relativePath)
  await fs.access(storagePath)
  return storagePath
}

export async function GET(
  req: Request,
  context: { params: Promise<{ parts: string[] }> },
) {
  try {
    const { parts } = await context.params
    const relativePath = (parts || []).join("/")

    if (!relativePath) {
      return NextResponse.json(
        { ok: false, error: "Arquivo não informado." },
        { status: 400 },
      )
    }

    const fullPath = await findReadableFile(relativePath)
    const fileBuffer = await fs.readFile(fullPath)
    const stat = await fs.stat(fullPath)
    const url = new URL(req.url)
    const forceDownload = url.searchParams.get("download") === "1"
    const filename = path.basename(fullPath)

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentTypeByExt(fullPath),
        "Content-Length": String(stat.size),
        "Content-Disposition": `${forceDownload ? "attachment" : "inline"}; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("FILE_READ_ERROR", error)
    return NextResponse.json(
      { ok: false, error: "Arquivo não encontrado." },
      { status: 404 },
    )
  }
}
