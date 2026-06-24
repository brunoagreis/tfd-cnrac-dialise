import { prisma } from "@/lib/prisma"

export type EmailTriageUser = { id: string; nome: string; email: string }

type CountRow = { usuarioId: string | null; total: string | number | bigint }

function text(value: unknown) {
  return String(value ?? "").trim()
}

export async function pickEmailTriageAssignee(ruleId: string | null | undefined, users: EmailTriageUser[]) {
  const activeUsers = users.filter((user) => text(user.id))
  if (activeUsers.length === 0) return null
  if (activeUsers.length === 1) return activeUsers[0]

  const ids = activeUsers.map((user) => user.id)
  const counts = new Map(ids.map((id) => [id, 0]))

  if (text(ruleId)) {
    const rows = await prisma.$queryRawUnsafe<CountRow[]>(`
      SELECT usuario_id AS "usuarioId", COUNT(*) AS total
      FROM public.judicial_email_atribuicoes
      WHERE regra_id = $1::bigint AND ativo = TRUE AND usuario_id = ANY($2::text[])
      GROUP BY usuario_id
      UNION ALL
      SELECT responsavel_id AS "usuarioId", COUNT(*) AS total
      FROM public.judicial_email_os
      WHERE regra_id = $1::bigint AND responsavel_id = ANY($2::text[])
      GROUP BY responsavel_id
    `, ruleId, ids).catch(() => [] as CountRow[])

    for (const row of rows) {
      const id = text(row.usuarioId)
      if (!id) continue
      counts.set(id, (counts.get(id) || 0) + Number(row.total || 0))
    }
  }

  return [...activeUsers].sort((a, b) => {
    const byCount = (counts.get(a.id) || 0) - (counts.get(b.id) || 0)
    if (byCount !== 0) return byCount
    return (a.nome || a.email || a.id).localeCompare(b.nome || b.email || b.id, "pt-BR")
  })[0]
}
