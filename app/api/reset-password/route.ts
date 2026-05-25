import { NextResponse } from "next/server"
import { z } from "zod"

// This is a facade route. The actual token logic runs client-side in the demo.
// In production, this would generate a DB-backed token and send the email via SMTP.

const requestSchema = z.object({
  email: z.string().email(),
  resetLink: z.string().url(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      // Generic message to prevent email enumeration
      return NextResponse.json({ message: "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha." })
    }

    const { email, resetLink } = parsed.data

    // Attempt to send email (non-blocking for the response)
    try {
      await fetch(new URL("/api/email", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "SIS Regulacao - Redefinicao de Senha",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0c7bb3;">SIS Regulacao</h2>
              <p>Voce solicitou a redefinicao da sua senha.</p>
              <p>Clique no botao abaixo para criar uma nova senha:</p>
              <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #0c7bb3; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Redefinir Senha</a>
              <p style="color: #666; font-size: 14px;">Este link expira em 1 hora.</p>
              <p style="color: #666; font-size: 14px;">Se voce nao solicitou, ignore este e-mail.</p>
            </div>
          `,
        }),
      })
    } catch {
      // Silently fail - don't reveal whether email was sent
    }

    return NextResponse.json({ message: "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha." })
  } catch {
    return NextResponse.json({ message: "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha." })
  }
}
