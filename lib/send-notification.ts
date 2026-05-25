export async function sendInteractionNotification({
  protocolo,
  pacienteNome,
  autorNome,
  texto,
  emails,
}: {
  protocolo: string
  pacienteNome: string
  autorNome: string
  texto: string
  emails: string[]
}) {
  const uniqueEmails = [...new Set(emails.filter(Boolean))]

  for (const email of uniqueEmails) {
    try {
      await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: `SIS Regulacao - Nova manifestacao no protocolo ${protocolo}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0c7bb3;">SIS Regulacao</h2>
              <p>O protocolo <strong>${protocolo}</strong> do paciente <strong>${pacienteNome}</strong> recebeu uma nova manifestacao.</p>
              <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0;"><strong>${autorNome}</strong> escreveu:</p>
                <p style="margin: 0;">${texto.slice(0, 300)}${texto.length > 300 ? "..." : ""}</p>
              </div>
              <p style="color: #666; font-size: 14px;">Acesse o sistema para visualizar a manifestacao completa.</p>
            </div>
          `,
        }),
      })
    } catch {
      // Non-blocking - don't break if email fails
    }
  }
}
