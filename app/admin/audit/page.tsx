import { createAdminClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

async function getAuditLogs() {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from("audit_event_log")
    .select(`
      *,
      user:core_users(display_name)
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("[NEXUS] Failed to fetch audit logs:", error)
    return []
  }

  return data
}

function getActionColor(action: string) {
  switch (action) {
    case "CREATE":
      return "bg-green-500/10 text-green-500"
    case "UPDATE":
      return "bg-blue-500/10 text-blue-500"
    case "DELETE":
      return "bg-red-500/10 text-red-500"
    case "STATUS_CHANGE":
      return "bg-yellow-500/10 text-yellow-500"
    default:
      return "bg-gray-500/10 text-gray-500"
  }
}

export default async function AuditPage() {
  const logs = await getAuditLogs()

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Auditoria</h1>
        <p className="text-muted-foreground">Log de eventos do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos Recentes</CardTitle>
          <CardDescription>Últimos 50 eventos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{log.user?.display_name || "Sistema"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.module_code}</Badge>
                  </TableCell>
                  <TableCell>{log.entity_type}</TableCell>
                  <TableCell>
                    <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{log.action_description || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {logs.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">Nenhum evento registrado ainda.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
