import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/security/server-session"
import { getEmailTriageConfig } from "@/lib/email-triage-test"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(value: unknown) {
  return String(value ?? "").trim()
}

export async function POST(req: NextRequest) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response
  const body = await req.json().catch(() => ({}))
  const uid = text(body?.uid)
  const config = getEmailTriageConfig()
  if (!uid) return NextResponse.json({ ok: false, error: "Informe o e-mail." }, { status: 400 })
  if (!config.configured) return NextResponse.json({ ok: false, error: "Configuração de e-mail incompleta." }, { status: 400 })
  const { ImapFlow } = await import("imapflow")
  const client = new ImapFlow({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password }, logger: false })
  try {
    await client.connect()
    const lock = await client.getMailboxLock(config.mailbox)
    try {
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true })
      return NextResponse.json({ ok: true })
    } finally {
      lock.release()
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao marcar como lido." }, { status: 500 })
  } finally {
    await client.logout().catch(() => undefined)
  }
}
