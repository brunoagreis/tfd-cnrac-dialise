export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ ok: true, items: [], stats: { total: 0, pendentes: 0, reservados: 0, vencidos: 0, preJudicial: 0 } })
}
