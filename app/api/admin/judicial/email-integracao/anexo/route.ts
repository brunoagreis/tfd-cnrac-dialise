import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/security/server-session"
import { getEmailTriageConfig } from "@/lib/email-triage-test"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(value: unknown) {
  return String(value ?? "").trim()
}

function safeFileName(value: unknown) {
  return encodeURIComponent(text(value) || "anexo")
}

export async function GET(req: NextRequest) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response
  const uid = text(req.nextUrl.searchParams.get("uid"))
  const index = Number(req.nextUrl.searchParams.get("index") || 0)
  const config = getEmailTriageConfig()

  if (!uid) return NextResponse.json({ ok: false, error: "Informe o UID do e-mail." }, { status: 400 })
  if (!config.configured) return NextResponse.json({ ok: false, error: "Configuração de e-mail incompleta." }, { status: 400 })

  const { ImapFlow } = await import("imapflow")
  const { simpleParser } = await import("mailparser")
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(config.mailbox)
    try {
      let source: Buffer | null = null
      for await (const message of client.fetch(uid, { source: true, uid: true }, { uid: true })) {
        source = message.source as Buffer
        break
      }
      if (!source) return NextResponse.json({ ok: false, error: "E-mail não encontrado na INBOX." }, { status: 404 })
      const parsed = await simpleParser(source)
      const attachment = parsed.attachments?.[index]
      if (!attachment?.content) return NextResponse.json({ ok: false, error: "Anexo não encontrado." }, { status: 404 })
      const filename = text(attachment.filename) || `anexo-${index + 1}`
      const contentType = text(attachment.contentType) || "application/octet-stream"
      return new NextResponse(attachment.content, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename*=UTF-8''${safeFileName(filename)}`,
          "Cache-Control": "no-store",
        },
      })
    } finally {
      lock.release()
    }
  } catch (error) {
    console.error("[email-integracao/anexo] erro:", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao abrir anexo." }, { status: 500 })
  } finally {
    await client.logout().catch(() => undefined)
  }
}
