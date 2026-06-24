import { getEmailTriageConfig } from "@/lib/email-triage-test"

function text(value: unknown) {
  return String(value ?? "").trim()
}

export async function finalizeEmailMessage(uid: unknown) {
  const messageUid = text(uid)
  const config = getEmailTriageConfig()
  if (!messageUid || !config.configured) return false

  const { ImapFlow } = await import("imapflow")
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
      await client.messageFlagsAdd(messageUid, ["\\Seen"], { uid: true }).catch(() => undefined)
      const action = (client as any).messageDelete
      if (typeof action === "function") await action.call(client, messageUid, { uid: true }).catch(() => undefined)
      return true
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }
}
