"use client"

import Link from "next/link"
import { Settings, Settings2, ShieldAlert } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function JudicialAdminPage() {
  const { user } = useAuth()
  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar a administração judicial.</div>
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Settings className="h-5 w-5 text-primary" /></div><div><h1 className="text-2xl font-bold tracking-tight">Administrador Judicial</h1><p className="text-sm text-muted-foreground">Acesse as páginas administrativas judiciais separadas.</p></div></div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4" /> Prioridades do monitoramento
            </CardTitle>
            <CardDescription>
              Página separada para configurar prioridade por SIGTAP e CID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/judicial/prioridades">Abrir prioridades</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" /> Bloqueio / Sequestro
            </CardTitle>
            <CardDescription>
              Relatório separado com valores do Estado e do Município.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/admin/judicial/bloqueio-sequestro">Abrir relatório</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
