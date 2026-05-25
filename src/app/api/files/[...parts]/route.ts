import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { resolveFromRelative } from "@/lib/protocol-storage"

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

export async function GET(
  _req: Request,
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

    const fullPath = resolveFromRelative(relativePath)
    const fileBuffer = await fs.readFile(fullPath)
    const stat = await fs.stat(fullPath)

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentTypeByExt(fullPath),
        "Content-Length": String(stat.size),
        "Content-Disposition": `inline; filename="${path.basename(fullPath)}"`,
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