import fs from "fs/promises"
import path from "path"

export const STORAGE_ROOT = path.join(process.cwd(), "storage")
export const PROTOCOL_STORAGE_ROOT = path.join(STORAGE_ROOT, "protocolos")
export const IMPORT_STORAGE_ROOT = path.join(STORAGE_ROOT, "importacoes")

export function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "")
}

export function safeSlug(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export function nowStamp() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`
}

export function buildProtocolFolder(params: {
  cpf: string
  module: string
  protocol: string
}) {
  const cpfDir = onlyDigits(params.cpf)
  const protocolDir = `${safeSlug(params.module)}-${safeSlug(params.protocol)}`
  return path.join(PROTOCOL_STORAGE_ROOT, cpfDir, protocolDir)
}

export function buildImportFolder(area: string, bucket?: string) {
  return path.join(IMPORT_STORAGE_ROOT, safeSlug(area), bucket ? safeSlug(bucket) : "")
}

export function buildStoredFileName(category: string, originalName: string) {
  const ext = path.extname(originalName || "") || ""
  const base = path.basename(originalName || "arquivo", ext)
  return `${safeSlug(category)}_${nowStamp()}_${safeSlug(base)}${ext.toLowerCase()}`
}

export function toRelativeStoragePath(fullPath: string) {
  return path.relative(STORAGE_ROOT, fullPath).split(path.sep).join("/")
}

export function resolveFromRelative(relativePath: string) {
  const normalized = relativePath.split("/").join(path.sep)
  const full = path.join(STORAGE_ROOT, normalized)

  const safeRoot = path.resolve(STORAGE_ROOT)
  const safeFull = path.resolve(full)

  if (!safeFull.startsWith(safeRoot)) {
    throw new Error("Caminho inválido.")
  }

  return safeFull
}
