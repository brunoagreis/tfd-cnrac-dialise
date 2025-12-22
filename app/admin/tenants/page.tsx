import { createAdminClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

async function getTenants() {
  const supabase = await createAdminClient()
  const { data, error } = await supabase.from("core_tenants").select("*").order("name")

  if (error) {
    console.error("[NEXUS] Failed to fetch tenants:", error)
    return []
  }

  return data
}

export default async function TenantsPage() {
  const tenants = await getTenants()

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">Gerenciamento de municípios/SMS</p>
        </div>
        <Button asChild>
          <Link href="/admin/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo Tenant
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tenants.map((tenant) => (
          <Card key={tenant.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{tenant.name}</CardTitle>
                <Badge variant={tenant.is_active ? "default" : "secondary"}>
                  {tenant.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <CardDescription>
                {tenant.city}, {tenant.state}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Slug:</span> {tenant.slug}
                </p>
                {tenant.ibge_code && (
                  <p>
                    <span className="text-muted-foreground">IBGE:</span> {tenant.ibge_code}
                  </p>
                )}
                {tenant.cnes_principal && (
                  <p>
                    <span className="text-muted-foreground">CNES:</span> {tenant.cnes_principal}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/tenants/${tenant.id}`}>Gerenciar</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tenants.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Nenhum tenant cadastrado ainda.</p>
            <Button className="mt-4" asChild>
              <Link href="/admin/tenants/new">
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Tenant
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
